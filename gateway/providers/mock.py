"""
Deterministic mock provider — no real API calls, configurable behaviour.

Used to demonstrate:
  - retries (MOCK_FAILURE_RATE > 0)
  - circuit breaking (sustained failures)
  - fallback (mock as secondary provider)
  - caching (same input always returns same output)
  - rate limit rejection (gateway-level, not this provider)
"""
import asyncio
import hashlib
import random
import time
from gateway.config import get_settings
from gateway.providers.base import (
    BaseProvider,
    RateLimitedError,
    TemporaryProviderError,
)
from gateway.schemas.chat import ChatChoice, ChatResponse, Message, TokenUsage

settings = get_settings()


class MockProvider(BaseProvider):
    name = "mock"
    base_url = "http://localhost:0"

    async def chat_completion(self, request, timeout: float = 30.0) -> ChatResponse:
        # Simulate latency
        latency_s = settings.mock_latency_ms / 1000.0
        await asyncio.sleep(latency_s)

        # Simulate failures
        if random.random() < settings.mock_failure_rate:
            failure_type = settings.mock_failure_type
            if failure_type == "rate_limit":
                raise RateLimitedError("Mock provider rate limit")
            raise TemporaryProviderError(f"Mock provider {failure_type} error")

        # Deterministic reply based on input hash (good for cache demos)
        content = self._deterministic_reply(request)
        prompt_tokens = sum(len(m.content.split()) * 2 for m in request.messages if isinstance(m.content, str))
        completion_tokens = len(content.split()) * 2

        return ChatResponse(
            model=request.model or "mock-gpt",
            choices=[
                ChatChoice(
                    index=0,
                    message=Message(role="assistant", content=content),
                    finish_reason="stop",
                )
            ],
            usage=TokenUsage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            ),
        )

    async def health_check(self) -> bool:
        return True

    def _deterministic_reply(self, request) -> str:
        last_user_msg = next(
            (m.content for m in reversed(request.messages) if m.role == "user"),
            "Hello",
        )
        if not isinstance(last_user_msg, str):
            last_user_msg = str(last_user_msg)
        digest = hashlib.md5(last_user_msg.encode()).hexdigest()[:8]
        return (
            f"[Mock response #{digest}] This is a deterministic mock reply to: "
            f'"{last_user_msg[:60]}". No real LLM was called.'
        )
