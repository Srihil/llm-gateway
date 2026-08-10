"""
Redis token-bucket rate limiter.

Each team gets a bucket of capacity `max_rpm` tokens that refills at
max_rpm/60 tokens per second. A request costs 1 token. The check is
atomic via a Lua script so concurrent requests don't race.
"""
import time
from redis.asyncio import Redis

_LUA_TOKEN_BUCKET = """
local key       = KEYS[1]
local capacity  = tonumber(ARGV[1])
local refill_ps = tonumber(ARGV[2])   -- tokens per second
local now       = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens      = tonumber(data[1]) or capacity
local last_refill = tonumber(data[2]) or now

local elapsed   = math.max(0, now - last_refill)
local new_tokens = math.min(capacity, tokens + elapsed * refill_ps)

if new_tokens >= 1 then
    redis.call('HMSET', key, 'tokens', new_tokens - 1, 'last_refill', now)
    redis.call('EXPIRE', key, 86400)
    return 1
else
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    redis.call('EXPIRE', key, 86400)
    return 0
end
"""


class RateLimiter:
    def __init__(self, redis: Redis):
        self._redis = redis

    async def check(self, team_id: str, max_rpm: int) -> bool:
        """Returns True if the request is allowed, False if rate-limited."""
        key = f"rl:{team_id}"
        refill_per_second = max_rpm / 60.0
        result = await self._redis.eval(
            _LUA_TOKEN_BUCKET,
            1,  # number of keys
            key,
            max_rpm,
            refill_per_second,
            time.time(),
        )
        return bool(result)

    async def get_remaining(self, team_id: str, max_rpm: int) -> float:
        key = f"rl:{team_id}"
        data = await self._redis.hmget(key, "tokens", "last_refill")
        tokens = float(data[0]) if data[0] else float(max_rpm)
        last_refill = float(data[1]) if data[1] else time.time()
        elapsed = max(0, time.time() - last_refill)
        return min(max_rpm, tokens + elapsed * (max_rpm / 60.0))
