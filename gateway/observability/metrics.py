from prometheus_client import Counter, Gauge, Histogram

REQUESTS = Counter(
    "llm_gateway_requests_total",
    "Total LLM requests",
    ["team", "provider", "model", "status"],
)

REQUEST_DURATION = Histogram(
    "llm_gateway_request_duration_seconds",
    "End-to-end request latency",
    ["team", "provider", "model", "status"],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0],
)

PROVIDER_LATENCY = Histogram(
    "llm_gateway_provider_request_duration_seconds",
    "Provider-level latency",
    ["provider", "model", "status"],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0],
)

CACHE_HITS = Counter(
    "llm_gateway_cache_hits_total",
    "Cache hits",
    ["team"],
)

RATE_LIMIT_REJECTIONS = Counter(
    "llm_gateway_rate_limit_rejections_total",
    "Requests rejected due to rate limiting",
    ["team"],
)

BUDGET_REJECTIONS = Counter(
    "llm_gateway_budget_rejections_total",
    "Requests rejected due to budget exceeded",
    ["team"],
)

RETRIES = Counter(
    "llm_gateway_provider_retries_total",
    "Provider retry attempts",
    ["provider"],
)

PROVIDER_FALLBACKS = Counter(
    "llm_gateway_provider_fallbacks_total",
    "Fallbacks between providers",
    ["from_provider", "to_provider"],
)

FALLBACKS = Counter(
    "llm_gateway_fallbacks_total",
    "Total fallback events",
    ["team"],
)

TOKENS = Counter(
    "llm_gateway_tokens_total",
    "Token consumption",
    ["team", "provider", "model", "token_type"],
)

CIRCUIT_BREAKER_STATE = Gauge(
    "llm_gateway_circuit_breaker_state",
    "Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)",
    ["provider"],
)

BUDGET_USED_RATIO = Gauge(
    "llm_gateway_budget_used_ratio",
    "Budget usage ratio (0.0–1.0+)",
    ["team"],
)

ACTIVE_REQUESTS = Gauge(
    "llm_gateway_active_requests",
    "Currently in-flight requests",
    ["team"],
)
