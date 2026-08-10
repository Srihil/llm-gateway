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

ANTHROPIC_API_VERSION = "2023-06-01"


class AnthropicProvider(BaseProvider):
    name = "anthropic"
    base_url = "https://api.anthropic.com/v1"

    def __init__(self, api_key: str | None = None):
        self._api_key = api_key or settings.anthropic_api_key

    async def chat_completion(self, request, timeout: float = 30.0) -> ChatResponse:
        if not self._api_key:
            raise PermanentProviderError("Anthropic API key not configured")

        payload = self._build_payload(request)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{self.base_url}/messages",
                json=payload,
                headers={
                    "x-api-key": self._api_key,
                    "anthropic-version": ANTHROPIC_API_VERSION,
                    "content-type": "application/json",
                },
            )

        return self._parse_response(resp, request.model)

    async def health_check(self) -> bool:
        return self._api_key is not None

    def _build_payload(self, request) -> dict:
        """Convert OpenAI-style request to Anthropic Messages API format."""
        system_msg = None
        messages = []

        for msg in request.messages:
            if msg.role == "system":
                system_msg = msg.content if isinstance(msg.content, str) else str(msg.content)
            else:
                messages.append({"role": msg.role, "content": msg.content})

        payload: dict = {
            "model": request.model,
            "messages": messages,
            "max_tokens": request.max_tokens or 1024,
        }
        if system_msg:
            payload["system"] = system_msg
        if request.temperature is not None:
            payload["temperature"] = request.temperature
        return payload

    def _parse_response(self, resp: httpx.Response, model: str) -> ChatResponse:
        if resp.status_code == 429:
            raise RateLimitedError("Anthropic rate limit exceeded")
        if resp.status_code in (500, 502, 503, 504, 529):
            raise TemporaryProviderError(f"Anthropic server error: {resp.status_code}")
        if resp.status_code >= 400:
            raise PermanentProviderError(f"Anthropic error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        content_text = ""
        for block in data.get("content", []):
            if block.get("type") == "text":
                content_text += block.get("text", "")

        usage_data = data.get("usage", {})
        usage = TokenUsage(
            prompt_tokens=usage_data.get("input_tokens", 0),
            completion_tokens=usage_data.get("output_tokens", 0),
            total_tokens=usage_data.get("input_tokens", 0) + usage_data.get("output_tokens", 0),
        )
        return ChatResponse(
            id=data.get("id", ""),
            model=data.get("model", model),
            choices=[
                ChatChoice(
                    index=0,
                    message=Message(role="assistant", content=content_text),
                    finish_reason=data.get("stop_reason", "stop"),
                )
            ],
            usage=usage,
        )
