import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { getHealth, getProviders, getBudget, getUsageByTeam, getMetrics, parseMetric } from "../api"

// ── Skeleton components ──────────────────────────────────────────────────

function SkeletonStatCard() {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5">
      <div className="skeleton h-2.5 w-20 mb-3" />
      <div className="skeleton h-8 w-16 mb-2" />
      <div className="skeleton h-2 w-28" />
    </div>
  )
}

function SkeletonProviderRow() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="skeleton w-2 h-2 rounded-full" />
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-2.5 w-14" />
      </div>
      <div className="skeleton h-5 w-16 rounded-full" />
    </div>
  )
}

function SkeletonBudgetRow() {
  return (
    <div className="flex items-center gap-4">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton flex-1 h-2 rounded-full" />
      <div className="skeleton h-2.5 w-28" />
      <div className="skeleton h-2.5 w-10" />
    </div>
  )
}

// ── Real components ──────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-green-400", icon }) {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 hover:border-[#252525] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[#444] text-[10px] uppercase tracking-widest font-medium">{label}</div>
        {icon && <span className="text-[#333]">{icon}</span>}
      </div>
      <div className={`text-3xl font-bold tracking-tight ${color}`}>{value}</div>
      {sub && <div className="text-[#444] text-xs mt-1.5">{sub}</div>}
    </div>
  )
}

function CBBadge({ state }) {
  const cfg = {
    closed:    "bg-green-500/10 text-green-400 border-green-500/25",
    open:      "bg-red-500/10 text-red-400 border-red-500/25",
    half_open: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg[state] ?? cfg.closed}`}>
      {state.replace("_", " ")}
    </span>
  )
}

function BudgetBar({ team_name, spent_usd, monthly_budget_usd, budget_used_pct }) {
  const pct = Math.min(budget_used_pct, 100)
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-green-500"
  return (
    <div className="flex items-center gap-4">
      <div className="w-28 text-sm text-[#999] truncate">{team_name}</div>
      <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-28 text-right text-xs text-[#555]">
        ${parseFloat(spent_usd).toFixed(4)} / ${parseFloat(monthly_budget_usd).toFixed(2)}
      </div>
      <div className="w-10 text-right text-xs font-mono text-[#444]">{budget_used_pct}%</div>
    </div>
  )
}

const icons = {
  providers: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="1" y="9" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    </svg>
  ),
  requests: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  cache: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  shield: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L3 4.5v4c0 2.5 2.1 4.7 5 5.5 2.9-.8 5-3 5-5.5v-4L8 2z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    </svg>
  ),
  tokens: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M5.5 8h5M8 5.5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
}

export default function Dashboard() {
  const [providers, setProviders] = useState([])
  const [budget, setBudget] = useState([])
  const [usage, setUsage] = useState([])
  const [metrics, setMetrics] = useState("")
  const [online, setOnline] = useState(null)
  const [failCount, setFailCount] = useState(0)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [isOnline, p, b, u, m] = await Promise.all([
      getHealth(),
      getProviders(), getBudget(), getUsageByTeam(24), getMetrics(),
    ])

    setProviders(p)
    setBudget(b)
    setUsage(u)
    setMetrics(m)
    setLastRefresh(new Date().toLocaleTimeString())
    setLoading(false)

    const backendReachable = isOnline || p.length > 0 || b.length > 0
    if (backendReachable) {
      setOnline(true)
      setFailCount(0)
    } else {
      setFailCount(prev => {
        const next = prev + 1
        if (next >= 3) setOnline(false)
        return next
      })
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  const totalRequests   = parseMetric(metrics, "llm_gateway_requests_total{")
  const cacheHits       = parseMetric(metrics, "llm_gateway_cache_hits_total{")
  const rateLimited     = parseMetric(metrics, "llm_gateway_rate_limit_rejections_total{")
  const totalTokens     = parseMetric(metrics, "llm_gateway_tokens_total{")
  const activeProviders = providers.filter(p => p.is_registered).length

  const chartData = usage.map(u => ({
    name: u.team_name || "unknown",
    input: parseInt(u.total_input_tokens) || 0,
    output: parseInt(u.total_output_tokens) || 0,
  }))

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Dashboard</h1>
          <p className="text-[#444] text-sm mt-0.5">Live system overview · auto-refreshes every 10s</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && <span className="text-[#333] text-xs hidden sm:block">Updated {lastRefresh}</span>}
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${
            online === true  ? "border-green-500/25 bg-green-500/8 text-green-400" :
            online === false ? "border-red-500/25 bg-red-500/8 text-red-400" :
            "border-yellow-500/25 bg-yellow-500/8 text-yellow-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              online === true ? "bg-green-400" :
              online === false ? "bg-red-400" :
              "bg-yellow-400 animate-pulse"
            }`} />
            {online === true  ? "Gateway online"  :
             online === false ? "Gateway offline" :
             failCount === 0  ? "Connecting..."   : "Waking up..."}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {loading ? (
          Array(5).fill(0).map((_, i) => <SkeletonStatCard key={i} />)
        ) : (
          <>
            <StatCard label="Active Providers" value={activeProviders} sub={`of ${providers.length} configured`} icon={icons.providers} />
            <StatCard label="Total Requests"   value={totalRequests.toLocaleString()} sub="since last restart" icon={icons.requests} />
            <StatCard label="Cache Hits"       value={cacheHits.toLocaleString()} sub="responses from cache" color="text-blue-400" icon={icons.cache} />
            <StatCard label="Rate Limited"     value={rateLimited.toLocaleString()} sub="requests blocked" color="text-yellow-400" icon={icons.shield} />
            <StatCard label="Total Tokens"     value={totalTokens.toLocaleString()} sub="input + output" color="text-purple-400" icon={icons.tokens} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Provider Health */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Provider Health</h2>
            <span className="text-[#333] text-xs">{providers.length} configured</span>
          </div>
          <div className="space-y-3.5">
            {loading ? (
              Array(5).fill(0).map((_, i) => <SkeletonProviderRow key={i} />)
            ) : providers.length === 0 ? (
              <p className="text-[#444] text-sm">No providers configured</p>
            ) : (
              providers.map((p) => (
                <div key={p.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${p.is_registered ? "bg-green-400" : "bg-[#333]"}`} />
                    <span className="text-sm text-[#ccc] font-mono group-hover:text-white transition-colors">{p.name}</span>
                    <span className="text-[10px] text-[#444]">p{p.priority}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.is_enabled && <span className="text-[10px] text-[#444] font-medium">disabled</span>}
                    <CBBadge state={p.circuit_breaker_state} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Budget */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Team Budget</h2>
            <span className="text-[#333] text-xs">This month</span>
          </div>
          <div className="space-y-4">
            {loading ? (
              Array(3).fill(0).map((_, i) => <SkeletonBudgetRow key={i} />)
            ) : budget.length === 0 ? (
              <p className="text-[#444] text-sm">No budget data</p>
            ) : (
              budget.map(b => <BudgetBar key={b.team_id} {...b} />)
            )}
          </div>
        </div>
      </div>

      {/* Token Usage Chart */}
      {!loading && chartData.length > 0 && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Token Consumption by Team</h2>
            <span className="text-[#333] text-xs">Last 24h</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#141414", border: "1px solid #222", borderRadius: 10, color: "#ccc", fontSize: 12 }}
                cursor={{ fill: "rgba(255,255,255,0.02)" }}
              />
              <Bar dataKey="input"  name="Input Tokens"  fill="#22c55e" radius={[3,3,0,0]} opacity={0.85} />
              <Bar dataKey="output" name="Output Tokens" fill="#3b82f6" radius={[3,3,0,0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {loading && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5">
          <div className="skeleton h-3 w-48 mb-4" />
          <div className="skeleton h-[200px] w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}
