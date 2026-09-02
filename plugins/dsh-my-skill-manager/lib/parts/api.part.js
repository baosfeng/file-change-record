// ── api: fetch helpers for the Skill Manager views ─────────────────────
const API_BASE = '/my-skill-manager/api'

/** One GET list payload into { skills, globalDisabled, projectDisabled, cwd, projectRoot, diagnostics, usage }. */
function normalizeList(value) {
  return {
    skills: Array.isArray(value.skills) ? value.skills : [],
    globalDisabled: value.global?.disabled ?? [],
    projectDisabled: Array.isArray(value.project) ? value.project : [],
    cwd: value.cwd ?? '',
    projectRoot: value.projectRoot ?? '',
    diagnostics: value.diagnostics ?? { missing: [] },
    usage: value.usage ?? {},
  }
}

/** GET /my-skill-manager/api/list → normalized value; rejects on bad responses. */
function fetchList(cwd) {
  const query = cwd.trim() === '' ? '' : `?cwd=${encodeURIComponent(cwd.trim())}`
  return fetch(`${API_BASE}/list${query}`)
    .then((res) => res.json())
    .then((body) => {
      if (body === null || body.ok !== true) throw new Error('bad list response')
      return normalizeList(body.value)
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

/** GET /my-skill-manager/api/session → the session's working directory ('' if none). */
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

/** GET /my-skill-manager/api/rescan → invalidate + fresh normalized value. */
function rescanCatalog(cwd) {
  const query = cwd.trim() === '' ? '' : `?cwd=${encodeURIComponent(cwd.trim())}`
  return fetch(`${API_BASE}/rescan${query}`)
    .then((res) => res.json())
    .then((body) => {
      if (body === null || body.ok !== true) throw new Error('rescan failed')
      return normalizeList(body.value)
    })
}

/** PUT /my-skill-manager/api/config; rejects on bad responses. */
function saveConfig(scope, disabled, cwd) {
  return fetch(`${API_BASE}/config`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope, disabled, cwd }),
  })
    .then((res) => res.json())
    .then((body) => {
      if (body === null || body.ok !== true) throw new Error('save failed')
    })
}
