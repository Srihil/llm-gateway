# LLM Gateway — Complete Guide
## What It Is, Why It Matters, and How to Test It

---

## PART 1 — WHAT IS THIS PROJECT? (Simple English)

### The Problem This Solves

Imagine you work at a company that uses AI — maybe to write emails, answer customer questions, summarize documents, or generate code.

You use OpenAI (GPT-4), Anthropic (Claude), and Google (Gemini).

Without a gateway, here's what happens:

```
Engineering team  ──────────────────────────────► OpenAI directly
Marketing team    ──────────────────────────────► Anthropic directly
Support team      ──────────────────────────────► OpenAI directly
```

**Problems that appear immediately:**

| Problem | What happens |
|---|---|
| API keys everywhere | Every app, every developer holds a real API key. If one leaks, you're paying someone else's bill |
| No spending control | Marketing accidentally sends 10,000 requests in one day. Bill is $500. Nobody knew. |
| No fallback | OpenAI goes down at 2am. Your product is broken. Nobody is routing around it. |
| No visibility | "How many tokens did we use last month?" Nobody knows. |
| Different APIs | OpenAI, Anthropic, and Gemini all have different request formats. Every app has to handle all of them. |
| Rate limits hit randomly | One team floods OpenAI. Now everyone in the company gets 429 errors. |

### The Solution — A Gateway

You put one service in the middle. Every team talks to the gateway. The gateway talks to the providers.

```
Engineering team  ─────┐
Marketing team    ──────┤──► LLM GATEWAY ──► OpenAI / Anthropic / OpenRouter
Support team      ─────┘
```

Now the gateway handles **everything**:

- **Authentication** — teams use gateway keys, never real provider keys
- **Rate limiting** — Engineering gets 100 req/min, Marketing gets 30, Support gets 10
- **Budget enforcement** — Marketing has a $5/month cap. When it's hit, requests are blocked, not just warned
- **Fallback** — OpenAI down? Gateway automatically retries, then switches to Anthropic
- **Circuit breaker** — Provider failing repeatedly? Gateway stops sending traffic there until it recovers
- **Caching** — Same question asked 100 times? Only 1 real API call. 99 served from cache in 2ms
- **Observability** — Dashboards showing exactly who used what, when, how much it cost

### The Real-World Analogy

Think of it like a **corporate expense card system**.

Without it: every employee has their own credit card. Some spend $10, some spend $10,000. Nobody knows total spend until the bill arrives.

With it: every employee submits requests to a finance system. The system approves or denies based on team budgets, logs everything, and routes to the cheapest option.

The LLM Gateway is that finance system, but for AI API calls.

---

## PART 2 — WHY THIS IMPRESSES RECRUITERS

This is not a chatbot. This is not a wrapper around ChatGPT. This is **infrastructure engineering**.

### What Interviewers Will See

When you say "I built an LLM Gateway," a senior engineer immediately understands:

| What you built | What skill it demonstrates |
|---|---|
| Redis token bucket rate limiter | Distributed systems, atomic operations, concurrency |
| Circuit breaker with OPEN/HALF_OPEN/CLOSED states | Reliability engineering, fault tolerance patterns |
| Async request pipeline with retry and fallback | Resilient systems design |
| Tenant-isolated Redis cache | Security, multi-tenancy, cache design |
| PostgreSQL budget tracking with atomic UPSERT | Database design, financial-grade data integrity |
| Prometheus metrics + Grafana dashboards | Production observability, SRE skills |
| OpenTelemetry request tracing | Distributed tracing, debugging complex systems |
| Provider abstraction layer | Clean architecture, extensibility, OOP |
| FastAPI async backend | Modern Python, async programming |

### The Interview Answer

When asked "Tell me about a project":

> "I built a multi-provider LLM Gateway — essentially the infrastructure layer that sits between applications and AI providers like OpenAI and Anthropic. It handles per-team rate limiting using a Redis token bucket, monthly budget enforcement with automatic blocking, provider failover with circuit breaking so one bad provider doesn't take down the system, response caching with tenant isolation so teams can't see each other's data, and full observability through Prometheus metrics and distributed tracing. The whole thing runs locally at zero cost using a mock provider for testing."

That one paragraph demonstrates: distributed systems, reliability patterns, security, observability, API design, and cost engineering. All in one project.

### What Makes It Different From a "Student Project"

| Student project | This project |
|---|---|
| Works when everything is fine | Handles failures gracefully |
| One user | Multi-tenant with isolation |
| No monitoring | 28 Prometheus metric series |
| One provider, hardcoded | Provider abstraction, swappable |
| No cost awareness | Per-team budget enforcement |
| No rate limiting | Atomic Redis token bucket |
| No tests | 20 unit tests |

---

## PART 3 — HOW THE SYSTEM WORKS (Technical Walk-through)

### What happens when a team sends a request

```
Team sends: POST /v1/chat/completions
              │
              ▼
         [Auth Middleware]
         Is API key valid? Which team is this?
         If invalid → 401 Unauthorized
              │
              ▼
         [Rate Limiter]
         Has this team used their req/min quota?
         If yes → 429 Too Many Requests
              │
              ▼
         [Budget Check]
         Has this team hit their monthly $ limit?
         If yes → 402 Payment Required
              │
              ▼
         [Cache Check]
         Has this exact question been answered before (for this team)?
         If yes → return cached answer in ~2ms (no LLM call)
              │
              ▼ (cache miss)
         [Router]
         Which provider should handle this?
         (priority / cost / performance strategy)
              │
              ▼
         [Execute with Retry + Circuit Breaker]
         Try Provider A → failed? → retry → retry → failed?
         Circuit Breaker opens → skip Provider A
         Try Provider B → success!
              │
              ▼
         [Cache Store]
         Save response in Redis for next time
              │
              ▼
         [Usage Recording]
         Write tokens used, cost, latency to PostgreSQL (async)
              │
              ▼
         Return response to team
```

### The Three Teams

| Team | API Key | RPM Limit | Monthly Budget | Routing |
|---|---|---|---|---|
| engineering | gw-engineering-team-key-demo | 100/min | $20 | priority |
| marketing | gw-marketing-team-key-demo | 30/min | $5 | cost |
| internal-tools | gw-internal-tools-key-demo | 10/min | $2 | priority |

### The Providers (in priority order)

| Priority | Provider | Status | Cost |
|---|---|---|---|
| 1st | mock | Always enabled | Free (no API calls) |
| 2nd | openrouter | Enabled (your key) | Free tier available |
| 3rd | anthropic | Needs API key | Paid |
| 4th | openai | Needs API key | Paid |
| 5th | ollama | Enabled (needs Ollama running) | Free (local) |

---

## PART 4 — TESTING CHECKLIST

> **Before starting:** The gateway must be running.
> Open a terminal, go to the project folder, and run:
> `python -m uvicorn gateway.main:app --host 127.0.0.1 --port 8000`
>
> Keep that terminal open. Open a second terminal for testing.

---

### SETUP

- [ ] **S0.1** — Open a browser and go to `http://127.0.0.1:8000/docs`
  - You should see the Swagger UI with all API endpoints
  - This is the interactive API documentation

- [ ] **S0.2** — Open a browser and go to `http://127.0.0.1:8000/health`
  - You should see: `{"status":"ok","service":"llm-gateway","version":"0.1.0"}`
  - This confirms the gateway is running

- [ ] **S0.3** — Check Prometheus metrics at `http://127.0.0.1:8000/metrics`
  - You should see a wall of text with metric names starting with `llm_gateway_`

---

### SCENARIO 1 — Normal Request (Mock Provider)

**What we're testing:** A team sends a request. The gateway authenticates them, checks their quota, and returns a response from the mock provider.

Run this in PowerShell:
```powershell
$body = '{"model":"mock-gpt","messages":[{"role":"user","content":"What is an API gateway?"}]}'
$resp = Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST `
    -Headers @{"Authorization"="Bearer gw-engineering-team-key-demo";"Content-Type"="application/json"} `
    -Body $body
$resp | ConvertTo-Json -Depth 5
```

**What to look for:**
- [ ] `x_gateway_provider` = "mock"
- [ ] `x_gateway_cached` = False
- [ ] `x_gateway_request_id` = a UUID (unique per request)
- [ ] `choices[0].message.content` = a reply starting with "[Mock response #...]"
- [ ] `usage.prompt_tokens` and `usage.completion_tokens` are numbers

---

### SCENARIO 2 — Real LLM Request (OpenRouter)

**What we're testing:** The gateway routes a request to a real AI provider and returns a real LLM response.

```powershell
$body = @{
    model    = "google/gemma-4-26b-a4b-it:free"
    messages = @(@{ role = "user"; content = "What is 1+1? Answer in one word." })
    x_providers = @("openrouter")
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST `
    -Headers @{"Authorization"="Bearer gw-engineering-team-key-demo";"Content-Type"="application/json"} `
    -Body $body -TimeoutSec 60
$resp | ConvertTo-Json -Depth 5
```

**What to look for:**
- [ ] `x_gateway_provider` = "openrouter"
- [ ] `x_gateway_cached` = False
- [ ] `choices[0].message.content` = "Two" or "2" — a real LLM answer
- [ ] `x_gateway_latency_ms` = probably 3000–15000 (real network call)
- [ ] `usage.prompt_tokens` and `usage.completion_tokens` = real numbers from the provider

---

### SCENARIO 3 — Response Cache (Same Request = No LLM Call)

**What we're testing:** Send the same request twice. First call hits the LLM. Second call is served from Redis cache in ~2ms. No second API call made.

```powershell
$body = @{
    model       = "google/gemma-4-26b-a4b-it:free"
    messages    = @(@{ role = "user"; content = "Name the capital of Japan in one word." })
    x_providers = @("openrouter")
    x_cache_ttl = 3600
} | ConvertTo-Json -Depth 5

$headers = @{"Authorization"="Bearer gw-engineering-team-key-demo";"Content-Type"="application/json"}

Write-Host "=== First request (real LLM call) ==="
$r1 = Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST -Headers $headers -Body $body -TimeoutSec 60
Write-Host "Cached: $($r1.x_gateway_cached) | Latency: $($r1.x_gateway_latency_ms)ms"
Write-Host "Reply: $($r1.choices[0].message.content)"

Write-Host ""
Write-Host "=== Second request (should hit cache) ==="
$r2 = Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST -Headers $headers -Body $body -TimeoutSec 10
Write-Host "Cached: $($r2.x_gateway_cached) | Latency: $($r2.x_gateway_latency_ms)ms"
Write-Host "Reply: $($r2.choices[0].message.content)"
```

**What to look for:**
- [ ] First request: `x_gateway_cached` = False, latency in seconds
- [ ] Second request: `x_gateway_cached` = True, latency < 10ms
- [ ] Both replies are identical (same cached content)
- [ ] **Key point for interviews:** "The gateway saved an API call, reduced latency by 1000x, and the user got a faster response"

---

### SCENARIO 4 — Tenant Isolation (Teams Cannot Share Cache)

**What we're testing:** Engineering and marketing send the same question. Engineering's cached response must NOT be visible to marketing. Each team has completely separate cache keys.

```powershell
$question = @{
    model       = "mock-gpt"
    messages    = @(@{ role = "user"; content = "isolation test question ABC" })
    x_cache_ttl = 3600
} | ConvertTo-Json -Depth 5

# Engineering team gets their own cache entry
$eng = Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST `
    -Headers @{"Authorization"="Bearer gw-engineering-team-key-demo";"Content-Type"="application/json"} `
    -Body $question

# Engineering asks again — should be cached
$eng2 = Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST `
    -Headers @{"Authorization"="Bearer gw-engineering-team-key-demo";"Content-Type"="application/json"} `
    -Body $question

# Marketing asks the same question — must NOT see engineering's cache
$mkt = Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST `
    -Headers @{"Authorization"="Bearer gw-marketing-team-key-demo";"Content-Type"="application/json"} `
    -Body $question

Write-Host "Engineering first call cached: $($eng.x_gateway_cached)"   # False
Write-Host "Engineering second call cached: $($eng2.x_gateway_cached)"  # True
Write-Host "Marketing call cached: $($mkt.x_gateway_cached)"            # Must be False
```

**What to look for:**
- [ ] Engineering 1st call: `cached = False`
- [ ] Engineering 2nd call: `cached = True`
- [ ] Marketing call: `cached = False` — **this is the key result**
- [ ] **Why this matters:** If marketing could see engineering's cached data, that's a security violation. One team's prompts/responses would leak to another team.

---

### SCENARIO 5 — Authentication (Invalid Key = 401)

**What we're testing:** A request with a wrong API key is rejected before it even reaches the rate limiter or providers.

```powershell
try {
    Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST `
        -Headers @{"Authorization"="Bearer completely-fake-key";"Content-Type"="application/json"} `
        -Body '{"model":"mock-gpt","messages":[{"role":"user","content":"hack"}]}'
} catch {
    Write-Host "Status code: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Error: $($_.ErrorDetails.Message)"
}
```

**What to look for:**
- [ ] Status code = 401
- [ ] Error message mentions "Invalid API key"
- [ ] **No LLM provider was called** (the gateway stopped it before that)

---

### SCENARIO 6 — Rate Limiting (Too Many Requests = 429)

**What we're testing:** The internal-tools team is limited to 10 requests per minute. Send 15 rapid requests. The last 5 should be blocked.

```powershell
Write-Host "Sending 15 rapid requests to internal-tools (limit: 10/min)..."
$ok = 0; $blocked = 0

for ($i = 1; $i -le 15; $i++) {
    try {
        Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST `
            -Headers @{"Authorization"="Bearer gw-internal-tools-key-demo";"Content-Type"="application/json"} `
            -Body "{`"model`":`"mock-gpt`",`"messages`":[{`"role`":`"user`",`"content`":`"request number $i`"}]}" | Out-Null
        $ok++
        Write-Host "  Request $i : OK (200)"
    } catch {
        $blocked++
        Write-Host "  Request $i : BLOCKED ($($_.Exception.Response.StatusCode.value__))"
    }
}
Write-Host ""
Write-Host "Result: $ok allowed, $blocked rate-limited (429)"
```

**What to look for:**
- [ ] First ~10 requests: status 200
- [ ] Remaining requests: status 429
- [ ] Error message mentions "exceeded" and the team name
- [ ] **Key point:** The gateway blocks at the token bucket level — no request even reaches a provider once the bucket is empty

---

### SCENARIO 7 — Budget Enforcement (Over Budget = 402)

**What we're testing:** Check the current budget status for all teams via the admin API.

```powershell
$budget = Invoke-RestMethod "http://127.0.0.1:8000/admin/usage/budget" `
    -Headers @{"X-Admin-Key"="admin-secret-change-in-production"}

Write-Host "=== Budget Status ==="
$budget | ForEach-Object {
    Write-Host "Team: $($_.team_name.PadRight(20))  Spent: `$$($_.spent_usd)  Budget: `$$($_.monthly_budget_usd)  Used: $($_.budget_used_pct)%"
}
```

**What to look for:**
- [ ] All 3 teams appear (engineering, marketing, internal-tools)
- [ ] Each shows `spent_usd`, `monthly_budget_usd`, `budget_used_pct`
- [ ] **To see enforcement in action:** If `spent_usd` ever exceeds `monthly_budget_usd`, the next request returns 402

---

### SCENARIO 8 — Provider Fallback (Primary Down = Use Secondary)

**What we're testing:** Disable the mock provider (simulating it being down). The gateway should fail to serve requests through mock, and since OpenRouter requires a real model (not mock-gpt), it returns 503. Re-enable mock and requests succeed again.

```powershell
# Get the mock provider's ID
$providers = Invoke-RestMethod "http://127.0.0.1:8000/admin/providers" `
    -Headers @{"X-Admin-Key"="admin-secret-change-in-production"}
$mockId = ($providers | Where-Object { $_.name -eq "mock" }).id
Write-Host "Mock provider ID: $mockId"

# Disable mock
Invoke-RestMethod "http://127.0.0.1:8000/admin/providers/$mockId/disable" -Method POST `
    -Headers @{"X-Admin-Key"="admin-secret-change-in-production"} | Out-Null
Write-Host "Mock provider disabled."

# Send a request — should fail (no provider can handle mock-gpt)
try {
    Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST `
        -Headers @{"Authorization"="Bearer gw-engineering-team-key-demo";"Content-Type"="application/json"} `
        -Body '{"model":"mock-gpt","messages":[{"role":"user","content":"hello"}]}'
    Write-Host "ERROR: Should have failed!"
} catch {
    Write-Host "Got expected error: $($_.Exception.Response.StatusCode.value__) (503 = all providers exhausted)"
}

# Re-enable mock
Invoke-RestMethod "http://127.0.0.1:8000/admin/providers/$mockId/enable" -Method POST `
    -Headers @{"X-Admin-Key"="admin-secret-change-in-production"} | Out-Null
Write-Host "Mock provider re-enabled."

# Now it works again
$r = Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST `
    -Headers @{"Authorization"="Bearer gw-engineering-team-key-demo";"Content-Type"="application/json"} `
    -Body '{"model":"mock-gpt","messages":[{"role":"user","content":"back to normal"}]}'
Write-Host "Back to normal: provider=$($r.x_gateway_provider)"
```

**What to look for:**
- [ ] After disabling mock: request returns 503 with "All providers failed"
- [ ] After re-enabling mock: request succeeds with provider=mock
- [ ] **The point:** In production, this is automatic. A provider going down triggers retries and fallback without the team ever knowing.

---

### SCENARIO 9 — Circuit Breaker State Inspection

**What we're testing:** Look at circuit breaker states for all providers via the admin API.

```powershell
$providers = Invoke-RestMethod "http://127.0.0.1:8000/admin/providers" `
    -Headers @{"X-Admin-Key"="admin-secret-change-in-production"}

Write-Host "=== Provider + Circuit Breaker Status ==="
$providers | ForEach-Object {
    $status = if ($_.is_enabled) { "enabled " } else { "disabled" }
    $reg    = if ($_.is_registered) { "registered  " } else { "unregistered" }
    Write-Host "  $($_.name.PadRight(12)) | $status | $reg | CB: $($_.circuit_breaker_state)"
}
```

**What to look for:**
- [ ] mock: enabled, registered, CB=closed
- [ ] openrouter: enabled, registered, CB=closed
- [ ] anthropic/openai: disabled, unregistered (no API key)
- [ ] **CB states explained:**
  - `closed` = healthy, requests flowing normally
  - `open` = too many failures, requests are rejected immediately (fast fail)
  - `half_open` = recovery probe — one test request allowed through

---

### SCENARIO 10 — Observability: Prometheus Metrics

**What we're testing:** The gateway exposes all its internal behavior as Prometheus metrics — requests, errors, cache hits, tokens, circuit breaker state, etc.

```powershell
# Generate some traffic first
for ($i = 0; $i -lt 5; $i++) {
    Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST `
        -Headers @{"Authorization"="Bearer gw-engineering-team-key-demo";"Content-Type"="application/json"} `
        -Body '{"model":"mock-gpt","messages":[{"role":"user","content":"metrics test"}],"x_cache_ttl":0}' | Out-Null
}

# Fetch and display gateway-specific metrics
$metrics = Invoke-RestMethod "http://127.0.0.1:8000/metrics"
$lines = $metrics -split "`n" | Where-Object { $_ -match "^llm_gateway_" -and $_ -notmatch "^#" }

Write-Host "=== Live Gateway Metrics ==="
$lines | ForEach-Object { Write-Host "  $_" }
```

**What to look for:**
- [ ] `llm_gateway_requests_total{...}` — counts by team, provider, model, status
- [ ] `llm_gateway_cache_hits_total{...}` — cache hits by team
- [ ] `llm_gateway_tokens_total{...}` — token consumption by team/provider
- [ ] Multiple labels on each metric (team, provider, model) — this is what allows Grafana to slice the data by any dimension

---

### SCENARIO 11 — Usage Analytics (Admin API)

**What we're testing:** The admin can see how much each team has used — requests, tokens, cost — over any time window.

```powershell
Write-Host "=== Usage by Team (last 24 hours) ==="
$usage = Invoke-RestMethod "http://127.0.0.1:8000/admin/usage/by-team?since_hours=24" `
    -Headers @{"X-Admin-Key"="admin-secret-change-in-production"}
$usage | ForEach-Object {
    Write-Host "Team: $($_.team_name)"
    Write-Host "  Requests    : $($_.request_count)"
    Write-Host "  Input tokens: $($_.total_input_tokens)"
    Write-Host "  Output tokens: $($_.total_output_tokens)"
    Write-Host "  Total cost  : `$$($_.total_cost_usd)"
    Write-Host "  Budget used : $($_.budget_used_ratio * 100)%"
    Write-Host ""
}

Write-Host "=== Usage by Provider (last 24 hours) ==="
$prov = Invoke-RestMethod "http://127.0.0.1:8000/admin/usage/by-provider?since_hours=24" `
    -Headers @{"X-Admin-Key"="admin-secret-change-in-production"}
$prov | ForEach-Object {
    Write-Host "  Model: $($_.model) | Requests: $($_.request_count) | Tokens: $($_.total_input_tokens)+$($_.total_output_tokens)"
}
```

**What to look for:**
- [ ] Teams appear with request counts and token totals
- [ ] Provider breakdown shows which models were used
- [ ] **This is the "finance dashboard" for AI spend**

---

### SCENARIO 12 — OpenRouter with Different Routing

**What we're testing:** The engineering team normally hits mock first (priority routing). Force a request to go to OpenRouter by specifying `x_providers`.

```powershell
$body = @{
    model       = "google/gemma-4-26b-a4b-it:free"
    messages    = @(@{ role = "user"; content = "What are 3 benefits of API gateways? Be brief." })
    x_providers = @("openrouter")
    x_cache_ttl = 0
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod "http://127.0.0.1:8000/v1/chat/completions" -Method POST `
    -Headers @{"Authorization"="Bearer gw-engineering-team-key-demo";"Content-Type"="application/json"} `
    -Body $body -TimeoutSec 60

Write-Host "Provider: $($resp.x_gateway_provider)"
Write-Host "Request ID: $($resp.x_gateway_request_id)"
Write-Host ""
Write-Host $resp.choices[0].message.content
```

**What to look for:**
- [ ] `x_gateway_provider` = "openrouter" (not mock)
- [ ] Real, coherent multi-sentence answer from Gemma
- [ ] `x_gateway_request_id` = UUID (can use this to find the trace in Jaeger if running)

---

### SCENARIO 13 — API Documentation

**What we're testing:** The gateway auto-generates interactive API docs.

- [ ] Open `http://127.0.0.1:8000/docs` in a browser
- [ ] You should see all endpoints listed:
  - `POST /v1/chat/completions`
  - `GET /admin/teams`
  - `POST /admin/teams`
  - `GET /admin/providers`
  - `GET /admin/usage/by-team`
  - `GET /admin/usage/budget`
  - `GET /health`
- [ ] Click "Try it out" on any endpoint and run it from the browser
- [ ] Add the header `X-Admin-Key: admin-secret-change-in-production` for admin endpoints

---

## PART 5 — WHAT TO SAY IN AN INTERVIEW

### If asked "Walk me through a request"

> "A request comes in with an API key in the Authorization header. The auth middleware resolves it to a team identity from PostgreSQL. Then the rate limiter checks a Redis token bucket — if the team has used their req/minute quota, we return 429 immediately. Next the budget enforcer checks Redis for the team's current month spend — if they've exceeded their USD cap, we return 402. Then we check the response cache — if this exact combination of team, model, and messages was seen before, we return the cached response in under 5ms. If it's a cache miss, the router picks an ordered list of providers based on the team's routing strategy. We try the first provider, and if it fails with a retryable error like a 5xx or timeout, we retry with exponential backoff. If it repeatedly fails, the circuit breaker opens for that provider and we fall through to the next one. The response is normalized to a standard format regardless of which provider answered, stored in cache, and usage is recorded asynchronously to PostgreSQL."

### If asked "What was the hardest part?"

> "The circuit breaker state machine was interesting. You have three states — closed, open, and half-open. The tricky part is the half-open state: you want to allow exactly one probe request through to test if the provider recovered, without letting a flood of requests through. I stored the state in Redis with an atomic pipeline so concurrent requests don't race on the state transition."

### If asked "How does caching maintain tenant isolation?"

> "The cache key is a SHA-256 hash that includes the team ID as part of the input. So even if two teams send identical prompts, they generate different cache keys and can never see each other's responses. This is baked into the key construction rather than being a runtime check, so there's no way to accidentally bypass it."

### If asked "How would you scale this?"

> "The gateway itself is stateless — all state lives in Redis and PostgreSQL. You could run multiple gateway instances behind a load balancer and they'd share the same Redis for rate limiting and caching. The rate limiter uses an atomic Lua script to avoid race conditions across instances."

---

## PART 6 — QUICK REFERENCE

### API Keys for Testing

| Team | Key |
|---|---|
| engineering (100 RPM, $20/mo) | `gw-engineering-team-key-demo` |
| marketing (30 RPM, $5/mo) | `gw-marketing-team-key-demo` |
| internal-tools (10 RPM, $2/mo) | `gw-internal-tools-key-demo` |

### Admin Key

```
admin-secret-change-in-production
```
Use as header: `X-Admin-Key: admin-secret-change-in-production`

### Available Free Models (OpenRouter)

```
google/gemma-4-26b-a4b-it:free     ← tested and working
google/gemma-4-31b-it:free
cohere/north-mini-code:free
```
Use with: `"x_providers": ["openrouter"]`

### Key Endpoints

```
GET  /health                              Gateway health
GET  /docs                                Interactive API docs
GET  /metrics                             Prometheus metrics
POST /v1/chat/completions                 Send a request (team API key required)
GET  /admin/providers                     List providers + CB state
POST /admin/providers/{id}/disable        Disable a provider
POST /admin/providers/{id}/enable         Enable a provider
POST /admin/providers/{id}/reset-circuit-breaker   Reset CB
GET  /admin/teams                         List all teams
POST /admin/teams                         Create a team
POST /admin/teams/{id}/rotate-key         Rotate team API key
GET  /admin/usage/by-team                 Usage analytics per team
GET  /admin/usage/by-provider             Usage analytics per provider
GET  /admin/usage/budget                  Budget status all teams
```

### Run Unit Tests

```powershell
cd C:\Users\SAHIL\Desktop\Projects\AI_LLM_GATEWAY
python -m pytest tests/unit/ -v
```

Should show 20 passed.
