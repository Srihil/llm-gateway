"""
Provider registry — maps provider names to instantiated provider objects.
Providers are singletons; their API keys come from DB-stored encrypted config
or from environment variables as fallback.
"""
from gateway.providers.base import BaseProvider
from gateway.providers.mock import MockProvider
from gateway.providers.openrouter import OpenRouterProvider
from gateway.providers.openai_provider import OpenAIProvider
from gateway.providers.anthropic_provider import AnthropicProvider
from gateway.providers.ollama import OllamaProvider
from gateway.db.repositories.providers import decrypt_api_key
from gateway.db.models import Provider as ProviderModel


_PROVIDER_CLASSES: dict[str, type[BaseProvider]] = {
    "mock": MockProvider,
    "openrouter": OpenRouterProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "ollama": OllamaProvider,
}

_registry: dict[str, BaseProvider] = {}


def build_provider(db_provider: ProviderModel) -> BaseProvider:
    cls = _PROVIDER_CLASSES.get(db_provider.name)
    if cls is None:
        raise ValueError(f"Unknown provider: {db_provider.name}")

    api_key = None
    if db_provider.api_key_encrypted:
        try:
            api_key = decrypt_api_key(db_provider.api_key_encrypted)
        except Exception:
            pass  # fall through to env-var fallback in each provider

    if db_provider.name == "ollama":
        return cls(base_url=db_provider.base_url)
    if db_provider.name == "mock":
        return cls()
    return cls(api_key=api_key)


def get_provider(name: str) -> BaseProvider | None:
    return _registry.get(name)


def register(name: str, provider: BaseProvider) -> None:
    _registry[name] = provider


def rebuild_from_db(db_providers: list[ProviderModel]) -> None:
    """Called on startup and after provider config changes."""
    _registry.clear()
    for p in db_providers:
        if p.is_enabled:
            _registry[p.name] = build_provider(p)


def list_registered() -> list[str]:
    return list(_registry.keys())
