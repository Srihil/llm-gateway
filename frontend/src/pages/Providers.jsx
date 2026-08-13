import { useEffect, useState } from "react"
import { getProviders, enableProvider, disableProvider, resetCB } from "../api"

function CBBadge({ state }) {
  const cfg = {
    closed:    "bg-green-500/10 text-green-400 border-green-500/25",
    open:      "bg-red-500/10 text-red-400 border-red-500/25",
    half_open: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
  }
  return (
    <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${cfg[state] ?? cfg.closed}`}>
      CB: {state.replace("_", " ")}
    </span>
  )
}

function SkeletonProviderCard() {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="skeleton w-2.5 h-2.5 rounded-full" />
          <div>
            <div className="skeleton h-4 w-20 mb-1" />
            <div className="skeleton h-2.5 w-12" />
          </div>
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        {[1,2,3].map(i => (
          <div key={i} className="flex justify-between items-center">
            <div className="skeleton h-2.5 w-16" />
            <div className="skeleton h-2.5 w-14" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <div className="skeleton flex-1 h-8 rounded-lg" />
        <div className="skeleton flex-1 h-8 rounded-lg" />
      </div>
    </div>
  )
}

const providerColors = {
  mock:        "text-[#888]",
  openrouter:  "text-purple-400",
  anthropic:   "text-orange-400",
  openai:      "text-emerald-400",
  ollama:      "text-blue-400",
}

export default function Providers() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)

  async function load() {
    setProviders(await getProviders())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function act(id, fn) {
    setActing(id)
    await fn(id)
    await load()
    setActing(null)
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Providers</h1>
          <p className="text-[#444] text-sm mt-0.5">Manage provider status and circuit breakers</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-[#555] hover:text-[#aaa] transition-colors px-3 py-1.5 border border-[#1f1f1f] hover:border-[#2a2a2a] rounded-lg"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M14 8A6 6 0 1 1 8 2a6 6 0 0 1 4.24 1.76M14 2v4h-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading
          ? Array(5).fill(0).map((_, i) => <SkeletonProviderCard key={i} />)
          : providers.map((p) => (
            <div key={p.id} className="bg-[#111] border border-[#1a1a1a] hover:border-[#252525] rounded-xl p-5 space-y-4 transition-colors">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${p.is_registered ? "bg-green-400" : "bg-[#333]"}`} />
                  <div>
                    <div className={`font-semibold text-sm ${providerColors[p.name] ?? "text-white"}`}>{p.name}</div>
                    <div className="text-[#444] text-xs">priority {p.priority}</div>
                  </div>
                </div>
                <CBBadge state={p.circuit_breaker_state} />
              </div>

              {/* Info rows */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[#161616]">
                  <span className="text-[#444]">Status</span>
                  <span className={`font-medium ${p.is_enabled ? "text-green-400" : "text-[#444]"}`}>
                    {p.is_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#161616]">
                  <span className="text-[#444]">Registered</span>
                  <span className={`font-medium ${p.is_registered ? "text-green-400" : "text-[#555]"}`}>
                    {p.is_registered ? "Yes" : "No API key"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#444]">Circuit Breaker</span>
                  <span className={`font-medium ${
                    p.circuit_breaker_state === "closed"    ? "text-green-400" :
                    p.circuit_breaker_state === "open"      ? "text-red-400"   : "text-yellow-400"
                  }`}>
                    {p.circuit_breaker_state}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {p.is_enabled ? (
                  <button
                    onClick={() => act(p.id, disableProvider)}
                    disabled={acting === p.id}
                    className="flex-1 text-xs py-2 rounded-lg border border-[#1f1f1f] text-[#666] hover:text-red-400 hover:border-red-500/25 hover:bg-red-500/5 transition-all disabled:opacity-40"
                  >
                    Disable
                  </button>
                ) : (
                  <button
                    onClick={() => act(p.id, enableProvider)}
                    disabled={acting === p.id}
                    className="flex-1 text-xs py-2 rounded-lg border border-[#1f1f1f] text-[#666] hover:text-green-400 hover:border-green-500/25 hover:bg-green-500/5 transition-all disabled:opacity-40"
                  >
                    Enable
                  </button>
                )}
                <button
                  onClick={() => act(p.id, resetCB)}
                  disabled={acting === p.id || p.circuit_breaker_state === "closed"}
                  className="flex-1 text-xs py-2 rounded-lg border border-[#1f1f1f] text-[#666] hover:text-yellow-400 hover:border-yellow-500/25 hover:bg-yellow-500/5 transition-all disabled:opacity-40"
                >
                  Reset CB
                </button>
              </div>

              {acting === p.id && (
                <div className="text-[10px] text-[#444] text-center animate-pulse">Processing...</div>
              )}
            </div>
          ))}
      </div>

      {/* CB explanation */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Circuit Breaker States</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { state: "CLOSED", color: "text-green-400", desc: "Normal operation. All requests flow through to the provider." },
            { state: "OPEN",   color: "text-red-400",   desc: "Provider is unhealthy. Requests are rejected immediately." },
            { state: "HALF OPEN", color: "text-yellow-400", desc: "Recovery probe. One test request allowed. Success → CLOSED." },
          ].map(({ state, color, desc }) => (
            <div key={state} className="bg-[#0d0d0d] rounded-lg p-3.5 border border-[#161616]">
              <span className={`text-xs font-mono font-semibold ${color}`}>{state}</span>
              <p className="mt-1.5 text-xs text-[#555] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
