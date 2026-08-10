"""
Budget enforcement using Redis for fast checks + Postgres for durable accounting.

Redis key `budget:{team_id}:{YYYY-MM}` holds estimated spend as a float string.
It is updated on every request and periodically synced from Postgres.
"""
from datetime import datetime
from decimal import Decimal
from redis.asyncio import Redis


class BudgetEnforcer:
    def __init__(self, redis: Redis):
        self._redis = redis

    def _key(self, team_id: str) -> str:
        period = datetime.utcnow().strftime("%Y-%m")
        return f"budget:{team_id}:{period}"

    async def get_spend(self, team_id: str) -> Decimal:
        val = await self._redis.get(self._key(team_id))
        return Decimal(str(val.decode())) if val else Decimal("0")

    async def check(self, team_id: str, monthly_budget_usd: Decimal) -> bool:
        """Returns True if the team is within budget."""
        if monthly_budget_usd <= 0:
            return True  # Unlimited
        spend = await self.get_spend(team_id)
        return spend < monthly_budget_usd

    async def add_spend(self, team_id: str, cost_usd: float) -> Decimal:
        """Increment spend counter. Returns new total."""
        key = self._key(team_id)
        # INCRBYFLOAT is atomic
        new_val = await self._redis.incrbyfloat(key, cost_usd)
        # Set expiry to ~35 days so it auto-cleans after month ends
        await self._redis.expire(key, 35 * 86400)
        return Decimal(str(new_val))

    async def sync_from_db(self, team_id: str, db_spend: Decimal) -> None:
        """Override Redis value with the authoritative Postgres value."""
        key = self._key(team_id)
        await self._redis.set(key, float(db_spend), ex=35 * 86400)

    async def get_usage_ratio(self, team_id: str, monthly_budget_usd: Decimal) -> float:
        """Returns spend/budget as a float (0.0–1.0+)."""
        if monthly_budget_usd <= 0:
            return 0.0
        spend = await self.get_spend(team_id)
        return float(spend / monthly_budget_usd)
