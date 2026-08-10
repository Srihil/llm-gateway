import { useState, useRef, useEffect } from "react"
import { chatCompletion, TEAM_KEYS } from "../api"

const FREE_MODELS = [
  "mock-gpt",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "cohere/north-mini-code:free",
]

const PROVIDERS = ["(auto)", "mock", "openrouter", "openai", "anthropic", "ollama"]

function MetaBadge({ label, value, color = "text-[#aaa]" }) {
  return (
    <div className="flex flex-col">
      <span className="text-[#555] text-xs">{label}</span>
      <span className={`text-xs font-mono ${color}`}>{value}</span>
    </div>
  )
}

export default function Playground() {
  const [team, setTeam] = useState("engineering")
  const [model, setModel] = useState("mock-gpt")
  const [provider, setProvider] = useState("(auto)")
  const [cacheTTL, setCacheTTL] = useState(0)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput("")
    setMessages((m) => [...m, { role: "user", content: userMsg }])
    setLoading(true)

    const body = {
      model,
      messages: [...messages, { role: "user", content: userMsg }].map(({ role, content }) => ({ role, content })),
      x_cache_ttl: cacheTTL,
    }
    if (provider !== "(auto)") body.x_providers = [provider]

    const apiKey = TEAM_KEYS[team]
    const { status, data } = await chatCompletion(apiKey, body)
    setLoading(false)

    if (status === 200) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.choices?.[0]?.message?.content ?? "(empty)",
          meta: {
            provider: data.x_gateway_provider,
            cached: data.x_gateway_cached,
            latency: data.x_gateway_latency_ms,
            cost: data.x_gateway_cost_usd,
            request_id: data.x_gateway_request_id,
            tokens: data.usage
              ? `${data.usage.prompt_tokens} → ${data.usage.completion_tokens}`
              : null,
          },
        },
      ])
    } else {
      setMessages((m) => [
        ...m,
        { role: "error", content: data?.detail ?? `Error ${status}` },
      ])
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-screen p-6 gap-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Playground</h1>
        <p className="text-[#555] text-sm">Send requests through the gateway and inspect routing metadata</p>
      </div>

      {/* Config bar */}
      <div className="flex flex-wrap gap-3 bg-[#141414] border border-[#1f1f1f] rounded-xl p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[#555] text-xs uppercase tracking-wider">Team</span>
          <select value={team} onChange={(e) => setTeam(e.target.value)}
            className="bg-[#0f0f0f] border border-[#2a2a2a] text-[#ccc] text-sm rounded-lg px-3 py-1.5 outline-none focus:border-green-500/50">
            {Object.keys(TEAM_KEYS).map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 min-w-[220px]">
          <span className="text-[#555] text-xs uppercase tracking-wider">Model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}
            className="bg-[#0f0f0f] border border-[#2a2a2a] text-[#ccc] text-sm rounded-lg px-3 py-1.5 outline-none focus:border-green-500/50">
            {FREE_MODELS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[#555] text-xs uppercase tracking-wider">Force Provider</span>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}
            className="bg-[#0f0f0f] border border-[#2a2a2a] text-[#ccc] text-sm rounded-lg px-3 py-1.5 outline-none focus:border-green-500/50">
            {PROVIDERS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[#555] text-xs uppercase tracking-wider">Cache TTL (s)</span>
          <select value={cacheTTL} onChange={(e) => setCacheTTL(Number(e.target.value))}
            className="bg-[#0f0f0f] border border-[#2a2a2a] text-[#ccc] text-sm rounded-lg px-3 py-1.5 outline-none focus:border-green-500/50">
            <option value={0}>No cache</option>
            <option value={60}>60s</option>
            <option value={3600}>1 hour</option>
            <option value={86400}>24 hours</option>
          </select>
        </label>

        <button onClick={() => setMessages([])}
          className="ml-auto self-end text-xs text-[#555] hover:text-red-400 transition-colors px-3 py-2 rounded-lg border border-[#222] hover:border-red-500/30">
          Clear chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[#333] space-y-2">
            <div className="text-4xl">💬</div>
            <p className="text-sm">Send a message to test the gateway</p>
            <p className="text-xs text-[#2a2a2a]">Press Enter to send · Shift+Enter for new line</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {msg.role === "user" && (
              <div className="max-w-[75%] bg-green-500/10 border border-green-500/20 text-[#ddd] text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm">
                {msg.content}
              </div>
            )}
            {msg.role === "assistant" && (
              <div className="max-w-[85%] space-y-2">
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] text-[#ddd] text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm whitespace-pre-wrap">
                  {msg.content}
                </div>
                {msg.meta && (
                  <div className="flex flex-wrap gap-4 px-2 py-2 bg-[#141414] border border-[#1f1f1f] rounded-xl">
                    <MetaBadge label="provider" value={msg.meta.provider ?? "—"}
                      color={msg.meta.provider === "cache" ? "text-blue-400" : "text-green-400"} />
                    <MetaBadge label="cached" value={String(msg.meta.cached)}
                      color={msg.meta.cached ? "text-blue-400" : "text-[#aaa]"} />
                    <MetaBadge label="latency" value={msg.meta.latency != null ? `${msg.meta.latency}ms` : "—"}
                      color={msg.meta.latency < 50 ? "text-blue-400" : "text-[#aaa]"} />
                    {msg.meta.tokens && <MetaBadge label="tokens" value={msg.meta.tokens} />}
                    <MetaBadge label="cost" value={`$${parseFloat(msg.meta.cost || 0).toFixed(6)}`} />
                    <MetaBadge label="request id" value={msg.meta.request_id?.slice(0, 8) + "..."} />
                  </div>
                )}
              </div>
            )}
            {msg.role === "error" && (
              <div className="max-w-[75%] bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-2xl">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#444] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          className="flex-1 bg-[#141414] border border-[#2a2a2a] focus:border-green-500/40 text-[#ddd] text-sm rounded-xl px-4 py-3 outline-none resize-none placeholder-[#444] transition-colors"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-5 bg-green-600 hover:bg-green-500 disabled:bg-[#1a1a1a] disabled:text-[#444] text-white text-sm font-medium rounded-xl transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
