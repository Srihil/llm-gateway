"""
LLM Gateway — FastAPI application entry point.
"""
from contextlib import asynccontextmanager
import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app
from redis.asyncio import Redis

from gateway.config import get_settings
from gateway.core.budget import BudgetEnforcer
from gateway.core.cache import ResponseCache
from gateway.core.circuit_breaker import CircuitBreaker
from gateway.core.pipeline import GatewayPipeline
from gateway.core.rate_limiter import RateLimiter
from gateway.db.models import Base
from gateway.db.repositories.providers import list_enabled_providers
from gateway.db.session import engine, AsyncSessionLocal
from gateway.middleware.auth import AuthMiddleware
from gateway.middleware.request_id import RequestIDMiddleware
from gateway.observability.logging import setup_logging
from gateway.observability.tracing import setup_tracing
from gateway.providers.registry import rebuild_from_db
from gateway.seed import auto_seed
from gateway.api.v1.chat import router as chat_router
from gateway.api.admin.teams import router as teams_router
from gateway.api.admin.providers import router as providers_router
from gateway.api.admin.usage import router as usage_router

settings = get_settings()
log = structlog.get_logger()

CORS_HEADERS = {"Access-Control-Allow-Origin": "*"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    log.info("gateway_starting", version="0.1.0")

    # Create DB tables (idempotent)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        log.info("db_tables_ready")
    except Exception as e:
        log.error("db_init_failed", error=str(e))
        raise

    # Normalise Redis URL: Upstash requires SSL (rediss://).
    # Auto-upgrade redis:// → rediss:// if the host is Upstash.
    redis_url = settings.redis_url
    if "upstash.io" in redis_url and redis_url.startswith("redis://"):
        redis_url = "rediss://" + redis_url[len("redis://"):]
        log.info("redis_url_upgraded_to_ssl")

    redis_kwargs: dict = {"decode_responses": False}
    if redis_url.startswith("rediss://"):
        redis_kwargs["ssl_cert_reqs"] = None  # Upstash: skip cert verification
    else:
        redis_kwargs["protocol"] = 2           # Local Redis 3.x needs RESP2

    redis = Redis.from_url(redis_url, **redis_kwargs)

    # Verify Redis is reachable (non-fatal — app starts even if Redis is down)
    try:
        await redis.ping()
        log.info("redis_connected")
    except Exception as e:
        log.warning("redis_ping_failed", error=str(e),
                    hint="rate limiting and caching will not work until Redis is reachable")

    app.state.redis = redis

    # Core services
    rate_limiter = RateLimiter(redis)
    budget_enforcer = BudgetEnforcer(redis)
    cache = ResponseCache(redis)
    circuit_breaker = CircuitBreaker(redis)

    app.state.rate_limiter = rate_limiter
    app.state.budget_enforcer = budget_enforcer
    app.state.cache = cache
    app.state.circuit_breaker = circuit_breaker

    # Auto-seed teams and providers on first run (safe to run multiple times)
    try:
        async with AsyncSessionLocal() as db:
            await auto_seed(db)
    except Exception as e:
        log.warning("auto_seed_failed", error=str(e))  # non-fatal

    # Load provider registry from DB
    try:
        async with AsyncSessionLocal() as db:
            providers = await list_enabled_providers(db)
            rebuild_from_db(providers)
        log.info("providers_loaded", count=len(providers), names=[p.name for p in providers])
    except Exception as e:
        log.error("provider_load_failed", error=str(e))
        raise

    # Build pipeline
    app.state.pipeline = GatewayPipeline(
        redis=redis,
        rate_limiter=rate_limiter,
        budget_enforcer=budget_enforcer,
        cache=cache,
        circuit_breaker=circuit_breaker,
    )

    setup_tracing(app)
    log.info("gateway_ready", host="0.0.0.0", port=8000)
    yield

    await redis.aclose()
    await engine.dispose()
    log.info("gateway_shutdown")


app = FastAPI(
    title="LLM Gateway",
    description="Multi-provider LLM Gateway with routing, rate limiting, circuit breaking, and observability",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Global exception handler — ensures CORS headers are always present ─────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error("unhandled_exception", path=request.url.path, error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
        headers=CORS_HEADERS,
    )

# ── Middleware (last added = outermost = runs first) ───────────────────────
app.add_middleware(AuthMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Gateway-Provider"],
)

# ── Routes ─────────────────────────────────────────────────────────────────
app.include_router(chat_router, prefix="/v1", tags=["completions"])
app.include_router(teams_router, prefix="/admin/teams", tags=["admin"])
app.include_router(providers_router, prefix="/admin/providers", tags=["admin"])
app.include_router(usage_router, prefix="/admin/usage", tags=["admin"])

# Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": "llm-gateway", "version": "0.1.0"}
