import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from gateway.config import get_settings
from gateway.core.budget import BudgetEnforcer
from gateway.db.repositories.usage import get_provider_usage_summary, get_team_usage_summary
from gateway.db.session import get_db
from gateway.db.models import Team
from sqlalchemy import select

settings = get_settings()
router = APIRouter()


def _require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin key")


@router.get("/by-team", dependencies=[Depends(_require_admin)])
async def usage_by_team(
    request: Request,
    since_hours: int = Query(default=24, description="Look back N hours"),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(hours=since_hours)
    summaries = await get_team_usage_summary(db, since=since)

    budget_enforcer: BudgetEnforcer = request.app.state.budget_enforcer

    # Fetch team names
    result = await db.execute(select(Team.id, Team.name, Team.monthly_budget_usd))
    team_info = {str(row.id): (row.name, float(row.monthly_budget_usd)) for row in result}

    enriched = []
    for s in summaries:
        tid = str(s["team_id"])
        name, budget = team_info.get(tid, ("unknown", 0))
        ratio = await budget_enforcer.get_usage_ratio(tid, __import__("decimal").Decimal(str(budget)))
        enriched.append({
            **{k: str(v) if isinstance(v, uuid.UUID) else v for k, v in s.items()},
            "team_name": name,
            "monthly_budget_usd": budget,
            "budget_used_ratio": ratio,
        })
    return enriched


@router.get("/by-provider", dependencies=[Depends(_require_admin)])
async def usage_by_provider(
    since_hours: int = Query(default=24),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(hours=since_hours)
    summaries = await get_provider_usage_summary(db, since=since)
    return [
        {k: str(v) if isinstance(v, uuid.UUID) else v for k, v in s.items()}
        for s in summaries
    ]


@router.get("/budget", dependencies=[Depends(_require_admin)])
async def budget_status(request: Request, db: AsyncSession = Depends(get_db)):
    budget_enforcer: BudgetEnforcer = request.app.state.budget_enforcer
    result = await db.execute(select(Team.id, Team.name, Team.monthly_budget_usd).where(Team.is_active == True))

    statuses = []
    for row in result:
        tid = str(row.id)
        spend = await budget_enforcer.get_spend(tid)
        statuses.append({
            "team_id": tid,
            "team_name": row.name,
            "monthly_budget_usd": float(row.monthly_budget_usd),
            "spent_usd": float(spend),
            "remaining_usd": max(0.0, float(row.monthly_budget_usd) - float(spend)),
            "budget_used_pct": round(100 * float(spend) / float(row.monthly_budget_usd), 2) if row.monthly_budget_usd > 0 else 0,
        })
    return statuses
