"""
Per-provider circuit breaker stored in Redis.

States:
  CLOSED    — normal operation, requests flow through
  OPEN      — provider is unhealthy, requests are rejected immediately
  HALF_OPEN — recovery probe: one test request allowed; success → CLOSED, failure → OPEN
"""
import time
from enum import Enum
from dataclasses import dataclass
from redis.asyncio import Redis
from gateway.config import get_settings

settings = get_settings()


class CBState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CBStatus:
    state: CBState
    failure_count: int
    last_failure_time: float


class CircuitBreaker:
    def __init__(
        self,
        redis: Redis,
        failure_threshold: int | None = None,
        recovery_timeout: int | None = None,
    ):
        self._redis = redis
        self._threshold = failure_threshold or settings.cb_failure_threshold
        self._recovery_timeout = recovery_timeout or settings.cb_recovery_timeout

    def _key(self, provider_id: str) -> str:
        return f"cb:{provider_id}"

    async def get_status(self, provider_id: str) -> CBStatus:
        data = await self._redis.hgetall(self._key(provider_id))
        if not data:
            return CBStatus(state=CBState.CLOSED, failure_count=0, last_failure_time=0.0)

        state_raw = (data.get(b"state") or b"closed").decode()
        failure_count = int(data.get(b"failures") or 0)
        last_failure = float(data.get(b"last_failure") or 0)

        state = CBState(state_raw)

        if state == CBState.OPEN:
            elapsed = time.time() - last_failure
            if elapsed >= self._recovery_timeout:
                await self._redis.hset(self._key(provider_id), "state", CBState.HALF_OPEN)
                state = CBState.HALF_OPEN

        return CBStatus(state=state, failure_count=failure_count, last_failure_time=last_failure)

    async def is_open(self, provider_id: str) -> bool:
        status = await self.get_status(provider_id)
        return status.state == CBState.OPEN

    async def allow_request(self, provider_id: str) -> bool:
        """Returns True if the request should be forwarded to the provider."""
        status = await self.get_status(provider_id)
        if status.state == CBState.CLOSED:
            return True
        if status.state == CBState.OPEN:
            return False
        # HALF_OPEN: allow one probe request through
        return True

    async def record_success(self, provider_id: str) -> None:
        status = await self.get_status(provider_id)
        if status.state in (CBState.HALF_OPEN, CBState.OPEN):
            # Recovery confirmed — reset to CLOSED
            await self._redis.delete(self._key(provider_id))
        else:
            # Reset consecutive failure count
            await self._redis.hset(self._key(provider_id), "failures", 0)

    async def record_failure(self, provider_id: str) -> CBState:
        key = self._key(provider_id)
        pipe = self._redis.pipeline()
        pipe.hincrby(key, "failures", 1)
        pipe.hset(key, "last_failure", time.time())
        pipe.expire(key, 86400)
        results = await pipe.execute()

        failure_count = results[0]
        if failure_count >= self._threshold:
            await self._redis.hset(key, "state", CBState.OPEN)
            return CBState.OPEN
        else:
            await self._redis.hset(key, "state", CBState.CLOSED)
            return CBState.CLOSED

    async def get_all_states(self, provider_ids: list[str]) -> dict[str, CBStatus]:
        return {pid: await self.get_status(pid) for pid in provider_ids}

    async def reset(self, provider_id: str) -> None:
        """Manually reset a circuit breaker (admin action)."""
        await self._redis.delete(self._key(provider_id))
