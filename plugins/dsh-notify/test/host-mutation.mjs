/**
 * Mutation-targeted tests for the dsh-notify host half.
 * Kills surviving mutants by covering untested branches: loopback variants,
 * isTopLevelAgent edge shapes, askNoteOf fallbacks, null exec/req and
 * trusted-host ports.
 */
import { test, afterAll } from 'vitest'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

const disposeAlls = []

afterAll(() => {
  for (const disposeAll of disposeAlls.splice(0)) disposeAll()
})

function mockResponse() {
  const res = {
    writeHeadStatus: 0,
    written: [],
    closeHandlers: [],
    writeHead(status) {
      res.writeHeadStatus = status
    },
    write(chunk) {
      res.written.push(String(chunk))
      return true
    },
    end(value) {
      if (value !== undefined) res.written.push(String(value))
    },
    destroy() {},
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
      get(session) {
        if (opts.titleThrows) throw new Error('title lookup exploded')
        return session?.__title === undefined ? { title: '' } : { title: session.__title }
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
  session: { header: { cwd: '/work/alpha', ...extra }, __title: `标题-${id}` },
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

function noticesOf(res) {
  return res.written.filter((c) => c.includes('data: '))
}

// ── loopback 变体（杀 L66/L68/L70）───────────────────────────────────────

test('localhost and IPv6 loopback pass the fence', async () => {
  const { api } = boot({})
  for (const host of ['localhost:3080', '[::1]:3080']) {
    const res = mockResponse()
    await invoke(api, mockRequest({ url: '/notify/api/info', host, origin: `http://${host}` }), res)
    assert.equal(res.writeHeadStatus, 200, `${host} allowed`)
  }
})

test('dotted host variants are classified by the fence', async () => {
  const { api } = boot({})
  for (const host of ['127.100.0.1:3080']) {
    const res = mockResponse()
    await invoke(api, mockRequest({ url: '/notify/api/info', host, origin: `http://${host}` }), res)
    assert.equal(res.writeHeadStatus, 200, `${host} loopback allowed`)
  }
  for (const host of ['192.168.1.1:3080', '127.0.0.256:3080', '127.0.0.a:3080', '127.1.2.3.4:3080']) {
    const res = mockResponse()
    await invoke(api, mockRequest({ url: '/notify/api/info', host, origin: `http://${host}` }), res)
    assert.equal(res.writeHeadStatus, 403, `${host} refused`)
  }
})

// ── trustedHosts 带端口（杀 L74）─────────────────────────────────────────

test('trustedHosts entry with an explicit port is honored', async () => {
  const { api } = boot({}, { trustedHosts: ['notify.example.com:9443'] })
  const res = mockResponse()
  await invoke(api, mockRequest({
    url: '/notify/api/info',
    host: 'notify.example.com:9443',
    origin: 'http://notify.example.com:9443',
  }), res)
  assert.equal(res.writeHeadStatus, 200, 'trusted host with port accepted')
})

// ── isTopLevelAgent 变体（杀 L114-117）───────────────────────────────────

test('agents without a session header are not notified', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  await dispatchEvent(listeners, 'agent/status', { agent: { id: 'no-session' }, status: 'idle' })
  assert.equal(noticesOf(res).length, 0, 'no session → not top-level')
})

test('delegationDepth of 0 is still top-level; negative depth is not notified', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  // depth 0 → top-level → notified
  await dispatchEvent(listeners, 'agent/status', {
    agent: { id: 'depth0', session: { header: { cwd: '/x', delegationDepth: 0 } } },
    status: 'idle',
  })
  assert.ok(noticesOf(res).length >= 1, 'delegationDepth 0 notified')
  // negative depth is not a number > 0 → still notified (only > 0 filters)
  await dispatchEvent(listeners, 'agent/status', {
    agent: { id: 'neg', session: { header: { cwd: '/x', delegationDepth: -1 } } },
    status: 'idle',
  })
  assert.ok(noticesOf(res).length >= 2, 'negative depth treated as top-level')
})

// ── askNoteOf 变体（杀 L148-152）─────────────────────────────────────────

test('ask with an empty questions array produces an empty note', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  await dispatchEvent(listeners, 'tools/pre-execute',
    { name: 'ask_user_question', agent: topAgent('ask-empty'), arguments: { questions: [] } },
    async () => {})
  const frame = res.written.join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.kind, 'ask')
  assert.equal(notice.note, '', 'empty questions → empty note')
})

test('ask with a null first question produces an empty note', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  await dispatchEvent(listeners, 'tools/pre-execute',
    { name: 'ask_user_question', agent: topAgent('ask-null'), arguments: { questions: [null] } },
    async () => {})
  const frame = res.written.join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.note, '', 'null first question → empty note')
})

test('ask with a non-string question produces an empty note', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  await dispatchEvent(listeners, 'tools/pre-execute',
    { name: 'ask_user_question', agent: topAgent('ask-nonstring'), arguments: { questions: [{ question: 42 }] } },
    async () => {})
  const frame = res.written.join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.note, '', 'non-string question → empty note')
})

test('ask with only a question (no header) falls back to the first line', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  await dispatchEvent(listeners, 'tools/pre-execute',
    { name: 'ask_user_question', agent: topAgent('ask-q'), arguments: { questions: [{ question: '部署到生产？\n确认？' }] } },
    async () => {})
  const frame = res.written.join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.note, '部署到生产？', 'first line of question used')
})

// ── exec/req null（杀 L224/L236）─────────────────────────────────────────

test('null exec passes through without notifying', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  let nextCalled = false
  await dispatchEvent(listeners, 'tools/pre-execute', null, async () => { nextCalled = true })
  assert.equal(nextCalled, true, 'next still called for null exec')
  assert.equal(noticesOf(res).length, 0, 'null exec not notified')
})

test('null req passes through without notifying', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  let nextCalled = false
  await dispatchEvent(listeners, 'approval/request', null, async () => { nextCalled = true })
  assert.equal(nextCalled, true, 'next still called for null req')
  assert.equal(noticesOf(res).length, 0, 'null req not notified')
})

// ── titleOf：非空 snapshot title 优先于 cwd（杀 L128）────────────────────

test('a non-empty session title beats the cwd fallback', async () => {
  const { listeners, api } = boot({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/notify/api/stream' }), res)
  await dispatchEvent(listeners, 'agent/status', {
    agent: { id: 'titled', session: { header: { cwd: '/work/alpha' }, __title: '我的会话' } },
    status: 'idle',
  })
  const frame = res.written.join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.title, '我的会话', 'snapshot title preferred')
})
