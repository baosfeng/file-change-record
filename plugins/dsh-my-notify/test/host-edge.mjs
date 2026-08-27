/**
 * Edge-path tests for the dsh-my-notify host half: covers branches the smoke
 * test does not reach — trust-fence variants, title fallbacks (cwd), ask-note
 * question fallback, broadcast failure removal and dedupe-map eviction.
 */
import { test, afterAll } from 'vitest'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

const disposeAlls = []

afterAll(() => {
  for (const disposeAll of disposeAlls.splice(0)) disposeAll()
})

function mockResponse(opts = {}) {
  const res = {
    writeHeadStatus: 0,
    writeHeadHeaders: null,
    written: [],
    ended: false,
    destroyed: false,
    closeHandlers: [],
    writeHead(status, headers) {
      res.writeHeadStatus = status
      res.writeHeadHeaders = headers
    },
    write(chunk) {
      if (opts.writeThrows) throw new Error('socket gone')
      res.written.push(String(chunk))
      return true
    },
    end(value) {
      res.ended = true
      if (value !== undefined) res.written.push(String(value))
    },
    destroy() {
      res.destroyed = true
    },
    on(_event, handler) {
      if (_event === 'close') res.closeHandlers.push(handler)
    },
    removeListener() {},
    emitClose() {
      for (const h of res.closeHandlers.splice(0)) h()
    },
  }
  return res
}

function mockRequest({ url, method = 'GET', host = '127.0.0.1:3080', secFetchSite, origin, body = '' } = {}) {
  const headers = { host }
  if (secFetchSite !== undefined) headers['sec-fetch-site'] = secFetchSite
  if (origin !== undefined) headers.origin = origin
  return {
    url,
    method,
    headers,
    async *[Symbol.asyncIterator]() {
      yield body
    },
  }
}

function boot(config = {}, opts = {}) {
  const listeners = {}
  const routes = []
  const disposers = []
  const ctx = {
    logger: { warn() {} },
    on(name, handler) {
      ;(listeners[name] ??= []).push(handler)
      return () => {}
    },
    effect(fn) {
      const dispose = fn()
      assert.equal(typeof dispose, 'function', 'every ctx.effect must return a disposer')
      disposers.push(dispose)
      return dispose
    },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
    get(name) {
      if (name === 'sessionTitle') return opts.sessionTitle === false ? undefined : ctx.sessionTitle
      if (name === 'webRuntime') return opts.trustedHosts === undefined ? undefined : { trustedHosts: opts.trustedHosts }
      return undefined
    },
    sessionTitle: opts.sessionTitle === false ? undefined : {
      get() {
        if (opts.titleThrows) throw new Error('title lookup exploded')
        return { title: '' } // empty snapshot → fall through to cwd
      },
    },
  }
  apply(ctx, config)
  const api = routes.find((r) => r.path === '/notify/api' && r.kind === 'prefix')
  assert.ok(api, 'prefix route /notify/api registered')
  disposeAlls.push(() => {
    for (const dispose of disposers.splice(0)) dispose()
  })
  return { ctx, listeners, api }
}

const topAgent = (id, extra = {}) => ({
  id,
  session: { header: { cwd: '/work/alpha', ...extra } },
})

async function dispatchEvent(listeners, name, ...args) {
  for (const handler of [...(listeners[name] ?? [])]) {
    await handler(...args)
  }
}

async function invoke(api, request, response) {
  await api.handler(request, response)
  return response
}

test('malformed origin is refused by the fence (403)', async () => {
  const { api } = boot()
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/info', origin: 'http://[' }), res)
  assert.equal(res.writeHeadStatus, 403)
})

test('malformed host header is refused by the fence (403)', async () => {
  const { api } = boot()
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/info', host: 'not a valid authority' }), res)
  assert.equal(res.writeHeadStatus, 403)
})

test('trustedHosts entry without explicit port is honored', async () => {
  const { api } = boot({}, { trustedHosts: ['notify.example.com'] })
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/info', host: 'notify.example.com:3080', origin: 'http://notify.example.com:3080' }), res)
  assert.equal(res.writeHeadStatus, 200, 'trusted host without port accepted')
})

test('title falls back to the cwd basename when no session title exists', async () => {
  const { listeners, api } = boot({}, { sessionTitle: false })
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  await dispatchEvent(listeners, 'agent/status', { agent: topAgent('cwd1'), status: 'idle' })
  const frame = res.written.join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.kind, 'end')
  assert.equal(notice.title, 'alpha', 'title falls back to the cwd basename')
})

test('title strips trailing slashes before taking the basename', async () => {
  const { listeners, api } = boot({}, { sessionTitle: false })
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  await dispatchEvent(listeners, 'agent/status', {
    agent: { id: 'cwd2', session: { header: { cwd: '/work/alpha///' } } },
    status: 'idle',
  })
  const frame = res.written.join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.title, 'alpha', 'trailing slashes stripped before basename')
})

test('title lookup errors degrade to an empty title', async () => {
  const { listeners, api } = boot({}, { sessionTitle: true, titleThrows: true })
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  await dispatchEvent(listeners, 'agent/status', { agent: topAgent('boom1'), status: 'idle' })
  const frame = res.written.join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.title, '', 'title lookup failure never breaks the notice path')
})

test('ask note falls back to the first question line (truncated at 80 chars)', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  const longQuestion = 'q'.repeat(120)
  await dispatchEvent(listeners, 'tools/pre-execute',
    { name: 'ask_user_question', agent: topAgent('askq1'), arguments: { questions: [{ question: `${longQuestion}\n第二行` }] } },
    async () => {})
  const frame = res.written.join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.kind, 'ask')
  assert.equal(notice.note.slice(0, 80), 'q'.repeat(80), 'question note truncated to 80 chars')
  assert.ok(notice.note.endsWith('…'), 'truncation marked with ellipsis')
})

test('a failing SSE client is dropped and destroyed on broadcast', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  // the socket breaks AFTER the SSE handshake: later writes must throw
  res.write = () => { throw new Error('socket gone') }
  await dispatchEvent(listeners, 'agent/status', { agent: topAgent('bad1'), status: 'idle' })
  assert.equal(res.destroyed, true, 'broken client destroyed')
  // the client was dropped: a second notice must not throw
  await dispatchEvent(listeners, 'agent/status', { agent: topAgent('bad2'), status: 'idle' })
})

test('dedupe map evicts stale keys beyond 128 entries', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  // 150 distinct sessions → map exceeds 128, stale entries evicted
  for (let i = 0; i < 150; i++) {
    await dispatchEvent(listeners, 'agent/status', { agent: topAgent(`bulk-${i}`), status: 'idle' })
  }
  const dataFrames = res.written.filter((c) => c.includes('data: '))
  assert.equal(dataFrames.length, 150, 'all notices still delivered')
})

test('unknown API method returns 404', async () => {
  const { api } = boot()
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/nope' }), res)
  assert.equal(res.writeHeadStatus, 404)
})
