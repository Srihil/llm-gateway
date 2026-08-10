import { useEffect, useState } from "react"
import { getProviders, enableProvider, disableProvider, resetCB } from "../api"

function CBBadge({ state }) {
  const cfg = {
    closed: "bg-green-500/15 text-green-400 border-green-500/30",
    open: "bg-red-500/15 text-red-400 border-red-500/30",
    half_open: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cfg[state] ?? cfg.closed}`}>
      CB: {state.replace("_", " ")}
    </span>
  )
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
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Providers</h1>
          <p className="text-[#555] text-sm">Manage provider status and circuit breakers</p>
        </div>
        <button onClick={load} className="text-xs text-[#555] hover:text-[#aaa] transition-colors px-3 py-1.5 border border-[#222] rounded-lg">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-[#555] text-sm">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {providers.map((p) => (
            <div key={p.id} className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full mt-0.5 ${p.is_registered ? "bg-green-400" : "bg-[#444]"}`} />
                  <div>
                    <div className="text-white font-semibold">{p.name}</div>
                    <div className="text-[#555] text-xs">priority {p.priority}</div>
                  </div>
                </div>
                <CBBadge state={p.circuit_breaker_state} />
              </div>

              {/* Info rows */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#555]">Status</span>
                  <span className={p.is_enabled ? "text-green-400" : "text-[#555]"}>
                    {p.is_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555]">Registered</span>
                  <span className={p.is_registered ? "text-green-400" : "text-[#555]"}>
                    {p.is_registered ? "Yes" : "No (no API key)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555]">Circuit Breaker</span>
                  <span className={
                    p.circuit_breaker_state === "closed" ? "text-green-400" :
                    p.circuit_breaker_state === "open" ? "text-red-400" : "text-yellow-400"
                  }>
                    {p.circuit_breaker_state}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {p.is_enabled ? (
                  <button
                    onClick={() => act(p.id, disableProvider)}
                    disabled={acting === p.id}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-[#2a2a2a] text-[#888] hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-40"
                  >
                    Disable
                  </button>
                ) : (
                  <button
                    onClick={() => act(p.id, enableProvider)}
                    disabled={acting === p.id}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-[#2a2a2a] text-[#888] hover:text-green-400 hover:border-green-500/30 transition-colors disabled:opacity-40"
                  >
                    Enable
                  </button>
                )}
                <button
                  onClick={() => act(p.id, resetCB)}
                  disabled={acting === p.id || p.circuit_breaker_state === "closed"}
                  className="flex-1 text-xs py-1.5 rounded-lg border border-[#2a2a2a] text-[#888] hover:text-yellow-400 hover:border-yellow-500/30 transition-colors disabled:opacity-40"
                >
                  Reset CB
                </button>
              </div>

              {acting === p.id && (
                <div className="text-xs text-[#555] text-center animate-pulse">Processing...</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CB explanation */}
      <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-4">
        <h3 className="text-sm font-medium text-white mb-3">Circuit Breaker States</h3>
        <div className="grid grid-cols-3 gap-4 text-xs text-[#666]">
          <div>
            <span className="text-green-400 font-mono">CLOSED</span>
            <p className="mt-1">Normal operation. All requests flow through to the provider.</p>
          </div>
          <div>
            <span className="text-red-400 font-mono">OPEN</span>
            <p className="mt-1">Provider is unhealthy. Requests are rejected immediately to protect the system.</p>
          </div>
          <div>
            <span className="text-yellow-400 font-mono">HALF_OPEN</span>
            <p className="mt-1">Recovery probe. One test request is allowed. Success → CLOSED. Failure → OPEN again.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
