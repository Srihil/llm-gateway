"""
Gateway request pipeline.

Steps (in order):
  1. Rate limit check          → 429 if exceeded
  2. Budget check              → 402 if exceeded
  3. Cache lookup              → return cached response if hit
  4. Provider selection        → ordered list via router
  5. Execute with retry+CB     → try each provider with backoff
  6. Cache store               → persist on success
  7. Usage recording           → fire-and-forget Postgres write

Each step raises a typed exception that the API layer converts to HTTP.
"""
import asyncio
import time
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

import structlog
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.config import get_settings
from gateway.core.budget import BudgetEnforcer
from gateway.core.cache import ResponseCache
from gateway.core.circuit_breaker import CircuitBreaker
from gateway.core.rate_limiter import RateLimiter
from gateway.core.router import select_providers, update_ema_latency
from gateway.db.models import Provider as ProviderModel, Team, TeamPolicy
from gateway.db.repositories import usage as usage_repo
from gateway.observability.metrics import (
    BUDGET_REJECTIONS,
    CACHE_HITS,
    FALLBACKS,
    PROVIDER_FALLBACKS,
    RATE_LIMIT_REJECTIONS,
    REQUESTS,
    REQUEST_DURATION,
    RETRIES,
    TOKENS,
)
from gateway.providers.base import (
    BaseProvider,
    PermanentProviderError,
    ProviderError,
    ProviderResult,
    TemporaryProviderError,
    estimate_cost,
)
from gateway.providers.registry import get_provider
from gateway.schemas.chat import ChatRequest, ChatResponse

settings = get_settings()
log = structlog.get_logger()

MAX_RETRIES = 3
RETRY_BACKOFF = [0.5, 1.0, 2.0]  # seconds per attempt


class RateLimitExceeded(Exception):
    pass


class BudgetExceeded(Exception):
    pass


class NoProvidersAvailable(Exception):
    pass


@dataclass
class PipelineContext:
    request_id: str
    team: Team
    policy: TeamPolicy
    chat_request: ChatRequest
    providers_tried: list[str] = field(default_factory=list)
    result: Optional[ProviderResult] = None
    cached: bool = False


class GatewayPipeline:
    def __init__(
        self,
        redis: Redis,
        rate_limiter: RateLimiter,
        budget_enforcer: BudgetEnforcer,
        cache: ResponseCache,
        circuit_breaker: CircuitBreaker,
    ):
        self._redis = redis
        self._rate_limiter = rate_limiter
        self._budget_enforcer = budget_enforcer
        self._cache = cache
        self._cb = circuit_breaker

    async def process(
        self,
        request: ChatRequest,
        team: Team,
        policy: TeamPolicy,
        request_id: str,
        db: AsyncSession,
        all_providers: list[ProviderModel],
    ) -> ChatResponse:
        ctx = PipelineContext(
            request_id=request_id,
            team=team,
            policy=policy,
            chat_request=request,
        )
        start = time.perf_counter()

        # ── 1. Rate limit ──────────────────────────────────────────────────
        allowed = await self._rate_limiter.check(str(team.id), policy.max_rpm)
        if not allowed:
            RATE_LIMIT_REJECTIONS.labels(team=team.name).inc()
            asyncio.create_task(self._record_rejected(db, ctx, "rate_limited"))
            raise RateLimitExceeded(f"Team '{team.name}' has exceeded {policy.max_rpm} req/min")

        # ── 2. Budget ──────────────────────────────────────────────────────
        within_budget = await self._budget_enforcer.check(str(team.id), team.monthly_budget_usd)
        if not within_budget:
            BUDGET_REJECTIONS.labels(team=team.name).inc()
            asyncio.create_task(self._record_rejected(db, ctx, "budget_exceeded"))
            raise BudgetExceeded(f"Team '{team.name}' has exceeded its monthly budget")

        # ── 3. Cache lookup ────────────────────────────────────────────────
        cache_ttl = request.x_cache_ttl if request.x_cache_ttl is not None else settings.cache_default_ttl
        cache_key = self._cache.make_key(str(team.id), request)
        if cache_ttl > 0:
            cached_resp = await self._cache.get(cache_key)
            if cached_resp is not None:
                CACHE_HITS.labels(team=team.name).inc()
                REQUESTS.labels(team=team.name, provider="cache", model=request.model, status="success").inc()
                cached_resp.x_gateway_request_id = request_id
                cached_resp.x_gateway_cached = True
                cached_resp.x_gateway_latency_ms = int((time.perf_counter() - start) * 1000)
                return cached_resp

        # ── 4. Provider selection ──────────────────────────────────────────
        ordered_providers = await select_providers(
            request, policy, all_providers, self._cb, self._redis
        )
        if not ordered_providers:
            raise NoProvidersAvailable("No providers available for this request")

        # ── 5. Execute with retry + fallback ──────────────────────────────
        result = await self._execute(ctx, ordered_providers)

        # ── 6. Cache store ────────────────────────────────────────────────
        if cache_ttl > 0 and result is not None:
            await self._cache.set(cache_key, result.response, ttl=cache_ttl)

        # ── 7. Usage recording (non-blocking) ────────────────────────────
        latency_ms = int((time.perf_counter() - start) * 1000)
        asyncio.create_task(
            self._record_success(db, ctx, result, latency_ms, all_providers)
        )

        # Update EMA latency for performance routing
        asyncio.create_task(update_ema_latency(self._redis, result.provider_name, latency_ms))

        response = result.response
        response.x_gateway_request_id = request_id
        response.x_gateway_provider = result.provider_name
        response.x_gateway_cached = False
        response.x_gateway_cost_usd = result.cost_usd
        response.x_gateway_latency_ms = latency_ms
        return response

    async def _execute(
        self,
        ctx: PipelineContext,
        ordered_providers: list[ProviderModel],
    ) -> ProviderResult:
        last_error: Exception | None = None
        prev_provider: str | None = None

        for provider_model in ordered_providers:
            provider: BaseProvider | None = get_provider(provider_model.name)
            if provider is None:
                continue

            allowed = await self._cb.allow_request(str(provider_model.id))
            if not allowed:
                log.warning("circuit_breaker_open", provider=provider_model.name, request_id=ctx.request_id)
                continue

            if prev_provider is not None:
                PROVIDER_FALLBACKS.labels(from_provider=prev_provider, to_provider=provider_model.name).inc()
                FALLBACKS.labels(team=ctx.team.name).inc()

            for attempt in range(MAX_RETRIES):
                t0 = time.perf_counter()
                try:
                    response = await provider.chat_completion(ctx.chat_request)
                    latency_ms = int((time.perf_counter() - t0) * 1000)

                    input_tokens = response.usage.prompt_tokens if response.usage else 0
                    output_tokens = response.usage.completion_tokens if response.usage else 0
                    cost = estimate_cost(ctx.chat_request.model, input_tokens, output_tokens)

                    await self._cb.record_success(str(provider_model.id))
                    await self._budget_enforcer.add_spend(str(ctx.team.id), cost)

                    REQUESTS.labels(
                        team=ctx.team.name,
                        provider=provider_model.name,
                        model=ctx.chat_request.model,
                        status="success",
                    ).inc()
                    TOKENS.labels(team=ctx.team.name, provider=provider_model.name, model=ctx.chat_request.model, token_type="input").inc(input_tokens)
                    TOKENS.labels(team=ctx.team.name, provider=provider_model.name, model=ctx.chat_request.model, token_type="output").inc(output_tokens)

                    ctx.providers_tried.append(provider_model.name)
                    return ProviderResult(
                        response=response,
                        provider_name=provider_model.name,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        cost_usd=cost,
                        latency_ms=latency_ms,
                    )

                except TemporaryProviderError as e:
                    new_state = await self._cb.record_failure(str(provider_model.id))
                    RETRIES.labels(provider=provider_model.name).inc()
                    REQUESTS.labels(
                        team=ctx.team.name,
                        provider=provider_model.name,
                        model=ctx.chat_request.model,
                        status="error",
                    ).inc()
                    log.warning(
                        "provider_temporary_error",
                        provider=provider_model.name,
                        attempt=attempt + 1,
                        error=str(e),
                        cb_state=new_state,
                    )
                    last_error = e
                    if attempt < MAX_RETRIES - 1:
                        await asyncio.sleep(RETRY_BACKOFF[attempt])
                    # If CB just opened, stop retrying this provider
                    if await self._cb.is_open(str(provider_model.id)):
                        break

                except PermanentProviderError as e:
                    await self._cb.record_failure(str(provider_model.id))
                    REQUESTS.labels(
                        team=ctx.team.name,
                        provider=provider_model.name,
                        model=ctx.chat_request.model,
                        status="error",
                    ).inc()
                    log.error("provider_permanent_error", provider=provider_model.name, error=str(e))
                    last_error = e
                    break  # Don't retry permanent errors on this provider

            prev_provider = provider_model.name
            ctx.providers_tried.append(provider_model.name)

        raise NoProvidersAvailable(
            f"All providers failed. Tried: {ctx.providers_tried}. Last error: {last_error}"
        )

    async def _record_success(
        self,
        db: AsyncSession,
        ctx: PipelineContext,
        result: ProviderResult,
        latency_ms: int,
        all_providers: list[ProviderModel],
    ) -> None:
        provider_id = next(
            (p.id for p in all_providers if p.name == result.provider_name), None
        )
        try:
            async with db.begin():
                await usage_repo.record_usage(
                    db,
                    request_id=ctx.request_id,
                    team_id=ctx.team.id,
                    model=ctx.chat_request.model,
                    status="success",
                    input_tokens=result.input_tokens,
                    output_tokens=result.output_tokens,
                    cost_usd=Decimal(str(result.cost_usd)),
                    latency_ms=latency_ms,
                    cached=False,
                    provider_id=provider_id,
                )
        except Exception as e:
            log.error("usage_record_failed", error=str(e))

    async def _record_rejected(self, db: AsyncSession, ctx: PipelineContext, status: str) -> None:
        try:
            async with db.begin():
                await usage_repo.record_usage(
                    db,
                    request_id=ctx.request_id,
                    team_id=ctx.team.id,
                    model=ctx.chat_request.model,
                    status=status,
                )
        except Exception as e:
            log.error("usage_record_failed", error=str(e))
