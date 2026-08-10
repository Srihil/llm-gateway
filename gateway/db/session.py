from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from gateway.config import get_settings

settings = get_settings()

# Render's managed Postgres requires SSL; detect by checking URL host
_ssl = {"ssl": "require"} if "render.com" in settings.database_url else {}

engine = create_async_engine(
    settings.database_url,
    connect_args=_ssl,
    pool_size=5,
    max_overflow=10,
    echo=settings.debug,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
