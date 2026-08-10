const BASE = "http://127.0.0.1:8000"
const ADMIN_KEY = "admin-secret-change-in-production"

const adminHeaders = { "X-Admin-Key": ADMIN_KEY, "Content-Type": "application/json" }

export const TEAM_KEYS = {
  engineering: "gw-engineering-team-key-demo",
  marketing: "gw-marketing-team-key-demo",
  "internal-tools": "gw-internal-tools-key-demo",
}

export async function getHealth() {
  const r = await fetch(`${BASE}/health`)
  return r.json()
}

export async function getProviders() {
  const r = await fetch(`${BASE}/admin/providers`, { headers: adminHeaders })
  return r.json()
}

export async function getBudget() {
  const r = await fetch(`${BASE}/admin/usage/budget`, { headers: adminHeaders })
  return r.json()
}

export async function getUsageByTeam(hours = 24) {
  const r = await fetch(`${BASE}/admin/usage/by-team?since_hours=${hours}`, { headers: adminHeaders })
  return r.json()
}

export async function getUsageByProvider(hours = 24) {
  const r = await fetch(`${BASE}/admin/usage/by-provider?since_hours=${hours}`, { headers: adminHeaders })
  return r.json()
}

export async function getTeams() {
  const r = await fetch(`${BASE}/admin/teams`, { headers: adminHeaders })
  return r.json()
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
