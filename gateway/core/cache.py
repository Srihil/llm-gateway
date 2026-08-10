"""
Response cache backed by Redis.

Cache key = sha256(team_id + model + sorted messages + temperature)
Tenant isolation is baked into the key — Team A can never get Team B's response.
"""
import hashlib
import json
from typing import Optional
from redis.asyncio import Redis
from gateway.schemas.chat import ChatRequest, ChatResponse
from gateway.config import get_settings

settings = get_settings()


class ResponseCache:
    def __init__(self, redis: Redis):
        self._redis = redis

    def make_key(self, team_id: str, request: ChatRequest) -> str:
        payload = {
            "team_id": team_id,
            "model": request.model,
            "messages": [m.model_dump() for m in request.messages],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        }
        digest = hashlib.sha256(
            json.dumps(payload, sort_keys=True).encode()
        ).hexdigest()
        return f"cache:{team_id}:{digest}"

    async def get(self, key: str) -> Optional[ChatResponse]:
        raw = await self._redis.get(key)
        if raw is None:
            return None
        return ChatResponse.model_validate_json(raw)

    async def set(self, key: str, response: ChatResponse, ttl: int) -> None:
        if ttl <= 0:
            return
        await self._redis.set(key, response.model_dump_json(), ex=ttl)

    async def delete(self, key: str) -> None:
        await self._redis.delete(key)

    async def flush_team(self, team_id: str) -> int:
        """Delete all cached responses for a team."""
        pattern = f"cache:{team_id}:*"
        keys = await self._redis.keys(pattern)
        if keys:
            return await self._redis.delete(*keys)
        return 0
