import { NavLink } from "react-router-dom"

const nav = [
  { to: "/", label: "Dashboard", icon: "⬛" },
  { to: "/playground", label: "Playground", icon: "💬" },
  { to: "/providers", label: "Providers", icon: "🔌" },
  { to: "/teams", label: "Teams", icon: "👥" },
]

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-[#1f1f1f] bg-[#111] flex flex-col">
        <div className="px-5 py-5 border-b border-[#1f1f1f]">
          <div className="text-green-400 font-bold text-lg tracking-tight">⚡ LLM Gateway</div>
          <div className="text-[#555] text-xs mt-0.5">Infrastructure Dashboard</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-green-500/10 text-green-400 font-medium"
                    : "text-[#888] hover:text-[#ccc] hover:bg-[#1a1a1a]"
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-[#1f1f1f]">
          <div className="text-[#444] text-xs">Gateway v0.1.0</div>
          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="text-[#555] hover:text-green-400 text-xs transition-colors"
          >
            API Docs →
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
