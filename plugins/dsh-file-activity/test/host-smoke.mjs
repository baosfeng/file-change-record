/**
 * Smoke test for the dsh-file-activity host half: mounts the plugin against a
 * mocked context and drives fs/observed events + HTTP routes through it.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../lib/index.js'

// ── helpers ────────────────────────────────────────────────────────────────
function makeResponse() {
  return {
    _status: 0,
    _body: '',
    _headers: {},
    writeHead(status, headers) {
      this._status = status
      this._headers = headers ?? {}
    },
    end(body) {
      this._body = body ?? ''
    },
  }
}

function makeRequest(method, url, body) {
  const req = {
    method,
    url,
    headers: { host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin', origin: 'http://127.0.0.1:3080' },
    [Symbol.asyncIterator]() {
      const chunks = body === undefined ? [] : [JSON.stringify(body)]
      let i = 0
      return {
        next: () => Promise.resolve(i < chunks.length ? { value: chunks[i++], done: false } : { done: true }),
      }
    },
  }
  return req
}

/** Collect the handler the plugin registers for a route prefix. */
function captureRoute(prefix) {
  let captured
  const holder = {
    set: (route) => {
      if (route.kind === 'prefix' && route.path === prefix) captured = route
    },
    get: () => captured,
  }
  return holder
}

// ── test ─────────────────────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'dsh-file-activity-test-'))
process.env.DSH_HOME = dir
const statePath = join(dir, 'file-activity.json')

/** Build a plugin context, run apply, wait for state load, return handles. */
async function boot() {
  const routeHolder = captureRoute('/file-activity/api')
  const ctx = {
    logger: { warn: () => {} },
    webRuntime: { trustedHosts: [] },
    sessions: { get: () => undefined },
    webServer: { register: (route) => { routeHolder.set(route); return () => {} } },
    events: [],
    effectCallbacks: [],
    on(name, listener) {
      this.events.push({ name, listener })
    },
    effect(callback, label) {
      this.effectCallbacks.push({ callback, label })
      const disposer = callback()
      if (typeof disposer === 'function') this.effectCallbacks.push({ disposer, label: `${label}:disposer` })
      return disposer
    },
  }
  apply(ctx)
  // wait for async state load
  await new Promise((resolve) => setTimeout(resolve, 50))
  return { ctx, getRoute: () => routeHolder.get() }
}

function emitObserved(ctx, toolName, sessionId, path, opts) {
  const { listener } = ctx.events.find((e) => e.name === 'fs/observed')
  const { observation, args } = opts ?? {}
  listener(
    { displayPath: path },
    observation ?? { kind: 'present' },
    { name: toolName, agent: { id: sessionId }, arguments: args ?? { file_path: path } },
  )
}

async function callRoute(getRoute, method, url, body) {
  const route = getRoute()
  assert.ok(route, 'route registered')
  const res = makeResponse()
  await route.handler(makeRequest(method, url, body), res)
  return { status: res._status, json: JSON.parse(res._body) }
}

try {
  const { ctx, getRoute } = await boot()
  const sid = 'session-1'

  // 1. agent read → read count + recent
  emitObserved(ctx, 'read', sid, '/work/a.txt')
  emitObserved(ctx, 'read', sid, '/work/a.txt')

  // 2. first write → create
  emitObserved(ctx, 'write', sid, '/work/b.txt')

  // 3. second write → modify
  emitObserved(ctx, 'write', sid, '/work/b.txt')

  // 4. edit → modify
  emitObserved(ctx, 'edit', sid, '/work/a.txt')

  // 5. absent observation → ignored
  emitObserved(ctx, 'read', sid, '/work/missing.txt', { observation: { kind: 'absent' } })

  // 6. client-reported sidebar write → create
  const rec = await callRoute(getRoute, 'POST', '/file-activity/api/record', { sessionId: sid, path: '/work/c.txt', op: 'write' })
  assert.equal(rec.status, 200, 'record route status')

  // 7. stats
  const stats = await callRoute(getRoute, 'GET', `/file-activity/api/stats?sessionId=${sid}`)
  assert.equal(stats.status, 200)
  const value = stats.json.value
  assert.equal(value.counts['/work/a.txt'].read, 2, 'a.txt reads')
  assert.equal(value.counts['/work/a.txt'].modify, 1, 'a.txt modifies')
  assert.equal(value.counts['/work/b.txt'].create, 1, 'b.txt creates')
  assert.equal(value.counts['/work/b.txt'].modify, 1, 'b.txt modifies')
  assert.equal(value.counts['/work/c.txt'].create, 1, 'c.txt create via route')
  assert.equal(value.counts['/work/missing.txt'], undefined, 'absent ignored')
  assert.equal(value.recent.length, 6, 'recent records')
  assert.equal(value.recent[0].path, '/work/c.txt', 'most recent first')

  // 7b. firstSeen / lastSeen tracked per file
  const aCounts = value.counts['/work/a.txt']
  const bCounts = value.counts['/work/b.txt']
  assert.equal(typeof aCounts.firstSeen, 'number', 'a.txt firstSeen present')
  assert.equal(typeof aCounts.lastSeen, 'number', 'a.txt lastSeen present')
  assert.equal(typeof bCounts.firstSeen, 'number', 'b.txt firstSeen present')
  assert.ok(aCounts.lastSeen >= aCounts.firstSeen, 'a.txt lastSeen >= firstSeen')
  assert.ok(bCounts.lastSeen >= bCounts.firstSeen, 'b.txt lastSeen >= firstSeen (create then modify)')

  // 7c. recent history capped at RECENT_LIMIT (10)
  for (let i = 0; i < 12; i++) {
    emitObserved(ctx, 'read', sid, `/work/cap-${i}.txt`)
  }
  const capped = await callRoute(getRoute, 'GET', `/file-activity/api/stats?sessionId=${sid}`)
  assert.equal(capped.json.value.recent.length, 10, 'recent capped at 10')
  assert.equal(capped.json.value.recent[0].path, '/work/cap-11.txt', 'newest entry kept')
  assert.equal(capped.json.value.counts['/work/cap-0.txt'].read, 1, 'capped file still counted')
  assert.equal(typeof capped.json.value.counts['/work/cap-0.txt'].firstSeen, 'number', 'capped file firstSeen present')

  // 8. persistence file written (debounced 500ms → wait)
  await new Promise((resolve) => setTimeout(resolve, 800))
  const persisted = JSON.parse(readFileSync(statePath, 'utf8'))
  assert.equal(persisted.sessions[sid].counts['/work/b.txt'].create, 1, 'persisted creates')

  // 9. unknown route → 404
  const nf = await callRoute(getRoute, 'GET', '/file-activity/api/nope')
  assert.equal(nf.status, 404)

  // 10. clear route
  const clr = await callRoute(getRoute, 'POST', '/file-activity/api/clear', { sessionId: sid })
  assert.equal(clr.status, 200)
  const after = await callRoute(getRoute, 'GET', `/file-activity/api/stats?sessionId=${sid}`)
  assert.deepEqual(after.json.value.counts, {}, 'cleared counts')

  // 11. persisted history longer than the cap is trimmed on load
  // (wait out the clear's debounced persist first, then seed an oversized file)
  await new Promise((resolve) => setTimeout(resolve, 600))
  writeFileSync(statePath, JSON.stringify({
    version: 1,
    sessions: {
      'session-2': {
        known: {},
        counts: {},
        recent: Array.from({ length: 15 }, (_, i) => ({ path: `/work/old-${14 - i}.txt`, op: 'read', time: 1000 + (14 - i) })),
      },
    },
  }), 'utf8')
  const { getRoute: getRoute2 } = await boot()
  const trimmed = await callRoute(getRoute2, 'GET', '/file-activity/api/stats?sessionId=session-2')
  assert.equal(trimmed.json.value.recent.length, 10, 'pre-existing history trimmed to 10 on load')
  assert.equal(trimmed.json.value.recent[0].path, '/work/old-14.txt', 'newest entry kept after trim')

  console.log('ALL HOST SMOKE TESTS PASSED')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
