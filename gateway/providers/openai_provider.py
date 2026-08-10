import httpx
from gateway.config import get_settings
from gateway.providers.base import (
    BaseProvider,
    PermanentProviderError,
    RateLimitedError,
    TemporaryProviderError,
)
from gateway.schemas.chat import ChatChoice, ChatResponse, Message, TokenUsage

settings = get_settings()


class OpenAIProvider(BaseProvider):
    name = "openai"
    base_url = "https://api.openai.com/v1"

    def __init__(self, api_key: str | None = None):
        self._api_key = api_key or settings.openai_api_key

    async def chat_completion(self, request, timeout: float = 30.0) -> ChatResponse:
        if not self._api_key:
            raise PermanentProviderError("OpenAI API key not configured")

        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                json=request.provider_payload(),
                headers={"Authorization": f"Bearer {self._api_key}"},
            )

        return self._parse_response(resp, request.model)

    async def health_check(self) -> bool:
        if not self._api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
            return resp.status_code == 200
        except Exception:
            return False

    def _parse_response(self, resp: httpx.Response, model: str) -> ChatResponse:
        if resp.status_code == 429:
            raise RateLimitedError("OpenAI rate limit exceeded")
        if resp.status_code in (500, 502, 503, 504):
            raise TemporaryProviderError(f"OpenAI server error: {resp.status_code}")
        if resp.status_code >= 400:
            raise PermanentProviderError(f"OpenAI error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        choices = [
            ChatChoice(
                index=c["index"],
                message=Message(role=c["message"]["role"], content=c["message"]["content"]),
                finish_reason=c.get("finish_reason"),
            )
            for c in data.get("choices", [])
        ]
        usage = None
        if "usage" in data:
            u = data["usage"]
            usage = TokenUsage(
                prompt_tokens=u.get("prompt_tokens", 0),
                completion_tokens=u.get("completion_tokens", 0),
                total_tokens=u.get("total_tokens", 0),
            )
        return ChatResponse(
            id=data.get("id", ""),
            model=data.get("model", model),
            choices=choices,
            usage=usage,
        )
