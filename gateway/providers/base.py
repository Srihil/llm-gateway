from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
from gateway.schemas.chat import ChatRequest, ChatResponse


# Pricing registry: cost in USD per token
PROVIDER_PRICING: dict[str, dict[str, float]] = {
    # OpenRouter / OpenAI models
    "gpt-4o": {"input": 5e-6, "output": 15e-6},
    "gpt-4o-mini": {"input": 1.5e-7, "output": 6e-7},
    "gpt-3.5-turbo": {"input": 5e-7, "output": 1.5e-6},
    # Anthropic
    "claude-3-5-sonnet-20241022": {"input": 3e-6, "output": 15e-6},
    "claude-3-5-haiku-20241022": {"input": 8e-7, "output": 4e-6},
    "claude-3-haiku-20240307": {"input": 2.5e-7, "output": 1.25e-6},
    # Llama / free OpenRouter
    "meta-llama/llama-3.1-8b-instruct:free": {"input": 0.0, "output": 0.0},
    "meta-llama/llama-3.2-3b-instruct:free": {"input": 0.0, "output": 0.0},
    # Mock
    "mock-gpt": {"input": 0.0, "output": 0.0},
}


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = PROVIDER_PRICING.get(model, {"input": 0.0, "output": 0.0})
    return input_tokens * pricing["input"] + output_tokens * pricing["output"]


class ProviderError(Exception):
    """Base class for provider errors."""
    retryable: bool = False


class TemporaryProviderError(ProviderError):
    """Transient error — retry is appropriate (5xx, timeout, 429)."""
    retryable = True


class RateLimitedError(TemporaryProviderError):
    """Provider is rate-limiting us."""


class PermanentProviderError(ProviderError):
    """Permanent error — do not retry (400, 401, 403)."""
    retryable = False


@dataclass
class ProviderResult:
    response: ChatResponse
    provider_name: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    latency_ms: int


class BaseProvider(ABC):
    name: str
    base_url: str

    @abstractmethod
    async def chat_completion(self, request: ChatRequest, timeout: float = 30.0) -> ChatResponse:
        """Execute a chat completion and return a normalised ChatResponse."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the provider is reachable."""
        ...

    def supports_model(self, model: str) -> bool:
        return True  # Override in provider subclasses if needed
