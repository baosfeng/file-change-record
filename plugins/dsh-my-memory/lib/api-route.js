/**
 * dsh-my-memory — /my-memory/api route handler.
 *
 *  - GET  /my-memory/api/memory?scope=global|project&cwd=… → the memory
 *    items of one scope (read-only; project scope resolves the project root
 *    from cwd);
 *  - POST /my-memory/api/memory → a write operation (add / update / delete).
 *    Every write MUST carry `confirmed: true` — the user-consent marker the
 *    settings panel sets only after its custom confirmation UI (delete is
 *    red, save is green). A write without the marker is refused with 400:
 *    memory must never change silently.
 *
 * Every request passes the trust fence first; responses are JSON with
 * cache-control: no-cache.
 */
import { readJsonBody, writeError, writeJson } from './http.js'
import { findProjectRoot } from './store.js'

/** The cwd query parameter, normalized to undefined when absent. */
function cwdOf(url) {
  const cwd = url.searchParams.get('cwd') ?? ''
  return cwd !== '' ? cwd : undefined
}

export function createApiHandler({ globalStore, getProjectStore, fence }) {
  return async (request, response) => {
    if (!fence(request)) {
      writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      return
    }
    const url = new URL(request.url ?? '/', 'http://dsh.internal')
    try {
      if (url.pathname.endsWith('/memory') && request.method === 'GET') {
        await handleList(url, response, globalStore, getProjectStore)
        return
      }
      if (url.pathname.endsWith('/memory') && request.method === 'POST') {
        await handleWrite(request, response, globalStore, getProjectStore)
        return
      }
      writeJson(response, 404, { ok: false, error: { message: 'unknown my-memory API method' } })
    } catch (error) {
      writeError(response, error)
    }
  }
}

/** GET /memory — one scope's items (global, or project resolved from cwd). */
async function handleList(url, response, globalStore, getProjectStore) {
  const scope = url.searchParams.get('scope') ?? 'global'
  const cwd = cwdOf(url)
  if (scope !== 'global' && scope !== 'project') {
    writeJson(response, 400, {
      ok: false,
      error: { message: 'scope must be "global" or "project"' },
    })
    return
  }
  if (scope === 'project' && cwd === undefined) {
    writeJson(response, 400, { ok: false, error: { message: 'project scope requires a cwd' } })
    return
  }
  const store = scope === 'global' ? globalStore : await getProjectStore(cwd)
  const projectRoot = scope === 'project' ? await findProjectRoot(cwd) : ''
  writeJson(response, 200, {
    ok: true,
    value: { scope, cwd: cwd ?? '', projectRoot, items: store.list() },
  })
}

/** POST /memory — add / update / delete, gated on the user-consent marker. */
async function handleWrite(request, response, globalStore, getProjectStore) {
  const payload = await readJsonBody(request)
  const gate = writeGate(payload)
  if (gate !== null) {
    writeJson(response, gate.status, { ok: false, error: { message: gate.message } })
    return
  }
  const store = payload.scope === 'global' ? globalStore : await getProjectStore(payload.cwd)
  const outcome = await applyWrite(store, payload)
  if (outcome !== null) {
    writeJson(response, outcome.status, { ok: false, error: { message: outcome.message } })
    return
  }
  writeJson(response, 200, { ok: true, value: { items: store.list() } })
}

/** Validate the write payload; returns a rejection or null when it passes. */
function writeGate(payload) {
  if (payload.confirmed !== true) {
    return { status: 400, message: 'write requires confirmed: true (user consent)' }
  }
  if (payload.scope !== 'global' && payload.scope !== 'project') {
    return { status: 400, message: 'scope must be "global" or "project"' }
  }
  const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : undefined
  if (payload.scope === 'project' && cwd === undefined) {
    return { status: 400, message: 'project scope requires a cwd' }
  }
  payload.cwd = cwd
  return null
}

/** Apply one write action to a store; returns a rejection or null on success. */
async function applyWrite(store, payload) {
  if (payload.action === 'add') return applyAdd(store, payload)
  if (payload.action === 'update') return applyUpdate(store, payload)
  if (payload.action === 'delete') return applyDelete(store, payload)
  return { status: 400, message: 'action must be "add", "update" or "delete"' }
}

/** Add one memory item (desc required). */
async function applyAdd(store, payload) {
  const desc = typeof payload.desc === 'string' ? payload.desc.trim() : ''
  if (desc === '') return { status: 400, message: 'add requires a non-empty desc' }
  await store.add(desc)
  return null
}

/** Update one memory item (id + desc required). */
async function applyUpdate(store, payload) {
  const id = typeof payload.id === 'string' ? payload.id : ''
  const desc = typeof payload.desc === 'string' ? payload.desc.trim() : ''
  if (id === '' || desc === '') return { status: 400, message: 'update requires id and a non-empty desc' }
  if ((await store.update(id, desc)) === undefined) return { status: 404, message: 'memory item not found' }
  return null
}

/** Delete one memory item (id required). */
async function applyDelete(store, payload) {
  const id = typeof payload.id === 'string' ? payload.id : ''
  if (id === '') return { status: 400, message: 'delete requires an id' }
  if (!(await store.remove(id))) return { status: 404, message: 'memory item not found' }
  return null
}
