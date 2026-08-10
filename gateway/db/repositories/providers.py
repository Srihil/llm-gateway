import uuid
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from gateway.db.models import Provider
from gateway.config import get_settings
from cryptography.fernet import Fernet
import base64

settings = get_settings()


def _fernet() -> Fernet:
    key = settings.gateway_secret_key
    # Pad or trim key to valid Fernet format if needed
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        # Fallback: derive a valid key from the secret
        import hashlib
        raw = hashlib.sha256(key.encode()).digest()
        return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_api_key(api_key: str) -> str:
    return _fernet().encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted: str) -> str:
    return _fernet().decrypt(encrypted.encode()).decode()


async def list_providers(db: AsyncSession) -> list[Provider]:
    result = await db.execute(select(Provider).order_by(Provider.priority))
    return list(result.scalars().all())


async def list_enabled_providers(db: AsyncSession) -> list[Provider]:
    result = await db.execute(
        select(Provider).where(Provider.is_enabled == True).order_by(Provider.priority)
    )
    return list(result.scalars().all())


async def get_provider_by_name(db: AsyncSession, name: str) -> Optional[Provider]:
    result = await db.execute(select(Provider).where(Provider.name == name))
    return result.scalar_one_or_none()


async def get_provider_by_id(db: AsyncSession, provider_id: uuid.UUID) -> Optional[Provider]:
    result = await db.execute(select(Provider).where(Provider.id == provider_id))
    return result.scalar_one_or_none()


async def upsert_provider(
    db: AsyncSession,
    name: str,
    base_url: str,
    priority: int = 100,
    api_key: Optional[str] = None,
    is_enabled: bool = True,
    models_config: Optional[dict] = None,
) -> Provider:
    existing = await get_provider_by_name(db, name)
    encrypted_key = encrypt_api_key(api_key) if api_key else None

    if existing:
        existing.base_url = base_url
        existing.priority = priority
        existing.is_enabled = is_enabled
        existing.models_config = models_config
        if encrypted_key:
            existing.api_key_encrypted = encrypted_key
        await db.commit()
        return existing

    provider = Provider(
        name=name,
        base_url=base_url,
        priority=priority,
        api_key_encrypted=encrypted_key,
        is_enabled=is_enabled,
        models_config=models_config,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


async def set_provider_enabled(db: AsyncSession, provider_id: uuid.UUID, enabled: bool) -> bool:
    result = await db.execute(
        update(Provider).where(Provider.id == provider_id).values(is_enabled=enabled)
    )
    await db.commit()
    return result.rowcount > 0
