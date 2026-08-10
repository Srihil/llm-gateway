import httpx
from gateway.config import get_settings
from gateway.providers.base import BaseProvider, TemporaryProviderError, PermanentProviderError
from gateway.schemas.chat import ChatChoice, ChatResponse, Message, TokenUsage

settings = get_settings()


class OllamaProvider(BaseProvider):
    name = "ollama"

    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or settings.ollama_base_url

    async def chat_completion(self, request, timeout: float = 60.0) -> ChatResponse:
        payload = {
            "model": request.model,
            "messages": [{"role": m.role, "content": m.content} for m in request.messages],
            "stream": False,
            "options": {},
        }
        if request.temperature is not None:
            payload["options"]["temperature"] = request.temperature

        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                resp = await client.post(f"{self.base_url}/api/chat", json=payload)
            except httpx.ConnectError:
                raise TemporaryProviderError("Ollama not reachable — is it running?")

        if resp.status_code >= 500:
            raise TemporaryProviderError(f"Ollama error: {resp.status_code}")
        if resp.status_code >= 400:
            raise PermanentProviderError(f"Ollama error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        content = data.get("message", {}).get("content", "")
        usage_data = data.get("usage", {})
        usage = TokenUsage(
            prompt_tokens=usage_data.get("prompt_tokens", 0),
            completion_tokens=usage_data.get("completion_tokens", 0),
            total_tokens=usage_data.get("total_tokens", 0),
        )
        return ChatResponse(
            model=request.model,
            choices=[ChatChoice(message=Message(role="assistant", content=content))],
            usage=usage,
        )

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
            return resp.status_code == 200
        except Exception:
            return False
