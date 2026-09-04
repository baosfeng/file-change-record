// ── api: fetch helpers for the Memory views ────────────────────────────
const API_BASE = '/my-memory/api'

/** One GET memory payload into { scope, cwd, projectRoot, items }. */
function normalizeMemory(value) {
  return {
    scope: value.scope ?? 'global',
    cwd: value.cwd ?? '',
    projectRoot: value.projectRoot ?? '',
    items: Array.isArray(value.items) ? value.items : [],
  }
}

/** GET /my-memory/api/memory?scope=…&cwd=… → normalized value; rejects on bad responses. */
function fetchMemory(scope, cwd) {
  const query = cwd.trim() === '' ? `?scope=${scope}` : `?scope=${scope}&cwd=${encodeURIComponent(cwd.trim())}`
  return fetch(`${API_BASE}/memory${query}`)
    .then((res) => res.json())
    .then((body) => {
      if (body === null || body.ok !== true) throw new Error('bad memory response')
      return normalizeMemory(body.value)
    })
}

/** POST /my-memory/api/memory — a write gated on the user-consent marker. */
function writeMemory({ action, scope, cwd, id, desc }) {
  return fetch(`${API_BASE}/memory`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, scope, cwd, id, desc, confirmed: true }),
  })
    .then((res) => res.json())
    .then((body) => {
      if (body === null || body.ok !== true) throw new Error('write failed')
      return normalizeMemory({ ...body.value, scope })
    })
}

/** Current session id from localStorage ('dsh.sessions.current' → { sessionId }). */
function currentSessionId() {
  try {
    const raw = localStorage.getItem('dsh.sessions.current')
    const parsed = raw === null ? null : JSON.parse(raw)
    return typeof parsed?.sessionId === 'string' ? parsed.sessionId : ''
  } catch {
    return ''
  }
}

/** GET /my-memory/api/session → the session's working directory ('' if none).
 *  The panel uses it to auto-load the current project memory on open (issue #104). */
function fetchSessionCwd(sessionId) {
  if (sessionId === '') return Promise.resolve('')
  return fetch(`${API_BASE}/session?sessionId=${encodeURIComponent(sessionId)}`)
    .then((res) => res.json())
    .then((body) => {
      if (body === null || body.ok !== true) return ''
      return typeof body.value?.cwd === 'string' ? body.value.cwd : ''
    })
    .catch(() => '')
}

/** GET /my-memory/api/config → the entry-length guidance (issue #105):
 *  `maxEntryLength` (concise-input hint threshold) and `maxDescLength`
 *  (injection cap). Falls back to the client-side default on failure. */
function fetchConfig() {
  return fetch(`${API_BASE}/config`)
    .then((res) => res.json())
    .then((body) => {
      if (body === null || body.ok !== true) return { maxEntryLength: DEFAULT_ENTRY_LIMIT }
      const limit = body.value?.maxEntryLength
      return { maxEntryLength: Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_ENTRY_LIMIT }
    })
    .catch(() => ({ maxEntryLength: DEFAULT_ENTRY_LIMIT }))
}
