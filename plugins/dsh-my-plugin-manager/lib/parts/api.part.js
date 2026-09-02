// ── api: fetch helpers for the Plugin Manager views ────────────────────
const API_BASE = '/my-plugin-manager/api'

/** GET /installed → { entries: [{ moduleName, enabled, fiberPhase, version }] }. */
function fetchInstalled() {
  return fetchJson(`${API_BASE}/installed`)
}

/** GET /search?q= → { results: [{ name, version, description, author }] }. */
function fetchSearch(query) {
  return fetchJson(`${API_BASE}/search?q=${encodeURIComponent(query.trim())}`)
}

/** GET /detail?name=&version= → plugin detail (README/versions/deps). */
function fetchDetail(name, version) {
  let url = `${API_BASE}/detail?name=${encodeURIComponent(name)}`
  if (version) url += `&version=${encodeURIComponent(version)}`
  return fetchJson(url)
}

/** GET /updates → { outdated: [{ name, current, latest }], error? }. */
function fetchUpdates() {
  return fetchJson(`${API_BASE}/updates`)
}

/** POST /install { source } → { ok, error? }. */
function postInstall(source) {
  return fetchJson(`${API_BASE}/install`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source }),
  })
}

/** POST /uninstall { name } → { ok, error? }. */
function postUninstall(name) {
  return fetchJson(`${API_BASE}/uninstall`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

function fetchJson(url, options) {
  return fetch(url, options)
    .then((res) => res.json())
    .then((body) => {
      if (body === null || body.ok !== true) throw new Error(body?.error?.message ?? 'bad response')
      return body.value ?? {}
    })
}
