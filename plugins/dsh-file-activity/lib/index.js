/**
 * dsh-file-activity — host half.
 *
 * Tracks file activity for dsh-better-sidebar:
 *  - agent tool file operations arrive as `fs/observed` events (read / write /
 *    edit / str_replace_editor / read_image ...), with the tool execution as
 *    the actor (name + parsed arguments + owning agent).
 *  - sidebar operations (files opened / saved through the better-sidebar
 *    explorer & editor) are reported by our client half through the
 *    `/file-activity/api/record` route.
 *
 * State (recent history + per-file counts) is kept per session and persisted
 * to $DSH_HOME/file-activity.json (atomic tmp+rename, debounced).
 */
import { readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'

export const name = 'dsh-file-activity'

export const inject = ['webServer', 'sessions', 'webRuntime']

/** How many recent entries to keep per session (LRU: one entry per path). */
const RECENT_LIMIT = 5

/** State file: $DSH_HOME/file-activity.json (fallback: ~/.dsh/file-activity.json). */
function stateFile() {
  const home = process.env.DSH_HOME
  if (typeof home === 'string' && home !== '') return `${home}/file-activity.json`
  return `${homedir()}/.dsh/file-activity.json`
}

/** Empty state document. */
function createState() {
  return { version: 1, sessions: {} }
}

/** Load persisted state (missing/corrupt file → fresh state). */
async function loadState(file) {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && parsed.version === 1) return parsed
  } catch {
    // first run or unreadable file: start fresh
  }
  return createState()
}

/** Map a raw operation kind (tool name or client op) to 'read' | 'write' | 'edit'. */
function mapOp(op) {
  switch (op) {
    case 'write': return 'write'
    case 'edit':
    case 'str_replace_editor': return 'edit'
    case 'read':
    case 'read_image':
    default: return 'read'
  }
}

/**
 * Fold one observed operation into the state.
 * 'write' is classified create vs modify through the per-session known-file
 * registry (first contact = create, later writes = modify); edits are always
 * modifies. Each file's counters also track firstSeen (first contact time,
 * i.e. creation time) and lastSeen (most recent activity time).
 * Returns true when a record was produced.
 */
function applyRecord(state, sessionId, path, op, time) {
  if (typeof sessionId !== 'string' || sessionId === '') return false
  if (typeof path !== 'string' || path === '') return false
  if (path.includes('\0')) return false
  const session = state.sessions[sessionId] ?? (state.sessions[sessionId] = { known: {}, counts: {}, recent: [] })
  const timestamp = typeof time === 'number' ? time : Date.now()
  const firstSeen = typeof session.known[path] === 'number' ? session.known[path] : timestamp
  const finalOp = op === 'write' ? (session.known[path] ? 'modify' : 'create') : op === 'edit' ? 'modify' : 'read'
  session.known[path] = firstSeen
  const counts = session.counts[path] ?? (session.counts[path] = { read: 0, create: 0, modify: 0 })
  if (finalOp === 'create') counts.create += 1
  else if (finalOp === 'modify') counts.modify += 1
  else counts.read += 1
  counts.firstSeen = firstSeen
  counts.lastSeen = timestamp
  // Newest-first LRU history: revisiting a path moves it to the front
  // instead of appending a duplicate; cap at RECENT_LIMIT entries.
  const existing = session.recent.findIndex((entry) => entry.path === path)
  if (existing !== -1) session.recent.splice(existing, 1)
  session.recent.unshift({ path, op: finalOp, time: timestamp })
  if (session.recent.length > RECENT_LIMIT) session.recent.length = RECENT_LIMIT
  return true
}

/** Host-header trust fence (same behavioral contract as the /api gateway). */
function isTrustedApiRequest(request, trustedHosts) {
  const host = header(request.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

function header(headers, name) {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function canonicalAuthority(entry, entryUrl) {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

function isTrustedAuthority(hostUrl, trustedHosts) {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/** Read a JSON request body (bounded). */
async function readJsonBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) throw new Error('request body too large')
  }
  if (body === '') return {}
  return JSON.parse(body)
}

function writeJson(response, status, value) {
  const payload = JSON.stringify(value)
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-cache' })
  response.end(payload)
}

function writeError(response, error) {
  const message = error instanceof Error ? error.message : String(error)
  writeJson(response, 400, { ok: false, error: { message } })
}

/** Session working directory, mirroring better-sidebar's resolution. */
function sessionCwdOf(ctx, sessionId) {
  const session = ctx.sessions.get(sessionId)
  const headerCwd = session?.header?.cwd
  if (typeof headerCwd === 'string' && headerCwd !== '') return headerCwd
  return process.cwd()
}

export function apply(ctx) {
  const file = stateFile()
  let state = createState()
  let ready = false
  const pending = []
  let persistTimer = null
  let dirtyChain = Promise.resolve()

  const persistNow = () => {
    const snapshot = JSON.stringify(state)
    const tmp = `${file}.tmp-${process.pid}`
    dirtyChain = dirtyChain.then(async () => {
      try {
        await writeFile(tmp, snapshot, 'utf8')
        await rename(tmp, file)
      } catch (error) {
        ctx.logger?.warn(`[dsh-file-activity] persist failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }).catch(() => {})
  }

  const persistSoon = () => {
    if (persistTimer !== null) return
    persistTimer = setTimeout(() => {
      persistTimer = null
      persistNow()
    }, 500)
  }

  void loadState(file).then((loaded) => {
    if (loaded.sessions === undefined || typeof loaded.sessions !== 'object') loaded.sessions = {}
    // Trim pre-existing history to the current cap and drop duplicate paths
    // (LRU semantics: one entry per path, newest occurrence wins — the
    // array is newest-first, so the first occurrence of each path is kept).
    let trimmed = false
    for (const session of Object.values(loaded.sessions)) {
      if (Array.isArray(session.recent)) {
        const seen = new Set()
        const deduped = session.recent.filter((entry) => {
          if (typeof entry?.path !== 'string' || entry.path === '') return false
          if (seen.has(entry.path)) return false
          seen.add(entry.path)
          return true
        })
        if (deduped.length !== session.recent.length) trimmed = true
        session.recent = deduped
        if (session.recent.length > RECENT_LIMIT) {
          session.recent.length = RECENT_LIMIT
          trimmed = true
        }
      }
    }
    state = loaded
    ready = true
    // Drain any records that arrived while the state was still loading.
    const drained = pending.splice(0)
    for (const item of drained) {
      applyRecord(state, item.sessionId, item.path, mapOp(item.op), item.time)
    }
    if (drained.length > 0 || trimmed) persistSoon()
  })

  /** Record an operation once state is loaded (buffered before that). */
  const record = (sessionId, path, op, time) => {
    if (!ready) {
      pending.push({ sessionId, path, op, time })
      return true
    }
    if (applyRecord(state, sessionId, path, op, time)) {
      persistSoon()
      return true
    }
    return false
  }

  // ── agent-side file operations ──────────────────────────────────────────
  ctx.on('fs/observed', (target, observation, actor) => {
    // Only authoritative PRESENT observations mean a file was actually
    // touched; absent observations (e.g. a failed read of a missing file)
    // are noise.
    if (observation === undefined || observation === null || observation.kind !== 'present') return
    if (actor === undefined || actor === null) return
    const toolName = typeof actor.name === 'string' ? actor.name : ''
    if (toolName === '') return
    const sessionId = actor.agent?.id
    if (typeof sessionId !== 'string' || sessionId === '') return
    // Prefer the backend-resolved absolute path; fall back to the raw argument.
    const args = actor.arguments
    const rawPath = typeof target?.displayPath === 'string' && target.displayPath !== ''
      ? target.displayPath
      : args !== null && typeof args === 'object' && typeof args.file_path === 'string'
        ? args.file_path
        : ''
    if (rawPath === '') return
    record(sessionId, rawPath, mapOp(toolName), Date.now())
  })

  // ── routes ──────────────────────────────────────────────────────────────
  const fence = (request) => isTrustedApiRequest(request, ctx.webRuntime.trustedHosts)

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/file-activity/api',
    handler: async (request, response) => {
      if (!fence(request)) {
        writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      const url = new URL(request.url ?? '/', 'http://dsh.internal')
      const pathname = url.pathname
      const method = pathname.startsWith('/file-activity/api/') ? pathname.slice('/file-activity/api/'.length) : undefined
      try {
        if (method === 'record' && request.method === 'POST') {
          const payload = await readJsonBody(request)
          const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : ''
          const path = typeof payload.path === 'string' ? payload.path : ''
          const op = typeof payload.op === 'string' ? payload.op : 'read'
          record(sessionId, path, mapOp(op), Date.now())
          writeJson(response, 200, { ok: true })
          return
        }
        if (method === 'stats' && request.method === 'GET') {
          const sessionId = url.searchParams.get('sessionId') ?? ''
          // Session working directory, for client-side relative-path display.
          const cwd = sessionCwdOf(ctx, sessionId)
          const session = state.sessions[sessionId]
          if (session === undefined) {
            writeJson(response, 200, { ok: true, value: { recent: [], counts: {}, cwd } })
            return
          }
          // Snapshot the leaf fields only — no live objects cross the wire.
          const recent = session.recent.map((entry) => ({ path: entry.path, op: entry.op, time: entry.time }))
          const counts = {}
          for (const [path, counter] of Object.entries(session.counts)) {
            counts[path] = { read: counter.read, create: counter.create, modify: counter.modify, firstSeen: counter.firstSeen, lastSeen: counter.lastSeen }
          }
          writeJson(response, 200, { ok: true, value: { recent, counts, cwd } })
          return
        }
        if (method === 'clear' && request.method === 'POST') {
          const payload = await readJsonBody(request)
          const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : ''
          if (sessionId !== '' && state.sessions[sessionId] !== undefined) {
            delete state.sessions[sessionId]
            persistSoon()
          }
          writeJson(response, 200, { ok: true })
          return
        }
        writeJson(response, 404, { ok: false, error: { message: 'unknown file-activity API method' } })
      } catch (error) {
        writeError(response, error)
      }
    },
  }), 'dsh-file-activity: /file-activity/api routes')

  // Tear down on unload: flush pending persistence.
  ctx.effect(() => () => {
    if (persistTimer !== null) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    persistNow()
    void dirtyChain
  }, 'dsh-file-activity: persistence teardown')
}
