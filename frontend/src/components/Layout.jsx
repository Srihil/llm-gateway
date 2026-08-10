import { NavLink } from "react-router-dom"

const GatewayIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
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

const DashboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9"/>
    <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
    <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
    <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
  </svg>
)

const PlaygroundIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 3.5C2 2.67 2.67 2 3.5 2h9C13.33 2 14 2.67 14 3.5v7c0 .83-.67 1.5-1.5 1.5H9l-2 2-2-2H3.5C2.67 14 2 13.33 2 12.5v-9Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    <circle cx="5.5" cy="8" r="1" fill="currentColor" opacity="0.7"/>
    <circle cx="8" cy="8" r="1" fill="currentColor" opacity="0.7"/>
    <circle cx="10.5" cy="8" r="1" fill="currentColor" opacity="0.7"/>
  </svg>
)

const ProvidersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="4" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    <rect x="1" y="9" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    <circle cx="3.5" cy="5.5" r="0.75" fill="currentColor" opacity="0.8"/>
    <circle cx="3.5" cy="10.5" r="0.75" fill="currentColor" opacity="0.8"/>
    <circle cx="12.5" cy="5.5" r="0.75" fill="currentColor" opacity="0.5"/>
    <circle cx="12.5" cy="10.5" r="0.75" fill="currentColor" opacity="0.5"/>
  </svg>
)

const TeamsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="6" cy="5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    <circle cx="11" cy="5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.6"/>
    <path d="M2 13c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    <path d="M11 9c1.66 0 3 1.34 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6"/>
  </svg>
)

const nav = [
  { to: "/",           label: "Dashboard", Icon: DashboardIcon  },
  { to: "/playground", label: "Playground", Icon: PlaygroundIcon },
  { to: "/providers",  label: "Providers",  Icon: ProvidersIcon  },
  { to: "/teams",      label: "Teams",      Icon: TeamsIcon      },
]

const API_DOCS_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/docs`
  : "http://127.0.0.1:8000/docs"

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-[#1f1f1f] bg-[#111] flex flex-col">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1f1f1f] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0f0f0f] border border-[#222] flex items-center justify-center shrink-0">
            <GatewayIcon size={20} />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">LLM Gateway</div>
            <div className="text-[#555] text-xs">Infrastructure</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-green-500/10 text-green-400 font-medium"
                    : "text-[#777] hover:text-[#ccc] hover:bg-[#1a1a1a]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? "text-green-400" : "text-[#555]"}>
                    <Icon />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-[#1f1f1f] space-y-1">
          <div className="text-[#3a3a3a] text-xs">v0.1.0</div>
          <a
            href={API_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[#444] hover:text-green-400 text-xs transition-colors flex items-center gap-1"
          >
            API Docs
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 8L8 2M8 2H4M8 2v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
