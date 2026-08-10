import time
import uuid
from typing import Any, Literal, Optional, Union
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: Union[str, list[dict[str, Any]]]
    name: Optional[str] = None


class ChatRequest(BaseModel):
    model: str
    messages: list[Message]
    temperature: Optional[float] = 1.0
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    stream: Optional[bool] = False
    stop: Optional[Union[str, list[str]]] = None
    user: Optional[str] = None

    # Gateway extension fields (stripped before forwarding to provider)
    x_cache_ttl: Optional[int] = Field(default=None, description="Cache TTL in seconds. 0 = no cache.")
    x_routing_strategy: Optional[str] = Field(default=None, description="Override team routing: priority|cost|performance")
    x_providers: Optional[list[str]] = Field(default=None, description="Restrict to these provider names")

    def provider_payload(self) -> dict:
        """Return only standard OpenAI-compatible fields."""
        data = self.model_dump(exclude={"x_cache_ttl", "x_routing_strategy", "x_providers"}, exclude_none=True)
        return data


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatChoice(BaseModel):
    index: int = 0
    message: Message
    finish_reason: Optional[str] = "stop"


class ChatResponse(BaseModel):
    id: str = Field(default_factory=lambda: f"chatcmpl-{uuid.uuid4().hex[:8]}")
    object: str = "chat.completion"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: list[ChatChoice]
    usage: Optional[TokenUsage] = None

    # Gateway metadata (returned in response body under x_ prefix)
    x_gateway_request_id: Optional[str] = None
    x_gateway_provider: Optional[str] = None
    x_gateway_cached: Optional[bool] = None
    x_gateway_cost_usd: Optional[float] = None
    x_gateway_latency_ms: Optional[int] = None
