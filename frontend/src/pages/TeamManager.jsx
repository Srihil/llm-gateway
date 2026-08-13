import { useEffect, useState } from "react"
import { getTeams, createTeam, updateTeam, deleteTeam, toggleTeamStatus, rotateTeamKey } from "../api"

// ── Skeleton ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-[#161616]">
      <td className="py-4 px-4"><div className="skeleton h-3.5 w-28" /></td>
      <td className="py-4 px-4"><div className="skeleton h-3 w-16" /></td>
      <td className="py-4 px-4"><div className="skeleton h-3 w-12" /></td>
      <td className="py-4 px-4"><div className="skeleton h-3 w-16" /></td>
      <td className="py-4 px-4"><div className="skeleton h-5 w-14 rounded-full" /></td>
      <td className="py-4 px-4 text-right"><div className="skeleton h-6 w-20 rounded-lg ml-auto" /></td>
    </tr>
  )
}

// ── Create Team Modal ─────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "", monthly_budget_usd: "10.00", max_rpm: "60", max_tpm: "100000", routing_strategy: "priority",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [newKey, setNewKey] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await createTeam({
        name: form.name,
        monthly_budget_usd: parseFloat(form.monthly_budget_usd),
        max_rpm: parseInt(form.max_rpm),
        max_tpm: parseInt(form.max_tpm),
        routing_strategy: form.routing_strategy,
      })
      setNewKey(res.api_key)
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (newKey) {
    return (
      <ModalShell title="Team Created" onClose={onClose}>
        <div className="space-y-4">
          <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-4">
            <p className="text-green-400 text-sm font-medium mb-1">Team created successfully</p>
            <p className="text-[#666] text-xs">Save this API key — it won&apos;t be shown again.</p>
          </div>
          <div>
            <div className="text-[#555] text-xs mb-1.5">API Key</div>
            <code className="block bg-[#0d0d0d] border border-[#1f1f1f] text-green-400 text-xs px-4 py-3 rounded-xl break-all font-mono">
              {newKey}
            </code>
          </div>
          <button onClick={onClose} className="w-full bg-[#1a1a1a] hover:bg-[#222] text-[#ccc] text-sm py-2.5 rounded-xl transition-colors border border-[#252525]">
            Close
          </button>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell title="Create Team" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Team Name">
          <input type="text" value={form.name} onChange={e => set("name", e.target.value)} required
            placeholder="e.g. analytics" className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monthly Budget (USD)">
            <input type="number" value={form.monthly_budget_usd} onChange={e => set("monthly_budget_usd", e.target.value)}
              min="0" step="0.01" required className={inputCls} />
          </Field>
          <Field label="Max RPM">
            <input type="number" value={form.max_rpm} onChange={e => set("max_rpm", e.target.value)}
              min="1" required className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Max TPM">
            <input type="number" value={form.max_tpm} onChange={e => set("max_tpm", e.target.value)}
              min="1" required className={inputCls} />
          </Field>
          <Field label="Routing Strategy">
            <select value={form.routing_strategy} onChange={e => set("routing_strategy", e.target.value)} className={inputCls}>
              <option value="priority">priority</option>
              <option value="round_robin">round_robin</option>
              <option value="least_latency">least_latency</option>
            </select>
          </Field>
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-[#888] text-sm py-2.5 rounded-xl transition-colors border border-[#252525]">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl transition-colors font-medium">
            {loading ? "Creating…" : "Create Team"}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Edit Team Modal ───────────────────────────────────────────────────────

function EditModal({ team, onClose, onSaved }) {
  const [form, setForm] = useState({
    monthly_budget_usd: String(team.monthly_budget_usd),
    max_rpm: String(team.max_rpm),
    routing_strategy: team.routing_strategy,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await updateTeam(team.id, {
        monthly_budget_usd: parseFloat(form.monthly_budget_usd),
        max_rpm: parseInt(form.max_rpm),
        routing_strategy: form.routing_strategy,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell title={`Edit · ${team.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monthly Budget (USD)">
            <input type="number" value={form.monthly_budget_usd} onChange={e => set("monthly_budget_usd", e.target.value)}
              min="0" step="0.01" required className={inputCls} />
          </Field>
          <Field label="Max RPM">
            <input type="number" value={form.max_rpm} onChange={e => set("max_rpm", e.target.value)}
              min="1" required className={inputCls} />
          </Field>
        </div>
        <Field label="Routing Strategy">
          <select value={form.routing_strategy} onChange={e => set("routing_strategy", e.target.value)} className={inputCls}>
            <option value="priority">priority</option>
            <option value="round_robin">round_robin</option>
            <option value="least_latency">least_latency</option>
          </select>
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-[#888] text-sm py-2.5 rounded-xl transition-colors border border-[#252525]">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl transition-colors font-medium">
            {loading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────

function DeleteModal({ team, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function confirm() {
    setLoading(true)
    try {
      await deleteTeam(team.id)
      onDeleted()
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <ModalShell title="Delete Team" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm font-medium">This action cannot be undone</p>
          <p className="text-[#666] text-xs mt-1">
            Deleting <strong className="text-[#aaa]">{team.name}</strong> will permanently remove
            the team, its policies, and all associated usage records.
          </p>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-[#888] text-sm py-2.5 rounded-xl transition-colors border border-[#252525]">
            Cancel
          </button>
          <button onClick={confirm} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl transition-colors font-medium">
            {loading ? "Deleting…" : "Delete Team"}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ── Rotate Key Modal ──────────────────────────────────────────────────────

function RotateKeyModal({ team, onClose }) {
  const [loading, setLoading] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [error, setError] = useState("")

  async function confirm() {
    setLoading(true)
    try {
      const data = await rotateTeamKey(team.id)
      setNewKey(data.api_key)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell title="Rotate API Key" onClose={onClose}>
      {newKey ? (
        <div className="space-y-4">
          <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-3">
            <p className="text-green-400 text-xs">New key generated. Save it now — it won&apos;t be shown again.</p>
          </div>
          <code className="block bg-[#0d0d0d] border border-[#1f1f1f] text-green-400 text-xs px-4 py-3 rounded-xl break-all font-mono">
            {newKey}
          </code>
          <button onClick={onClose} className="w-full bg-[#1a1a1a] hover:bg-[#222] text-[#ccc] text-sm py-2.5 rounded-xl border border-[#252525]">
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[#666] text-sm">
            This will immediately invalidate the current API key for <strong className="text-[#aaa]">{team.name}</strong>.
          </p>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-[#888] text-sm py-2.5 rounded-xl border border-[#252525]">
              Cancel
            </button>
            <button onClick={confirm} disabled={loading} className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl font-medium">
              {loading ? "Rotating…" : "Rotate Key"}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}

// ── Shared UI helpers ─────────────────────────────────────────────────────

const inputCls = "w-full bg-[#0d0d0d] border border-[#252525] focus:border-green-500/40 text-[#ddd] text-sm rounded-xl px-3 py-2.5 outline-none transition-colors placeholder-[#333]"

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[#555] text-[10px] uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ErrorBox({ children }) {
  return (
    <div className="bg-red-500/8 border border-red-500/20 text-red-400 text-sm px-3 py-2.5 rounded-xl flex items-center gap-2">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
        <line x1="8" y1="5" x2="8" y2="8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
      </svg>
      {children}
    </div>
  )
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-6 w-full max-w-[440px] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors p-1">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function TeamManager() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { type: "create"|"edit"|"delete"|"rotate", team? }
  const [toggling, setToggling] = useState(null)

  async function load() {
    const data = await getTeams()
    setTeams(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleToggle(team) {
    setToggling(team.id)
    await toggleTeamStatus(team.id, !team.is_active)
    await load()
    setToggling(null)
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Team Manager</h1>
          <p className="text-[#444] text-sm mt-0.5">Create, edit, and manage gateway teams</p>
        </div>
        <button
          onClick={() => setModal({ type: "create" })}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all shadow-lg shadow-green-500/10"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          New Team
        </button>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Teams",    value: teams.length },
            { label: "Active",         value: teams.filter(t => t.is_active).length, color: "text-green-400" },
            { label: "Inactive",       value: teams.filter(t => !t.is_active).length, color: "text-[#555]" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3.5">
              <div className="text-[#444] text-[10px] uppercase tracking-wider mb-1">{label}</div>
              <div className={`text-2xl font-bold ${color ?? "text-white"}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Teams table */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              {["Name", "Budget / mo", "Max RPM", "Routing", "Status", ""].map(h => (
                <th key={h} className={`text-[10px] uppercase tracking-wider text-[#3a3a3a] font-medium py-3 px-4 ${h === "" ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(3).fill(0).map((_, i) => <SkeletonRow key={i} />)
              : teams.length === 0
                ? (
                  <tr><td colSpan={6} className="py-12 text-center text-[#3a3a3a] text-sm">No teams yet. Create one to get started.</td></tr>
                )
                : teams.map(team => (
                  <tr key={team.id} className="border-b border-[#161616] hover:bg-[#0d0d0d] transition-colors group">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${team.is_active ? "bg-green-400" : "bg-[#333]"}`} />
                        <span className="text-[#ddd] text-sm font-medium">{team.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-[#888]">${parseFloat(team.monthly_budget_usd).toFixed(2)}</td>
                    <td className="py-4 px-4 text-sm text-[#888]">{team.max_rpm}</td>
                    <td className="py-4 px-4">
                      <span className="text-[10px] bg-[#0d0d0d] border border-[#1a1a1a] px-2 py-0.5 rounded-full text-[#666]">
                        {team.routing_strategy}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${
                        team.is_active
                          ? "bg-green-500/10 text-green-400 border-green-500/25"
                          : "bg-[#0d0d0d] text-[#444] border-[#1a1a1a]"
                      }`}>
                        {team.is_active ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ActionBtn onClick={() => setModal({ type: "edit", team })} title="Edit">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M11 3l2 2-8 8H3v-2l8-8z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
                          </svg>
                        </ActionBtn>
                        <ActionBtn onClick={() => handleToggle(team)} title={team.is_active ? "Deactivate" : "Activate"} disabled={toggling === team.id}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
                            <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                        </ActionBtn>
                        <ActionBtn onClick={() => setModal({ type: "rotate", team })} title="Rotate Key">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M14 8A6 6 0 1 1 8 2a6 6 0 0 1 4.24 1.76M14 2v4h-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </ActionBtn>
                        <ActionBtn onClick={() => setModal({ type: "delete", team })} title="Delete" danger>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal?.type === "create" && (
        <CreateModal onClose={() => setModal(null)} onCreated={load} />
      )}
      {modal?.type === "edit" && (
        <EditModal team={modal.team} onClose={() => setModal(null)} onSaved={load} />
      )}
      {modal?.type === "delete" && (
        <DeleteModal team={modal.team} onClose={() => setModal(null)} onDeleted={load} />
      )}
      {modal?.type === "rotate" && (
        <RotateKeyModal team={modal.team} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

function ActionBtn({ onClick, title, children, danger, disabled }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded-lg border transition-all disabled:opacity-40 ${
        danger
          ? "text-[#555] border-[#1a1a1a] hover:text-red-400 hover:border-red-500/25 hover:bg-red-500/5"
          : "text-[#555] border-[#1a1a1a] hover:text-[#ccc] hover:border-[#2a2a2a] hover:bg-[#1a1a1a]"
      }`}
    >
      {children}
    </button>
  )
}
