import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { getHealth, getProviders, getBudget, getUsageByTeam, getMetrics, parseMetric } from "../api"

function StatCard({ label, value, sub, color = "text-green-400" }) {
  return (
    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5">
      <div className="text-[#555] text-xs uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[#555] text-xs mt-1">{sub}</div>}
    </div>
  )
}

function CBBadge({ state }) {
  const cfg = {
    closed: "bg-green-500/15 text-green-400 border-green-500/30",
    open: "bg-red-500/15 text-red-400 border-red-500/30",
    half_open: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${cfg[state] ?? cfg.closed}`}>
      {state.replace("_", " ")}
    </span>
  )
}

function BudgetBar({ team_name, spent_usd, monthly_budget_usd, budget_used_pct }) {
  const pct = Math.min(budget_used_pct, 100)
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-green-500"
  return (
    <div className="flex items-center gap-4">
      <div className="w-28 text-sm text-[#aaa] truncate">{team_name}</div>
      <div className="flex-1 h-2 bg-[#222] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-28 text-right text-xs text-[#666]">
        ${parseFloat(spent_usd).toFixed(4)} / ${parseFloat(monthly_budget_usd).toFixed(2)}
      </div>
      <div className="w-12 text-right text-xs text-[#555]">{budget_used_pct}%</div>
    </div>
  )
}

export default function Dashboard() {
  const [providers, setProviders] = useState([])
  const [budget, setBudget] = useState([])
  const [usage, setUsage] = useState([])
  const [metrics, setMetrics] = useState("")
  const [online, setOnline] = useState(null)  // null=connecting, true=online, false=offline
  const [failCount, setFailCount] = useState(0)
  const [lastRefresh, setLastRefresh] = useState(null)

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

    // If health check passed OR data loaded (providers/budget), backend is online
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

  const totalRequests = parseMetric(metrics, "llm_gateway_requests_total{")
  const cacheHits = parseMetric(metrics, "llm_gateway_cache_hits_total{")
  const rateLimited = parseMetric(metrics, "llm_gateway_rate_limit_rejections_total{")
  const totalTokens = parseMetric(metrics, "llm_gateway_tokens_total{")
  const activeProviders = providers.filter((p) => p.is_registered).length

  const chartData = usage.map((u) => ({
    name: u.team_name || "unknown",
    input: parseInt(u.total_input_tokens) || 0,
    output: parseInt(u.total_output_tokens) || 0,
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-[#555] text-sm">Live system overview — auto-refreshes every 10s</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && <span className="text-[#444] text-xs">Updated {lastRefresh}</span>}
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${
            online === true  ? "border-green-500/30 bg-green-500/10 text-green-400" :
            online === false ? "border-red-500/30 bg-red-500/10 text-red-400" :
            "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              online === true ? "bg-green-400" : online === false ? "bg-red-400" : "bg-yellow-400 animate-pulse"
            }`} />
            {online === true  ? "Gateway online" :
             online === false ? "Gateway offline" :
             failCount === 0  ? "Connecting..." : "Waking up..."}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Active Providers" value={activeProviders} sub={`of ${providers.length} configured`} />
        <StatCard label="Total Requests" value={totalRequests.toLocaleString()} sub="since last restart" />
        <StatCard label="Cache Hits" value={cacheHits.toLocaleString()} sub="responses from cache" color="text-blue-400" />
        <StatCard label="Rate Limited" value={rateLimited.toLocaleString()} sub="requests blocked" color="text-yellow-400" />
        <StatCard label="Total Tokens" value={totalTokens.toLocaleString()} sub="input + output" color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Providers */}
        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Provider Health</h2>
          <div className="space-y-3">
            {providers.length === 0 && <p className="text-[#555] text-sm">No providers configured</p>}
            {providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${p.is_registered ? "bg-green-400" : "bg-[#444]"}`} />
                  <span className="text-sm text-[#ccc] font-mono">{p.name}</span>
                  <span className="text-xs text-[#555]">priority {p.priority}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!p.is_enabled && <span className="text-xs text-[#555]">disabled</span>}
                  <CBBadge state={p.circuit_breaker_state} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Team Budget (This Month)</h2>
          <div className="space-y-4">
            {budget.length === 0 && <p className="text-[#555] text-sm">No budget data</p>}
            {budget.map((b) => <BudgetBar key={b.team_id} {...b} />)}
          </div>
        </div>
      </div>

      {/* Token Usage Chart */}
      {chartData.length > 0 && (
        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Token Consumption by Team (24h)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#ccc" }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="input" name="Input Tokens" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="output" name="Output Tokens" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
