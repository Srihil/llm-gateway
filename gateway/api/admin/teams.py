import secrets
import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from gateway.config import get_settings
from gateway.db.repositories import teams as teams_repo
from gateway.db.session import get_db

settings = get_settings()
router = APIRouter()


def _require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin key")


class CreateTeamRequest(BaseModel):
    name: str
    monthly_budget_usd: Decimal = Decimal("10.0")
    max_rpm: int = 60
    max_tpm: int = 100_000
    allowed_models: Optional[list[str]] = None
    routing_strategy: str = "priority"


class CreateTeamResponse(BaseModel):
    id: str
    name: str
    api_key: str  # Only shown at creation time
    monthly_budget_usd: Decimal


class TeamSummary(BaseModel):
    id: str
    name: str
    monthly_budget_usd: Decimal
    is_active: bool
    max_rpm: int
    routing_strategy: str


@router.get("", response_model=list[TeamSummary], dependencies=[Depends(_require_admin)])
async def list_teams(db: AsyncSession = Depends(get_db)):
    teams = await teams_repo.list_teams(db)
    return [
        TeamSummary(
            id=str(t.id),
            name=t.name,
            monthly_budget_usd=t.monthly_budget_usd,
            is_active=t.is_active,
            max_rpm=t.policy.max_rpm if t.policy else 0,
            routing_strategy=t.policy.routing_strategy if t.policy else "priority",
        )
        for t in teams
    ]


@router.post("", response_model=CreateTeamResponse, status_code=201, dependencies=[Depends(_require_admin)])
async def create_team(body: CreateTeamRequest, db: AsyncSession = Depends(get_db)):
    api_key = f"gw-{secrets.token_urlsafe(32)}"
    team = await teams_repo.create_team(
        db,
        name=body.name,
        api_key=api_key,
        monthly_budget_usd=body.monthly_budget_usd,
        max_rpm=body.max_rpm,
        max_tpm=body.max_tpm,
        allowed_models=body.allowed_models,
        routing_strategy=body.routing_strategy,
    )
    return CreateTeamResponse(
        id=str(team.id),
        name=team.name,
        api_key=api_key,
        monthly_budget_usd=team.monthly_budget_usd,
    )


@router.get("/{team_id}", response_model=TeamSummary, dependencies=[Depends(_require_admin)])
async def get_team(team_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    team = await teams_repo.get_team_by_id(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return TeamSummary(
        id=str(team.id),
        name=team.name,
        monthly_budget_usd=team.monthly_budget_usd,
        is_active=team.is_active,
        max_rpm=team.policy.max_rpm if team.policy else 0,
        routing_strategy=team.policy.routing_strategy if team.policy else "priority",
    )


@router.post("/{team_id}/rotate-key", dependencies=[Depends(_require_admin)])
async def rotate_api_key(team_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    new_key = f"gw-{secrets.token_urlsafe(32)}"
    ok = await teams_repo.rotate_api_key(db, team_id, new_key)
    if not ok:
        raise HTTPException(status_code=404, detail="Team not found")
    return {"api_key": new_key}


@router.patch("/{team_id}/deactivate", dependencies=[Depends(_require_admin)])
async def deactivate_team(team_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await teams_repo.update_team(db, team_id, is_active=False)
    return {"status": "deactivated"}
