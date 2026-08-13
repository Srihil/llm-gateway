import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { login as apiLogin } from "../api"

const GatewayLogo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="10" r="2.5" fill="#22c55e" opacity="0.75"/>
    <circle cx="7" cy="22" r="2.5" fill="#22c55e" opacity="0.75"/>
    <line x1="9.5" y1="11.3" x2="13" y2="14.5" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" opacity="0.8"/>
    <line x1="9.5" y1="20.7" x2="13" y2="17.5" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" opacity="0.8"/>
    <circle cx="16" cy="16" r="4" fill="#22c55e"/>
    <circle cx="16" cy="16" r="2" fill="#111"/>
    <line x1="20" y1="16" x2="23.5" y2="16" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" opacity="0.8"/>
    <circle cx="25.5" cy="16" r="2.5" fill="#22c55e" opacity="0.75"/>
  </svg>
)

const EyeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <path d="M8 3C4.5 3 1.7 5.4 1 8c.7 2.6 3.5 5 7 5s6.3-2.4 7-5c-.7-2.6-3.5-5-7-5z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" fill="none"/>
  </svg>
)

const EyeOffIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M6.5 3.2C7 3.1 7.5 3 8 3c3.5 0 6.3 2.4 7 5a9.3 9.3 0 0 1-1.9 3.1M4.2 4.7A9 9 0 0 0 1 8c.7 2.6 3.5 5 7 5a8 8 0 0 0 3.3-.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
  </svg>
)

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data = await apiLogin({ email, password })
      login(data)
      navigate("/")
    } catch (err) {
      setError(err.message || "Invalid credentials")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(34,197,94,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-[400px] animate-fade-in">
        {/* Card */}
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-8 shadow-2xl shadow-black/60">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#0f0f0f] border border-[#222] flex items-center justify-center mb-4 shadow-lg ring-1 ring-green-500/10">
              <GatewayLogo />
            </div>
            <h1 className="text-[22px] font-semibold text-white tracking-tight">Welcome back</h1>
            <p className="text-[#555] text-sm mt-1">Sign in to LLM Gateway</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[#666] text-xs font-medium uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full bg-[#0d0d0d] border border-[#252525] focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 text-[#ddd] text-sm rounded-xl px-4 py-3 outline-none transition-all placeholder-[#333]"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[#666] text-xs font-medium uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#0d0d0d] border border-[#252525] focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 text-[#ddd] text-sm rounded-xl px-4 py-3 pr-11 outline-none transition-all placeholder-[#333]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors p-0.5"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/8 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
                  <line x1="8" y1="5" x2="8" y2="8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-all text-sm mt-2 shadow-lg shadow-green-500/10"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Signing in...
                </span>
              ) : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#1f1f1f]" />
            <span className="text-[#3a3a3a] text-xs">or</span>
            <div className="flex-1 h-px bg-[#1f1f1f]" />
          </div>

          <p className="text-center text-[#555] text-sm">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="text-green-400 hover:text-green-300 font-medium transition-colors">
              Create one free
            </Link>
          </p>
        </div>

        {/* Bottom label */}
        <p className="text-center text-[#333] text-xs mt-6">
          LLM Gateway · Multi-provider AI Infrastructure
        </p>
      </div>
    </div>
  )
}
