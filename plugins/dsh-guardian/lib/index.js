/**
 * dsh-guardian — server half.
 *
 * Plugin guardian: staged loading, failure isolation and a safe mode for the
 * DSH profile plugin roster.
 *
 * DSH boots Cordis plugin trees all-or-nothing: any row that fails to import,
 * throws during apply, or stays pending takes the whole `dsh web` process
 * down (fail-loud). This plugin gives new/updated plugins a staging area
 * instead of the boot path:
 *
 *   cordis.staged.json (the candidate file, next to cordis.patch.yml)
 *       │  (guardian mounts each entry AFTER boot, through the live loader
 *       │   tree's root group — runtime mounts are catchable & rollback-safe)
 *       ├─ success → PROMOTED: entry moves into the guardian's own persisted
 *       │            list (state.json) and is mounted again on every start
 *       └─ failure → quarantined: attempts counter + error recorded; after
 *                    FREEZE_LIMIT consecutive failures the entry is frozen
 *                    and only a manual retry (panel / API) unfreezes it
 *
 * Safe mode (state.safeMode) skips every staged/promoted mount — a one-click
 * way to recover an environment a new plugin broke.
 *
 * The guardian never rewrites the user's cordis.patch.yml (a YAML round-trip
 * would drop its comments; a text splice could break boot). Its own state
 * file lives at $DSH_HOME/guardian/state.json (atomic tmp+rename).
 *
 * Self-protection (watchdog): the guardian itself must never take the process
 * down. Every async path is caught; only the loader service is a hard
 * dependency (it always exists — the guardian is part of the loader tree);
 * webServer/webRuntime are optional (a CLI profile without a web surface
 * still gets staged loading, just no HTTP panel).
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { watch } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const name = 'dsh-guardian'

export const inject = ['loader', 'timer']

/** Consecutive failures before an entry freezes (manual retry required). */
const FREEZE_LIMIT = 3

/** Fallback poll interval for the staged file when fs.watch is unavailable. */
const POLL_MS = 4000

/** Keep at most this many diagnostic events in the state. */
const EVENT_LIMIT = 20

/** How many characters of an error message to keep in state. */
const ERROR_SNIP = 300

/** Unique suffix for temp files (same-process instances must not collide). */
let tmpSeq = 0
function uniqueSuffix() {
  tmpSeq += 1
  return `${process.pid}-${Date.now().toString(36)}-${tmpSeq}`
}

// ── state file ────────────────────────────────────────────────────────────

/** Guardian state dir: $DSH_HOME/guardian (fallback: ~/.dsh/guardian). */
function guardianDir() {
  const home = process.env.DSH_HOME
  if (typeof home === 'string' && home !== '') return join(home, 'guardian')
  return join(homedir(), '.dsh', 'guardian')
}

/** Empty state document. */
function createState() {
  return { version: 1, safeMode: false, staged: {}, promoted: {}, events: [] }
}

/** Load persisted state (missing/corrupt file → fresh state). */
async function loadState() {
  try {
    const raw = await readFile(join(guardianDir(), 'state.json'), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && parsed.version === 1) return parsed
  } catch {
    // first run or unreadable file: start fresh
  }
  return createState()
}

/** Persist state atomically (tmp + rename). Never throws to callers. */
async function persistState(state) {
  const dir = guardianDir()
  const file = join(dir, 'state.json')
  const tmp = `${file}.tmp-${uniqueSuffix()}`
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(tmp, JSON.stringify(state), 'utf8')
    await rename(tmp, file)
  } catch {
    // persistence must never take the guardian down
  }
}

// ── entry tree access ──────────────────────────────────────────────────────

/**
 * Find the root Include tree of the profile. The loader tree's entries carry
 * nested subtrees; the profile root include is the one whose config file is
 * named cordis.yml (fallback: the first include-like tree found).
 * Returns { tree, profileDir } or null when nothing usable exists.
 */
function findRootTree(loader) {
  try {
    for (const entry of loader.entries()) {
      const tree = entry.subtree
      if (tree === undefined || typeof tree.filename !== 'string') continue
      const base = tree.filename.split(/[\\/]/).pop() ?? ''
      if (base === 'cordis.yml') return { tree, profileDir: dirname(tree.filename) }
    }
    for (const entry of loader.entries()) {
      const tree = entry.subtree
      if (tree === undefined || typeof tree.filename !== 'string') continue
      return { tree, profileDir: dirname(tree.filename) }
    }
  } catch {
    // broken loader tree: degrade
  }
  return null
}

// ── host header trust fence (same contract as the /api gateway) ───────────

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

// ── http helpers ───────────────────────────────────────────────────────────

function writeJson(response, status, value) {
  const payload = JSON.stringify(value)
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-cache' })
  response.end(payload)
}

async function readJsonBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) throw new Error('request body too large')
  }
  if (body === '') return {}
  return JSON.parse(body)
}

// ── staged file ────────────────────────────────────────────────────────────

/** Read the candidate file; missing/corrupt → []. */
async function readStagedFile(file) {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // missing or malformed: treat as empty
  }
  return []
}

/** Write the candidate file atomically. Returns an error object or null. */
async function writeStagedFile(file, entries) {
  const tmp = `${file}.tmp-${uniqueSuffix()}`
  try {
    await writeFile(tmp, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
    await rename(tmp, file)
    return null
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error))
  }
}

// ── error snip ─────────────────────────────────────────────────────────────

function errorSnip(error) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  return message.length > ERROR_SNIP ? `${message.slice(0, ERROR_SNIP)}…` : message
}

// ── plugin body ────────────────────────────────────────────────────────────

export function apply(ctx) {
  // Watchdog self-protection: the guardian itself must never take the process
  // down. Any synchronous failure inside apply degrades the guardian (no
  // staged loading) instead of failing the whole boot (fail-loud).
  try {
    applyInner(ctx)
  } catch (error) {
    ctx.logger?.warn(`[dsh-guardian] apply failed — guardian degraded: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function applyInner(ctx) {
  const loader = ctx.loader
  const timer = ctx.timer

  const root = findRootTree(loader)
  if (root === null) {
    ctx.logger?.warn('[dsh-guardian] no include tree found — guardian inactive')
    return
  }
  const { tree, profileDir } = root
  const stagedFile = join(profileDir, 'cordis.staged.json')

  let state = createState()
  let ready = false
  /** ids this guardian instance already attempted (no automatic retries). */
  const attempted = new Set()
  /** ids the guardian currently has mounted (unmounted on teardown). */
  const mounted = new Set()
  /** a serial chain for file writes. */
  let writeChain = Promise.resolve()
  /** fs.watch handle (closed on teardown). */
  let watcher = null

  const logEvent = (type, message) => {
    state.events.push({ time: Date.now(), type, message: String(message).slice(0, ERROR_SNIP) })
    if (state.events.length > EVENT_LIMIT) state.events.splice(0, state.events.length - EVENT_LIMIT)
  }

  const persistSoon = () => {
    writeChain = writeChain.then(() => persistState(state))
  }

  /** Reject an entry whose id clashes with an existing loader row (R11). */
  function conflictOf(id) {
    if (typeof id !== 'string' || id === '') return 'id is required'
    const store = tree.store
    if (store !== undefined && store[id] !== undefined) return `loader entry id "${id}" already exists`
    return null
  }

  /**
   * Mount one entry through the include tree's root group. This uses the
   * EntryGroup API (no tree write-back), so a failure leaves no residue and
   * never touches cordis.yml.
   */
  async function mount(id, options) {
    const conflict = conflictOf(id)
    if (conflict !== null) throw new Error(conflict)
    const entryOptions = { id, name: options.name }
    if (options.config !== undefined && options.config !== null) entryOptions.config = options.config
    await tree.root.create(entryOptions)
    mounted.add(id)
  }

  /** Unmount a mounted entry (teardown path; best effort). */
  async function unmount(id) {
    try {
      await tree.root.remove(id)
    } catch {
      // best effort — the tree may already be gone
    }
    mounted.delete(id)
  }

  /**
   * Try to mount one staged/promoted entry and fold the outcome into the
   * state. Returns 'mounted' | 'failed' (or 'skipped' when frozen).
   */
  async function mountWithState(kind, id, entry) {
    const recordKey = kind === 'staged' ? 'staged' : 'promoted'
    const record = state[recordKey][id] ?? {}
    if (record.frozen) return 'skipped'
    const name = typeof entry?.name === 'string' ? entry.name : id
    try {
      await mount(id, entry)
      // success → promote (staged moves into the persisted promoted list)
      if (kind === 'staged') {
        state.promoted[id] = {
          name,
          config: entry.config ?? undefined,
          attempts: 0,
          lastError: null,
          lastFailedAt: null,
          frozen: false,
          promotedAt: Date.now(),
        }
        delete state.staged[id]
        // the entry is now a promoted plugin: drop it from the candidate file
        const entries = await readStagedFile(stagedFile)
        const next = entries.filter((item) => item?.id !== id)
        if (next.length !== entries.length) await writeStagedFile(stagedFile, next)
      } else {
        state.promoted[id] = { ...record, attempts: 0, lastError: null, lastFailedAt: null, frozen: false }
      }
      logEvent('promote', `mounted ${name} (${id})`)
      persistSoon()
      return 'mounted'
    } catch (error) {
      const attempts = (record.attempts ?? 0) + 1
      const frozen = attempts >= FREEZE_LIMIT
      state[recordKey][id] = {
        name,
        config: entry.config ?? undefined,
        attempts,
        lastError: errorSnip(error),
        lastFailedAt: Date.now(),
        frozen,
        ...(recordKey === 'promoted' ? { promotedAt: record.promotedAt } : {}),
      }
      logEvent(frozen ? 'freeze' : 'quarantine', `${name} (${id}) failed ${attempts}x: ${error.message ?? error}`)
      persistSoon()
      return 'failed'
    }
  }

  /** Handle one staged entry (idempotent per instance run). */
  async function processStagedEntry(id, entry) {
    if (typeof id !== 'string' || id === '' || entry === null || typeof entry !== 'object') return
    if (typeof entry.name !== 'string' || entry.name === '') return
    if (attempted.has(id)) return
    attempted.add(id)
    if (state.safeMode) {
      logEvent('safe', `staged entry skipped (${id}) — safe mode`)
      persistSoon()
      return
    }
    await mountWithState('staged', id, entry)
  }

  /** Mount every promoted entry (restart path). */
  async function mountPromoted() {
    for (const id of Object.keys(state.promoted)) {
      if (attempted.has(`promoted:${id}`)) continue
      attempted.add(`promoted:${id}`)
      const record = state.promoted[id]
      if (record === undefined || record.frozen) continue
      if (mounted.has(id)) continue
      if (state.safeMode) {
        logEvent('skip', `promoted entry skipped (${id}) — safe mode`)
        persistSoon()
        continue
      }
      await mountWithState('promoted', id, { name: record.name, config: record.config })
    }
  }

  /** Sync the staged file into the guardian (new entries → staged/mount). */
  async function scanStaged() {
    const entries = await readStagedFile(stagedFile)
    for (const item of entries) {
      if (item === null || typeof item !== 'object') continue
      const id = typeof item.id === 'string' ? item.id : ''
      if (id === '') continue
      await processStagedEntry(id, item)
    }
  }

  /** Full startup pass: load state, then staged + promoted. */
  async function initialScan() {
    state = await loadState()
    // normalize fields a hand-edited or older state file may lack
    if (!Array.isArray(state.events)) state.events = []
    if (state.staged === null || typeof state.staged !== 'object') state.staged = {}
    if (state.promoted === null || typeof state.promoted !== 'object') state.promoted = {}
    if (typeof state.safeMode !== 'boolean') state.safeMode = false
    ready = true
    await scanStaged()
    await mountPromoted()
    ensureApi()
  }

  // ── run after boot settles ──────────────────────────────────────────────
  void Promise.resolve().then(() => {
    initialScan().catch((error) => {
      // the scan must never take the process down
      ctx.logger?.warn(`[dsh-guardian] initial scan failed: ${error instanceof Error ? error.message : String(error)}`)
    })
  })

  // ── staged file watching (new candidates at runtime) ─────────────────────
  try {
    watcher = watch(stagedFile, () => {
      if (!ready) return
      void scanStaged().catch(() => {})
    })
  } catch {
    watcher = null
  }

  timer.interval(() => {
    if (!ready) return
    ensureApi()
    void scanStaged().catch(() => {})
  }, POLL_MS)

  // ── diagnostic events ────────────────────────────────────────────────────
  ctx.on('loader/entry-init', (entry) => {
    logEvent('entry-init', `entry ${entry?.options?.id ?? '?'} initialized`)
  })
  ctx.on('loader/partial-dispose', (entry) => {
    logEvent('entry-dispose', `entry ${entry?.options?.id ?? '?'} disposed`)
  })
  ctx.on('hmr/config-update-failed', (filename, error) => {
    logEvent('update-failed', `${filename}: ${error instanceof Error ? error.message : String(error)}`)
    ctx.logger?.warn(`[dsh-guardian] config update failed (rolled back): ${filename}`)
    persistSoon()
  })

  // ── http api (optional surface; CLI profiles skip it) ────────────────────
  // The webServer service may mount AFTER the guardian (loader rows activate
  // concurrently), so registration is deferred and retried on every poll tick
  // until the service appears — the API must never be lost to a race.
  let apiRegistered = false
  function ensureApi() {
    if (apiRegistered) return
    const webServer = ctx.get('webServer')
    if (webServer === undefined) return
    const webRuntime = ctx.get('webRuntime')
    apiRegistered = true
    try {
      ctx.effect(() => webServer.register({
      kind: 'prefix',
      path: '/guardian/api',
      handler: async (request, response) => {
        if (!isTrustedApiRequest(request, webRuntime?.trustedHosts ?? [])) {
          writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
          return
        }
        const url = new URL(request.url ?? '/', 'http://dsh.internal')
        const method = url.pathname.startsWith('/guardian/api/') ? url.pathname.slice('/guardian/api/'.length) : ''
        try {
          if (method === 'state' && request.method === 'GET') {
            writeJson(response, 200, { ok: true, value: snapshot() })
            return
          }
          if (method === 'staged' && request.method === 'POST') {
            const payload = await readJsonBody(request)
            const id = typeof payload.id === 'string' ? payload.id : ''
            const name = typeof payload.name === 'string' ? payload.name : ''
            if (id === '' || name === '') {
              writeJson(response, 400, { ok: false, error: { message: 'id and name are required' } })
              return
            }
            if (conflictOf(id) !== null) {
              writeJson(response, 409, { ok: false, error: { message: `id "${id}" already in use` } })
              return
            }
            const entries = await readStagedFile(stagedFile)
            if (entries.some((item) => item?.id === id)) {
              writeJson(response, 409, { ok: false, error: { message: `"${id}" already in the staged file` } })
              return
            }
            entries.push({ id, name, ...(payload.config !== undefined ? { config: payload.config } : {}) })
            const writeError = await writeStagedFile(stagedFile, entries)
            if (writeError !== null) throw writeError
            await scanStaged()
            writeJson(response, 200, { ok: true, value: snapshot() })
            return
          }
          if (method === 'retry' && request.method === 'POST') {
            const payload = await readJsonBody(request)
            const id = typeof payload.id === 'string' ? payload.id : ''
            const outcome = await retryEntry(id)
            if (outcome === null) {
              writeJson(response, 404, { ok: false, error: { message: `no such entry "${id}"` } })
            } else {
              writeJson(response, 200, { ok: true, value: { outcome } })
            }
            return
          }
          if (method === 'remove' && request.method === 'POST') {
            const payload = await readJsonBody(request)
            const id = typeof payload.id === 'string' ? payload.id : ''
            await removeEntry(id)
            writeJson(response, 200, { ok: true, value: snapshot() })
            return
          }
          if (method === 'safemode' && request.method === 'POST') {
            const payload = await readJsonBody(request)
            const enabled = payload.enabled === true
            state.safeMode = enabled
            logEvent('safe-mode', enabled ? 'safe mode enabled' : 'safe mode disabled')
            if (enabled) {
              for (const id of [...mounted]) await unmount(id)
            } else {
              attempted.clear()
              await scanStaged()
              await mountPromoted()
            }
            persistSoon()
            writeJson(response, 200, { ok: true, value: snapshot() })
            return
          }
          writeJson(response, 404, { ok: false, error: { message: 'unknown guardian API method' } })
        } catch (error) {
          writeJson(response, 400, { ok: false, error: { message: error instanceof Error ? error.message : String(error) } })
        }
      },
      }), 'dsh-guardian: /guardian/api routes')
    } catch (error) {
      // registration failed: allow a later poll tick to retry
      apiRegistered = false
      ctx.logger?.warn(`[dsh-guardian] api registration failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /** Retry a staged or promoted entry (manual unfreeze). */
  async function retryEntry(id) {
    const staged = state.staged[id]
    if (staged !== undefined) {
      delete state.staged[id]
      persistSoon()
      attempted.delete(id)
      const entries = await readStagedFile(stagedFile)
      const item = entries.find((entry) => entry?.id === id)
      if (item === undefined) return 'missing'
      await processStagedEntry(id, item)
      return state.promoted[id] !== undefined ? 'mounted' : 'failed'
    }
    const promoted = state.promoted[id]
    if (promoted !== undefined) {
      state.promoted[id] = { ...promoted, attempts: 0, lastError: null, lastFailedAt: null, frozen: false }
      persistSoon()
      if (state.safeMode) return 'safe'
      attempted.delete(`promoted:${id}`)
      await mountPromoted()
      return mounted.has(id) ? 'mounted' : 'failed'
    }
    return null
  }

  /** Remove an entry everywhere (staged file + state + mounted). */
  async function removeEntry(id) {
    if (mounted.has(id)) await unmount(id)
    delete state.staged[id]
    delete state.promoted[id]
    attempted.delete(id)
    attempted.delete(`promoted:${id}`)
    const entries = await readStagedFile(stagedFile)
    const next = entries.filter((item) => item?.id !== id)
    if (next.length !== entries.length) await writeStagedFile(stagedFile, next)
    persistSoon()
  }

  /** Snapshot for the panel (leaf values only). */
  function snapshot() {
    const stagedList = []
    for (const [id, record] of Object.entries(state.staged)) {
      stagedList.push({
        id,
        name: record.name,
        attempts: record.attempts,
        frozen: record.frozen,
        lastError: record.lastError,
        lastFailedAt: record.lastFailedAt,
        status: mounted.has(id) ? 'running' : record.frozen ? 'frozen' : record.attempts > 0 ? 'failed' : 'pending',
      })
    }
    const promotedList = []
    for (const [id, record] of Object.entries(state.promoted)) {
      promotedList.push({
        id,
        name: record.name,
        attempts: record.attempts,
        frozen: record.frozen,
        lastError: record.lastError,
        lastFailedAt: record.lastFailedAt,
        promotedAt: record.promotedAt,
        status: mounted.has(id) ? 'running' : record.frozen ? 'frozen' : record.attempts > 0 ? 'failed' : 'pending',
      })
    }
    return { safeMode: state.safeMode, staged: stagedList, promoted: promotedList, events: state.events.slice(-10) }
  }

  // teardown: unmount everything the guardian mounted, then persist
  ctx.effect(() => () => {
    if (watcher !== null) {
      try {
        watcher.close()
      } catch {
        // ignore
      }
      watcher = null
    }
    for (const id of [...mounted]) {
      void unmount(id)
    }
    void persistSoon()
  }, 'dsh-guardian: teardown')
}
