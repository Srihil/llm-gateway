"""
Auto-seed: runs once on startup if no teams exist yet.
Called from lifespan so failures don't prevent the app from starting.
"""
from decimal import Decimal
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from gateway.db.repositories.teams import create_team, get_team_by_api_key
from gateway.db.repositories.providers import upsert_provider
from gateway.config import get_settings

log = structlog.get_logger()
settings = get_settings()

TEAMS = [
    {
        "name": "engineering",
        "api_key": "gw-engineering-team-key-demo",
        "monthly_budget_usd": Decimal("20.00"),
        "max_rpm": 100,
        "max_tpm": 200_000,
        "routing_strategy": "priority",
    },
    {
        "name": "marketing",
        "api_key": "gw-marketing-team-key-demo",
        "monthly_budget_usd": Decimal("5.00"),
        "max_rpm": 30,
        "max_tpm": 50_000,
        "routing_strategy": "cost",
    },
    {
        "name": "internal-tools",
        "api_key": "gw-internal-tools-key-demo",
        "monthly_budget_usd": Decimal("2.00"),
        "max_rpm": 10,
        "max_tpm": 20_000,
        "allowed_models": ["mock-gpt", "google/gemma-4-26b-a4b-it:free"],
        "routing_strategy": "priority",
    },
]

PROVIDERS = [
    {"name": "mock",        "base_url": "http://localhost:0",           "priority": 10,  "api_key": None,                          "is_enabled": True},
    {"name": "openrouter",  "base_url": "https://openrouter.ai/api/v1", "priority": 20,  "api_key": settings.openrouter_api_key,   "is_enabled": bool(settings.openrouter_api_key)},
    {"name": "anthropic",   "base_url": "https://api.anthropic.com/v1", "priority": 30,  "api_key": settings.anthropic_api_key,    "is_enabled": bool(settings.anthropic_api_key)},
    {"name": "openai",      "base_url": "https://api.openai.com/v1",    "priority": 40,  "api_key": settings.openai_api_key,       "is_enabled": bool(settings.openai_api_key)},
    {"name": "ollama",      "base_url": settings.ollama_base_url,       "priority": 50,  "api_key": None,                          "is_enabled": True},
]


async def auto_seed(db: AsyncSession) -> None:
    existing = await get_team_by_api_key(db, "gw-engineering-team-key-demo")
    if existing:
        log.info("seed_skipped", reason="teams already exist")
        return

    log.info("auto_seeding_start")
    for p in PROVIDERS:
        await upsert_provider(db, **p)

    for t in TEAMS:
        await create_team(db, **t)

    log.info("auto_seeding_done", teams=len(TEAMS), providers=len(PROVIDERS))
