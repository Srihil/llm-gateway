import { useEffect, useState } from "react"
import { getTeams, getBudget, getUsageByTeam } from "../api"

function SkeletonTeamCard() {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="skeleton w-2.5 h-2.5 rounded-full" />
          <div>
            <div className="skeleton h-4 w-28 mb-1.5" />
            <div className="skeleton h-2.5 w-48" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-6 w-24 rounded-full" />
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-14 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-[#0d0d0d] rounded-lg p-3 border border-[#161616]">
            <div className="skeleton h-2 w-16 mb-2" />
            <div className="skeleton h-5 w-20" />
          </div>
        ))}
      </div>
      <div>
        <div className="flex justify-between mb-1.5">
          <div className="skeleton h-2 w-16" />
          <div className="skeleton h-2 w-8" />
        </div>
        <div className="skeleton h-1.5 w-full rounded-full" />
      </div>
    </div>
  )
}

function StatBox({ label, value, highlight }) {
  return (
    <div className="bg-[#0d0d0d] rounded-lg p-3 border border-[#161616]">
      <div className="text-[#444] text-[10px] uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`text-sm font-semibold ${highlight ?? "text-white"}`}>{value}</div>
    </div>
  )
}

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

  const budgetMap = Object.fromEntries(budget.map(b => [b.team_name, b]))
  const usageMap  = Object.fromEntries(usage.map(u => [u.team_name, u]))

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Teams</h1>
          <p className="text-[#444] text-sm mt-0.5">Team policies, budget status, and usage (last 24h)</p>
        </div>
        {!loading && (
          <span className="text-xs text-[#444] bg-[#111] border border-[#1a1a1a] px-3 py-1.5 rounded-lg">
            {teams.length} team{teams.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {loading
          ? Array(3).fill(0).map((_, i) => <SkeletonTeamCard key={i} />)
          : teams.map((team) => {
              const b = budgetMap[team.name] ?? {}
              const u = usageMap[team.name] ?? {}
              const pct = Math.min(parseFloat(b.budget_used_pct ?? 0), 100)
              const barColor = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-green-500"

              return (
                <div key={team.id} className="bg-[#111] border border-[#1a1a1a] hover:border-[#252525] rounded-xl p-5 transition-colors">
                  {/* Team header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${team.is_active ? "bg-green-400" : "bg-[#333]"}`} />
                      <div>
                        <div className="text-white font-semibold">{team.name}</div>
                        <div className="text-[#333] text-[10px] font-mono mt-0.5">{team.id}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] bg-[#0d0d0d] border border-[#1a1a1a] px-2.5 py-1 rounded-full text-[#666]">
                        {team.routing_strategy} routing
                      </span>
                      <span className="text-[10px] bg-[#0d0d0d] border border-[#1a1a1a] px-2.5 py-1 rounded-full text-[#666]">
                        {team.max_rpm} RPM
                      </span>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${
                        team.is_active
                          ? "bg-green-500/10 text-green-400 border-green-500/25"
                          : "bg-[#0d0d0d] text-[#444] border-[#1a1a1a]"
                      }`}>
                        {team.is_active ? "active" : "inactive"}
                      </span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <StatBox label="Monthly Budget" value={`$${parseFloat(team.monthly_budget_usd).toFixed(2)}`} />
                    <StatBox
                      label="Spent"
                      value={`$${parseFloat(b.spent_usd ?? 0).toFixed(4)}`}
                      highlight={pct > 90 ? "text-red-400" : "text-white"}
                    />
                    <StatBox label="Requests (24h)" value={parseInt(u.request_count ?? 0).toLocaleString()} />
                    <StatBox
                      label="Tokens (24h)"
                      value={(parseInt(u.total_input_tokens ?? 0) + parseInt(u.total_output_tokens ?? 0)).toLocaleString()}
                    />
                  </div>

                  {/* Budget bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-[#444] mb-1.5">
                      <span>Budget used</span>
                      <span className={pct > 90 ? "text-red-400 font-medium" : pct > 70 ? "text-yellow-400 font-medium" : ""}>{b.budget_used_pct ?? 0}%</span>
                    </div>
                    <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })
        }
      </div>

      {/* API Keys reference */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">API Keys for Testing</h3>
        <div className="space-y-2.5">
          {[
            ["engineering",    "gw-engineering-team-key-demo"],
            ["marketing",      "gw-marketing-team-key-demo"],
            ["internal-tools", "gw-internal-tools-key-demo"],
          ].map(([name, key]) => (
            <div key={name} className="flex items-center justify-between text-xs py-2 border-b border-[#161616] last:border-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                <span className="text-[#888] font-medium">{name}</span>
              </div>
              <code className="text-[#555] font-mono bg-[#0d0d0d] border border-[#1a1a1a] px-2.5 py-1 rounded-lg text-[11px]">
                {key}
              </code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
