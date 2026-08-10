// VITE_API_URL is set at build time on Render; falls back to local dev gateway
const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || "admin-secret-change-in-production"

const adminHeaders = { "X-Admin-Key": ADMIN_KEY, "Content-Type": "application/json" }

export const TEAM_KEYS = {
  engineering: "gw-engineering-team-key-demo",
  marketing: "gw-marketing-team-key-demo",
  "internal-tools": "gw-internal-tools-key-demo",
}

export async function getHealth() {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(8000) })
    return r.ok
  } catch {
    return false
  }
}

// Safe fetch: always returns an array, never throws on 4xx/5xx
async function safeArray(url, options) {
  try {
    const r = await fetch(url, options)
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function getProviders() {
  return safeArray(`${BASE}/admin/providers`, { headers: adminHeaders })
}

export async function getBudget() {
  return safeArray(`${BASE}/admin/usage/budget`, { headers: adminHeaders })
}

export async function getUsageByTeam(hours = 24) {
  return safeArray(`${BASE}/admin/usage/by-team?since_hours=${hours}`, { headers: adminHeaders })
}

export async function getUsageByProvider(hours = 24) {
  return safeArray(`${BASE}/admin/usage/by-provider?since_hours=${hours}`, { headers: adminHeaders })
}

export async function getTeams() {
  return safeArray(`${BASE}/admin/teams`, { headers: adminHeaders })
}

export async function getMetrics() {
  const r = await fetch(`${BASE}/metrics`)
  return r.text()
}

export function parseMetric(text, name) {
  if (!text) return 0
  let total = 0
  for (const line of text.split("\n")) {
    if (line.startsWith(name) && !line.startsWith("#")) {
      const val = parseFloat(line.split(" ").pop())
      if (!isNaN(val)) total += val
    }
  }
  return Math.round(total)
}

export async function chatCompletion(apiKey, body) {
  const r = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  return { status: r.status, data }
}

export async function enableProvider(id) {
  const r = await fetch(`${BASE}/admin/providers/${id}/enable`, { method: "POST", headers: adminHeaders })
  return r.json()
}

export async function disableProvider(id) {
  const r = await fetch(`${BASE}/admin/providers/${id}/disable`, { method: "POST", headers: adminHeaders })
  return r.json()
}

export async function resetCB(id) {
  const r = await fetch(`${BASE}/admin/providers/${id}/reset-circuit-breaker`, { method: "POST", headers: adminHeaders })
  return r.json()
}
