import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from gateway.db.models import UsageRecord, BudgetUsage


async def record_usage(
    db: AsyncSession,
    request_id: str,
    team_id: uuid.UUID,
    model: str,
    status: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cost_usd: Decimal = Decimal("0"),
    latency_ms: int = 0,
    cached: bool = False,
    provider_id: Optional[uuid.UUID] = None,
    error_message: Optional[str] = None,
) -> UsageRecord:
    record = UsageRecord(
        request_id=request_id,
        team_id=team_id,
        provider_id=provider_id,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
        latency_ms=latency_ms,
        cached=cached,
        status=status,
        error_message=error_message,
    )
    db.add(record)

    # Update monthly budget aggregate
    period = date(datetime.utcnow().year, datetime.utcnow().month, 1)
    await db.execute(
        text("""
            INSERT INTO budget_usage (team_id, period_month, spent_usd, request_count)
            VALUES (:team_id, :period, :cost, 1)
            ON CONFLICT (team_id, period_month)
            DO UPDATE SET
                spent_usd = budget_usage.spent_usd + EXCLUDED.spent_usd,
                request_count = budget_usage.request_count + 1
        """),
        {"team_id": team_id, "period": period, "cost": float(cost_usd)},
    )

    await db.commit()
    return record


async def get_monthly_spend(db: AsyncSession, team_id: uuid.UUID) -> Decimal:
    period = date(datetime.utcnow().year, datetime.utcnow().month, 1)
    result = await db.execute(
        select(BudgetUsage.spent_usd).where(
            BudgetUsage.team_id == team_id,
            BudgetUsage.period_month == period,
        )
    )
    row = result.scalar_one_or_none()
    return Decimal(str(row)) if row else Decimal("0")


async def get_team_usage_summary(
    db: AsyncSession,
    team_id: Optional[uuid.UUID] = None,
    since: Optional[datetime] = None,
) -> list[dict]:
    query = (
        select(
            UsageRecord.team_id,
            func.count(UsageRecord.id).label("request_count"),
            func.sum(UsageRecord.input_tokens).label("total_input_tokens"),
            func.sum(UsageRecord.output_tokens).label("total_output_tokens"),
            func.sum(UsageRecord.cost_usd).label("total_cost_usd"),
            func.avg(UsageRecord.latency_ms).label("avg_latency_ms"),
        )
        .group_by(UsageRecord.team_id)
    )
    if team_id:
        query = query.where(UsageRecord.team_id == team_id)
    if since:
        query = query.where(UsageRecord.created_at >= since)

    result = await db.execute(query)
    return [dict(row._mapping) for row in result]


async def get_provider_usage_summary(db: AsyncSession, since: Optional[datetime] = None) -> list[dict]:
    query = (
        select(
            UsageRecord.provider_id,
            UsageRecord.model,
            func.count(UsageRecord.id).label("request_count"),
            func.sum(UsageRecord.input_tokens).label("total_input_tokens"),
            func.sum(UsageRecord.output_tokens).label("total_output_tokens"),
            func.sum(UsageRecord.cost_usd).label("total_cost_usd"),
        )
        .group_by(UsageRecord.provider_id, UsageRecord.model)
    )
    if since:
        query = query.where(UsageRecord.created_at >= since)

    result = await db.execute(query)
    return [dict(row._mapping) for row in result]
