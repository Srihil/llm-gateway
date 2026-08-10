import { useEffect, useState } from "react"
import { getTeams, getBudget, getUsageByTeam } from "../api"

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [budget, setBudget] = useState([])
  const [usage, setUsage] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getTeams(), getBudget(), getUsageByTeam(24)]).then(([t, b, u]) => {
      setTeams(t)
      setBudget(b)
      setUsage(u)
      setLoading(false)
    })
  }, [])

  const budgetMap = Object.fromEntries(budget.map((b) => [b.team_name, b]))
  const usageMap = Object.fromEntries(usage.map((u) => [u.team_name, u]))

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Teams</h1>
        <p className="text-[#555] text-sm">Team policies, budget status, and usage (last 24h)</p>
      </div>

      {loading ? (
        <p className="text-[#555] text-sm">Loading...</p>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const b = budgetMap[team.name] ?? {}
            const u = usageMap[team.name] ?? {}
            const pct = Math.min(parseFloat(b.budget_used_pct ?? 0), 100)
            const barColor = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-green-500"

            return (
              <div key={team.id} className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${team.is_active ? "bg-green-400" : "bg-[#555]"}`} />
                    <div>
                      <div className="text-white font-semibold">{team.name}</div>
                      <div className="text-[#555] text-xs font-mono">{team.id}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs bg-[#1f1f1f] border border-[#2a2a2a] px-3 py-1 rounded-full text-[#888]">
                      {team.routing_strategy} routing
                    </span>
                    <span className="text-xs bg-[#1f1f1f] border border-[#2a2a2a] px-3 py-1 rounded-full text-[#888]">
                      {team.max_rpm} RPM
                    </span>
                    <span className={`text-xs px-3 py-1 rounded-full border ${team.is_active ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-[#1f1f1f] text-[#555] border-[#2a2a2a]"}`}>
                      {team.is_active ? "active" : "inactive"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#0f0f0f] rounded-lg p-3">
                    <div className="text-[#555] text-xs mb-1">Monthly Budget</div>
                    <div className="text-white font-semibold">${parseFloat(team.monthly_budget_usd).toFixed(2)}</div>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-lg p-3">
                    <div className="text-[#555] text-xs mb-1">Spent</div>
                    <div className={`font-semibold ${pct > 90 ? "text-red-400" : "text-white"}`}>
                      ${parseFloat(b.spent_usd ?? 0).toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-lg p-3">
                    <div className="text-[#555] text-xs mb-1">Requests (24h)</div>
                    <div className="text-white font-semibold">{parseInt(u.request_count ?? 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-lg p-3">
                    <div className="text-[#555] text-xs mb-1">Tokens (24h)</div>
                    <div className="text-white font-semibold">
                      {(parseInt(u.total_input_tokens ?? 0) + parseInt(u.total_output_tokens ?? 0)).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Budget bar */}
                <div>
                  <div className="flex justify-between text-xs text-[#555] mb-1.5">
                    <span>Budget used</span>
                    <span>{b.budget_used_pct ?? 0}%</span>
                  </div>
                  <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* API Keys reference */}
      <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-4">
        <h3 className="text-sm font-medium text-white mb-3">API Keys (for testing)</h3>
        <div className="space-y-2">
          {[
            ["engineering", "gw-engineering-team-key-demo"],
            ["marketing", "gw-marketing-team-key-demo"],
            ["internal-tools", "gw-internal-tools-key-demo"],
          ].map(([name, key]) => (
            <div key={name} className="flex items-center justify-between text-xs">
              <span className="text-[#888] w-32">{name}</span>
              <code className="text-[#555] font-mono bg-[#0f0f0f] px-2 py-1 rounded">{key}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
