"""
Seed the gateway with test teams and providers.
Run: python scripts/seed.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from decimal import Decimal
from gateway.db.session import AsyncSessionLocal, engine
from gateway.db.models import Base
from gateway.db.repositories.teams import create_team, get_team_by_api_key
from gateway.db.repositories.providers import upsert_provider
from gateway.config import get_settings

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
        "allowed_models": ["mock-gpt", "meta-llama/llama-3.1-8b-instruct:free"],
        "routing_strategy": "priority",
    },
]

PROVIDERS = [
    {
        "name": "mock",
        "base_url": "http://localhost:0",
        "priority": 10,  # Highest priority for demos (no cost)
        "api_key": None,
        "is_enabled": True,
        "models_config": {"default_model": "mock-gpt"},
    },
    {
        "name": "openrouter",
        "base_url": "https://openrouter.ai/api/v1",
        "priority": 20,
        "api_key": settings.openrouter_api_key,
        "is_enabled": bool(settings.openrouter_api_key),
        "models_config": {"free_models": ["meta-llama/llama-3.1-8b-instruct:free"]},
    },
    {
        "name": "anthropic",
        "base_url": "https://api.anthropic.com/v1",
        "priority": 30,
        "api_key": settings.anthropic_api_key,
        "is_enabled": bool(settings.anthropic_api_key),
        "models_config": {},
    },
    {
        "name": "openai",
        "base_url": "https://api.openai.com/v1",
        "priority": 40,
        "api_key": settings.openai_api_key,
        "is_enabled": bool(settings.openai_api_key),
        "models_config": {},
    },
    {
        "name": "ollama",
        "base_url": settings.ollama_base_url,
        "priority": 50,
        "api_key": None,
        "is_enabled": True,
        "models_config": {},
    },
]


async def main():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        print("\n== Seeding providers ==================================")
        for p in PROVIDERS:
            provider = await upsert_provider(db, **p)
            status = "enabled" if provider.is_enabled else "disabled (no API key)"
            print(f"  [{status:30s}] {provider.name} (priority={provider.priority})")

        print("\n== Seeding teams ======================================")
        for t in TEAMS:
            existing = await get_team_by_api_key(db, t["api_key"])
            if existing:
                print(f"  [already exists      ] {t['name']}")
                continue
            team = await create_team(db, **t)
            print(f"  [created             ] {team.name}")
            print(f"    API key : {t['api_key']}")
            print(f"    Budget  : ${team.monthly_budget_usd}/month")
            print(f"    RPM     : {t['max_rpm']}")

    print("\n== Done ===============================================")
    print("Gateway API keys for testing:")
    for t in TEAMS:
        print(f"  {t['name']:20s}  {t['api_key']}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
