// Thin wrapper around the backend REST API. The backend URL comes from an env
// var so each participant points at their own deployed backend.
const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

async function request(path, options) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    // Network error / CORS / wrong host — fetch itself rejected.
    throw new Error(`Cannot reach the backend at ${BASE}. Is VITE_BACKEND_URL set correctly?`)
  }

  // 204 No Content (e.g. DELETE) has no body to parse.
  if (res.status === 204) return null

  // Our API always returns JSON. If it didn't (e.g. VITE_BACKEND_URL points at the
  // frontend and we got index.html back), say so instead of returning junk that
  // later blows up with "x.map is not a function".
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error(
      `Backend returned a non-JSON response (HTTP ${res.status}) for ${path}. ` +
        `Check that VITE_BACKEND_URL points at the backend, not the web UI.`,
    )
  }

  if (!res.ok) {
    // The backend returns { detail: "..." } on errors; surface it to the UI.
    throw new Error(data?.detail || `Request failed (${res.status})`)
  }
  return data
}

export const getIdeas = () => request('/api/ideas')

export const createIdea = (text) =>
  request('/api/ideas', { method: 'POST', body: JSON.stringify({ text }) })

export const getIdea = (id) => request(`/api/ideas/${id}`)

export const deleteIdea = (id) => request(`/api/ideas/${id}`, { method: 'DELETE' })

export const expand = (ideaId, nodeId, direction) =>
  request('/api/expand', {
    method: 'POST',
    body: JSON.stringify({ idea_id: ideaId, node_id: nodeId, direction }),
  })

// Telegram: check whether the webhook already points at this backend, and set it.
export const getWebhookInfo = () => request('/api/telegram/webhook-info')

export const setTelegramWebhook = () =>
  request('/api/telegram/set-webhook', { method: 'POST' })
