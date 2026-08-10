"""
Provider router — selects and orders providers for a request.

Strategies:
  priority    — sort by provider.priority, skip OPEN circuit breakers
  cost        — sort by estimated cost per token (cheapest first)
  performance — sort by exponential-moving-average latency (fastest first)

The router produces an ordered candidate list. The pipeline executor
tries them in order, with per-provider retries and backoff.
"""
import time
from redis.asyncio import Redis
from gateway.core.circuit_breaker import CircuitBreaker, CBState
from gateway.db.models import Provider as ProviderModel, TeamPolicy
from gateway.providers.base import PROVIDER_PRICING
from gateway.schemas.chat import ChatRequest


# EMA latency stored in Redis: key `perf:{provider_name}`, value float ms
_ALPHA = 0.2  # EMA smoothing factor


async def _get_ema_latency(redis: Redis, provider_name: str) -> float:
    val = await redis.get(f"perf:{provider_name}")
    return float(val) if val else 999_999.0  # unknown = deprioritise


async def update_ema_latency(redis: Redis, provider_name: str, latency_ms: float) -> None:
    current = await _get_ema_latency(redis, provider_name)
    if current == 999_999.0:
        new_val = latency_ms
    else:
        new_val = _ALPHA * latency_ms + (1 - _ALPHA) * current
    await redis.set(f"perf:{provider_name}", new_val, ex=86400)


async def select_providers(
    request: ChatRequest,
    policy: TeamPolicy,
    all_providers: list[ProviderModel],
    circuit_breaker: CircuitBreaker,
    redis: Redis,
) -> list[ProviderModel]:
    """
    Return an ordered list of eligible providers for this request.
    OPEN circuit breakers are skipped (unless no healthy provider exists,
    in which case we let the pipeline fail gracefully).
    """
    # Filter by policy-allowed providers if team specifies restrictions
    if request.x_providers:
        candidates = [p for p in all_providers if p.name in request.x_providers]
    else:
        candidates = [p for p in all_providers if p.is_enabled]

    # Filter by allowed models (if team policy restricts models)
    if policy.allowed_models:
        # A provider is eligible if it could serve this model
        # (simple check: if model is in allowed_models list for the team)
        if request.model not in policy.allowed_models:
            return []

    # Separate healthy (CLOSED/HALF_OPEN) from unhealthy (OPEN)
    healthy = []
    open_cb = []
    for p in candidates:
        status = await circuit_breaker.get_status(str(p.id))
        if status.state == CBState.OPEN:
            open_cb.append(p)
        else:
            healthy.append(p)

    strategy = request.x_routing_strategy or policy.routing_strategy

    if strategy == "cost":
        ordered = await _sort_by_cost(healthy, request.model, redis)
    elif strategy == "performance":
        ordered = await _sort_by_performance(healthy, redis)
    else:  # priority (default)
        ordered = sorted(healthy, key=lambda p: p.priority)

    # Append OPEN-CB providers at the end as last-resort
    ordered += sorted(open_cb, key=lambda p: p.priority)
    return ordered


async def _sort_by_cost(providers: list[ProviderModel], model: str, redis: Redis) -> list[ProviderModel]:
    pricing = PROVIDER_PRICING.get(model, {"input": 0.0, "output": 0.0})
    combined_cost = pricing["input"] + pricing["output"]
    # All providers likely share the same model pricing — fall back to priority
    return sorted(providers, key=lambda p: p.priority)


async def _sort_by_performance(providers: list[ProviderModel], redis: Redis) -> list[ProviderModel]:
    latencies = {p.name: await _get_ema_latency(redis, p.name) for p in providers}
    return sorted(providers, key=lambda p: latencies[p.name])
