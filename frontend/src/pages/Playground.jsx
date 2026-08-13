import { useState, useRef, useEffect } from "react"
import { chatCompletion, TEAM_KEYS } from "../api"

const PROVIDER_MODELS = {
  "(auto)":     ["mock-gpt", "google/gemma-4-26b-a4b-it:free"],
  "mock":       ["mock-gpt"],
  "openrouter": ["google/gemma-4-26b-a4b-it:free", "google/gemma-4-31b-it:free", "cohere/north-mini-code:free"],
  "openai":     ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  "anthropic":  ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
  "ollama":     ["llama3", "mistral", "phi3"],
}

const PROVIDER_TIPS = {
  "(auto)":     "Gateway picks the highest-priority available provider",
  "mock":       "Instant deterministic responses — no API call made",
  "openrouter": "Routes to OpenRouter — real LLM, free tier available",
  "openai":     "Requires OPENAI_API_KEY in environment",
  "anthropic":  "Requires ANTHROPIC_API_KEY in environment",
  "ollama":     "Requires Ollama running locally on port 11434",
}

function MetaBadge({ label, value, color = "text-[#999]" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[#444] text-[9px] uppercase tracking-wider">{label}</span>
      <span className={`text-[11px] font-mono ${color}`}>{value}</span>
    </div>
  )
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[#444] text-[10px] uppercase tracking-wider font-medium">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="bg-[#0d0d0d] border border-[#1f1f1f] hover:border-[#2a2a2a] text-[#ccc] text-sm rounded-lg px-3 py-1.5 outline-none focus:border-green-500/40 transition-colors"
      >
        {children}
      </select>
    </label>
  )
}

export default function Playground() {
  const [team, setTeam] = useState("engineering")
  const [provider, setProvider] = useState("(auto)")
  const [model, setModel] = useState("mock-gpt")
  const [cacheTTL, setCacheTTL] = useState(0)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  function handleProviderChange(newProvider) {
    setProvider(newProvider)
    const models = PROVIDER_MODELS[newProvider] ?? []
    if (models.length > 0 && !models.includes(model)) setModel(models[0])
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput("")
    setMessages(m => [...m, { role: "user", content: userMsg }])
    setLoading(true)

    const body = {
      model,
      messages: [...messages, { role: "user", content: userMsg }].map(({ role, content }) => ({ role, content })),
      x_cache_ttl: cacheTTL,
    }
    if (provider !== "(auto)") body.x_providers = [provider]

    const { status, data } = await chatCompletion(TEAM_KEYS[team], body)
    setLoading(false)

    if (status === 200) {
      setMessages(m => [...m, {
        role: "assistant",
        content: data.choices?.[0]?.message?.content ?? "(empty response)",
        meta: {
          provider: data.x_gateway_provider,
          cached: data.x_gateway_cached,
          latency: data.x_gateway_latency_ms,
          cost: data.x_gateway_cost_usd,
          request_id: data.x_gateway_request_id,
          tokens: data.usage ? `${data.usage.prompt_tokens} in → ${data.usage.completion_tokens} out` : null,
        },
      }])
    } else {
      setMessages(m => [...m, { role: "error", content: data?.detail ?? `Error ${status}` }])
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  const availableModels = PROVIDER_MODELS[provider] ?? []

  return (
    <div className="flex flex-col h-screen p-5 gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Playground</h1>
          <p className="text-[#444] text-sm mt-0.5">Send requests and inspect routing metadata per response</p>
        </div>
        <button
          onClick={() => setMessages([])}
          className="text-xs text-[#444] hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg border border-[#1a1a1a] hover:border-red-500/25"
        >
          Clear chat
        </button>
      </div>

      {/* Config bar */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
        <div className="flex flex-wrap gap-5 items-end">
          <SelectField label="Team" value={team} onChange={e => setTeam(e.target.value)}>
            {Object.keys(TEAM_KEYS).map(k => <option key={k}>{k}</option>)}
          </SelectField>

          <SelectField label="Provider" value={provider} onChange={e => handleProviderChange(e.target.value)}>
            {Object.keys(PROVIDER_MODELS).map(p => <option key={p}>{p}</option>)}
          </SelectField>

          <SelectField label="Model" value={model} onChange={e => setModel(e.target.value)}>
            {availableModels.map(m => <option key={m}>{m}</option>)}
          </SelectField>

          <SelectField label="Cache TTL" value={cacheTTL} onChange={e => setCacheTTL(Number(e.target.value))}>
            <option value={0}>No cache</option>
            <option value={60}>60 seconds</option>
            <option value={3600}>1 hour</option>
            <option value={86400}>24 hours</option>
          </SelectField>

          {PROVIDER_TIPS[provider] && (
            <div className="ml-auto self-end hidden xl:flex items-center gap-1.5 text-[11px] text-[#3a3a3a] bg-[#0d0d0d] border border-[#161616] px-3 py-1.5 rounded-lg max-w-xs">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeOpacity="0.5"/>
                <line x1="6" y1="5" x2="6" y2="8" stroke="currentColor" strokeLinecap="round"/>
                <circle cx="6" cy="3.5" r="0.5" fill="currentColor"/>
              </svg>
              {PROVIDER_TIPS[provider]}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[#2a2a2a] space-y-3">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M6 9C6 7.34 7.34 6 9 6h22c1.66 0 3 1.34 3 3v17c0 1.66-1.34 3-3 3H22l-5 5-5-5H9c-1.66 0-3-1.34-3-3V9z" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5"/>
              <circle cx="13" cy="20" r="2" fill="currentColor" opacity="0.4"/>
              <circle cx="20" cy="20" r="2" fill="currentColor" opacity="0.4"/>
              <circle cx="27" cy="20" r="2" fill="currentColor" opacity="0.4"/>
            </svg>
            <div className="text-center">
              <p className="text-sm">Send a message to test the gateway</p>
              <p className="text-xs mt-1 opacity-60">Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {msg.role === "user" && (
              <div className="max-w-[75%] bg-green-500/8 border border-green-500/15 text-[#ddd] text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm leading-relaxed">
                {msg.content}
              </div>
            )}

            {msg.role === "assistant" && (
              <div className="max-w-[85%] space-y-2">
                <div className="bg-[#141414] border border-[#1f1f1f] text-[#ddd] text-sm px-4 py-3 rounded-2xl rounded-tl-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
                {msg.meta && (
                  <div className="flex flex-wrap gap-4 px-3 py-2.5 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl">
                    <MetaBadge
                      label="provider"
                      value={msg.meta.provider ?? "—"}
                      color={msg.meta.cached ? "text-blue-400" : msg.meta.provider === "mock" ? "text-[#888]" : "text-green-400"}
                    />
                    <MetaBadge
                      label="cached"
                      value={String(msg.meta.cached)}
                      color={msg.meta.cached ? "text-blue-400" : "text-[#444]"}
                    />
                    <MetaBadge
                      label="latency"
                      value={msg.meta.latency != null ? `${msg.meta.latency}ms` : "—"}
                      color={msg.meta.latency < 50 ? "text-blue-400" : msg.meta.latency > 5000 ? "text-yellow-400" : "text-[#888]"}
                    />
                    {msg.meta.tokens && <MetaBadge label="tokens" value={msg.meta.tokens} />}
                    <MetaBadge label="cost" value={`$${parseFloat(msg.meta.cost || 0).toFixed(6)}`} />
                    <MetaBadge label="request id" value={(msg.meta.request_id ?? "").slice(0, 8) + "…"} />
                  </div>
                )}
              </div>
            )}

            {msg.role === "error" && (
              <div className="max-w-[80%] bg-red-500/8 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-2xl font-mono">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="bg-[#141414] border border-[#1f1f1f] px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1.5 items-center">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#444] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
                <span className="text-[11px] text-[#444] ml-1">
                  {provider !== "(auto)" ? `waiting for ${provider}...` : "routing request..."}
                </span>
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
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          className="flex-1 bg-[#111] border border-[#1a1a1a] focus:border-green-500/30 text-[#ddd] text-sm rounded-xl px-4 py-3 outline-none resize-none placeholder-[#333] transition-colors"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-6 bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:bg-[#111] disabled:text-[#333] disabled:border-[#1a1a1a] disabled:border text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-green-500/10 disabled:shadow-none"
        >
          {loading ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          ) : "Send"}
        </button>
      </div>
    </div>
  )
}
