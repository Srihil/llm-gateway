from functools import lru_cache
from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    # App
    app_name: str = "LLM Gateway"
    debug: bool = False
    log_level: str = "INFO"

    # Database — Render provides postgres:// which needs normalising for SQLAlchemy
    database_url: str = "postgresql+asyncpg://gateway:gateway@localhost:5432/llm_gateway"
    database_sync_url: str = "postgresql+psycopg2://gateway:gateway@localhost:5432/llm_gateway"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalise_async_url(cls, v: str) -> str:
        if v.startswith("postgres://"):
            v = "postgresql+asyncpg://" + v[len("postgres://"):]
        elif v.startswith("postgresql://") and "+asyncpg" not in v:
            v = "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    @field_validator("database_sync_url", mode="before")
    @classmethod
    def normalise_sync_url(cls, v: str) -> str:
        if v.startswith("postgres://"):
            v = "postgresql+psycopg2://" + v[len("postgres://"):]
        elif v.startswith("postgresql://") and "+psycopg2" not in v:
            v = "postgresql+psycopg2://" + v[len("postgresql://"):]
        return v

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Security
    gateway_secret_key: str = "CHANGE_ME_generate_with_make_gen-key"
    admin_api_key: str = "admin-secret-change-in-production"

    # Observability
    otel_endpoint: str = "http://localhost:4317"
    otel_enabled: bool = True

    # Provider API keys (all optional — mock works without any)
    openrouter_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    ollama_base_url: str = "http://localhost:11434"

    # Cache
    cache_default_ttl: int = 3600

    # Circuit breaker defaults
    cb_failure_threshold: int = 5
    cb_recovery_timeout: int = 60
    cb_half_open_max_calls: int = 3

    # Mock provider behaviour (controllable for demos)
    mock_latency_ms: int = 300
    mock_failure_rate: float = 0.0
    mock_failure_type: str = "server_error"  # "server_error" | "timeout" | "rate_limit"


@lru_cache
def get_settings() -> Settings:
    return Settings()
