import hashlib
import uuid
from decimal import Decimal
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from gateway.db.models import Team, TeamPolicy


def _hash_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()


async def get_team_by_api_key(db: AsyncSession, api_key: str) -> Optional[Team]:
    key_hash = _hash_key(api_key)
    result = await db.execute(
        select(Team)
        .options(selectinload(Team.policy))
        .where(Team.api_key_hash == key_hash, Team.is_active == True)
    )
    return result.scalar_one_or_none()


async def get_team_by_id(db: AsyncSession, team_id: uuid.UUID) -> Optional[Team]:
    result = await db.execute(
        select(Team).options(selectinload(Team.policy)).where(Team.id == team_id)
    )
    return result.scalar_one_or_none()


async def list_teams(db: AsyncSession) -> list[Team]:
    result = await db.execute(select(Team).options(selectinload(Team.policy)).order_by(Team.name))
    return list(result.scalars().all())


async def create_team(
    db: AsyncSession,
    name: str,
    api_key: str,
    monthly_budget_usd: Decimal,
    max_rpm: int = 60,
    max_tpm: int = 100_000,
    allowed_models: Optional[list[str]] = None,
    routing_strategy: str = "priority",
) -> Team:
    team = Team(
        name=name,
        api_key_hash=_hash_key(api_key),
        monthly_budget_usd=monthly_budget_usd,
    )
    db.add(team)
    await db.flush()

    policy = TeamPolicy(
        team_id=team.id,
        max_rpm=max_rpm,
        max_tpm=max_tpm,
        allowed_models=allowed_models,
        routing_strategy=routing_strategy,
    )
    db.add(policy)
    await db.commit()
    await db.refresh(team)
    return team


async def update_team(
    db: AsyncSession,
    team_id: uuid.UUID,
    **kwargs,
) -> Optional[Team]:
    await db.execute(update(Team).where(Team.id == team_id).values(**kwargs))
    await db.commit()
    return await get_team_by_id(db, team_id)


async def rotate_api_key(db: AsyncSession, team_id: uuid.UUID, new_api_key: str) -> bool:
    result = await db.execute(
        update(Team)
        .where(Team.id == team_id)
        .values(api_key_hash=_hash_key(new_api_key))
    )
    await db.commit()
    return result.rowcount > 0
