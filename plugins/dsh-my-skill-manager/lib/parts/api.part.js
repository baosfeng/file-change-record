// ── api: fetch helpers for the Skill Manager views ─────────────────────
const API_BASE = '/my-skill-manager/api'

/** One GET list payload into { skills, globalDisabled, projectDisabled, cwd, projectRoot, diagnostics }. */
function normalizeList(value) {
  return {
    skills: Array.isArray(value.skills) ? value.skills : [],
    globalDisabled: value.global?.disabled ?? [],
    projectDisabled: Array.isArray(value.project) ? value.project : [],
    cwd: value.cwd ?? '',
    projectRoot: value.projectRoot ?? '',
    diagnostics: value.diagnostics ?? { missing: [] },
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
