/**
 * dsh-skill-manager — API route + apply() integration tests.
 *
 * 覆盖：fence 403、GET list（分组/状态）、PUT config（全局/项目保存 +
 * invalidate 触发）、非法 scope 400、未知方法 404、错误响应。
 */
import { test, afterAll } from 'vitest'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../lib/index.js'
import { globalConfigFile } from '../lib/config.js'

const dir = mkdtempSync(join(tmpdir(), 'dsm-api-test-'))
process.env.DSH_HOME = dir

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

function makeResponse() {
  return {
    _status: 0,
    _body: '',
    writeHead(status) {
      this._status = status
    },
    end(body) {
      this._body = body ?? ''
    },
  }
}

function makeRequest(method, url, body, overrides) {
  const req = {
    method,
    url,
    headers: { host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin', origin: 'http://127.0.0.1:3080' },
    ...(overrides ?? {}),
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

/** A fake ctx.skills catalog: the disabler provider is registered through
 *  apply(), so skills.list merges its placeholder candidates in. */
function fakeSkills() {
  const catalog = new Map([
    ['web-search', { name: 'web-search', description: '搜索', source: 'user-dsh', provider: 'filesystem' }],
    ['codebase-memory', { name: 'codebase-memory', description: '图查询', source: 'project-dsh', provider: 'filesystem' }],
  ])
  let providers = []
  return {
    registerProvider(create) {
      providers.push(create({ invalidate: () => {} }))
      return () => {
        providers = []
      }
    },
    async list(options) {
      const merged = new Map(catalog)
      for (const provider of providers) {
        for (const candidate of await provider.list(options)) merged.set(candidate.name, candidate)
      }
      return [...merged.values()]
    },
  }
}

async function boot(overrides) {
  const apiHolder = captureRoute('/skill-manager/api')
  const ctx = {
    logger: { warn: () => {} },
    webRuntime: { trustedHosts: [] },
    skills: fakeSkills(),
    webServer: { register: (route) => { apiHolder.set(route); return () => {} } },
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
    ...(overrides ?? {}),
  }
  apply(ctx)
  return { ctx, getRoute: () => apiHolder.get() }
}

async function callRoute(getRoute, method, url, body, overrides) {
  const route = getRoute()
  assert.ok(route, 'route registered')
  const res = makeResponse()
  await route.handler(makeRequest(method, url, body, overrides), res)
  return { status: res._status, json: res._body === '' ? null : JSON.parse(res._body) }
}

test('apply registers the provider and the API route', async () => {
  const { getRoute } = await boot()
  assert.ok(getRoute(), '/skill-manager/api route registered')
})

test('API refuses requests outside the fence (403)', async () => {
  const { getRoute } = await boot()
  const res = makeResponse()
  await getRoute().handler(makeRequest('GET', '/skill-manager/api/list', undefined, {
    headers: { host: 'evil.example', 'sec-fetch-site': 'cross-site' },
  }), res)
  assert.equal(res._status, 403, 'fenced')
})

test('GET /list groups the catalog by source and flags disabled', async () => {
  const { getRoute } = await boot()
  // global disable web-search first
  await callRoute(getRoute, 'PUT', '/skill-manager/api/config', { scope: 'global', disabled: ['web-search'] })
  const r = await callRoute(getRoute, 'GET', '/skill-manager/api/list?cwd=')
  assert.equal(r.status, 200)
  const value = r.json.value
  assert.deepEqual(value.global.disabled, ['web-search'])
  const byName = Object.fromEntries(value.skills.map((s) => [s.name, s]))
  assert.equal(byName['web-search'].disabled, true, 'globally disabled skill flagged')
  assert.equal(byName['codebase-memory'].disabled, false, 'enabled skill not flagged')
  // the placeholder replaced the real catalog entry (provider = skill-manager)
  assert.equal(byName['web-search'].provider, 'skill-manager')
})

test('PUT /config saves global and project scopes and invalidates', async () => {
  const { getRoute } = await boot()
  const p1 = await callRoute(getRoute, 'PUT', '/skill-manager/api/config', { scope: 'global', disabled: ['a', 'a', 'b'] })
  assert.equal(p1.status, 200)
  assert.equal(p1.json.ok, true)
  const r1 = await callRoute(getRoute, 'GET', '/skill-manager/api/list?cwd=')
  assert.deepEqual(r1.json.value.global.disabled, ['a', 'b'], 'deduped and persisted')

  mkdirSync(join(dir, 'proj', '.git'), { recursive: true })
  const p2 = await callRoute(getRoute, 'PUT', '/skill-manager/api/config', { scope: 'project', disabled: ['c'], cwd: join(dir, 'proj') })
  assert.equal(p2.status, 200)
  const r2 = await callRoute(getRoute, 'GET', `/skill-manager/api/list?cwd=${encodeURIComponent(join(dir, 'proj'))}`)
  assert.deepEqual(r2.json.value.project, ['c'])
  assert.equal(r2.json.value.projectRoot, join(dir, 'proj'))
})

test('PUT /config rejects unknown scope (400) and unknown methods 404', async () => {
  const { getRoute } = await boot()
  const bad = await callRoute(getRoute, 'PUT', '/skill-manager/api/config', { scope: 'bogus', disabled: [] })
  assert.equal(bad.status, 400)
  const unknown = await callRoute(getRoute, 'GET', '/skill-manager/api/nope')
  assert.equal(unknown.status, 404)
})

test('corrupt config file still yields a usable list (defensive read)', async () => {
  const { getRoute } = await boot()
  // 直接写坏文件到全局配置路径
  const { writeFileSync } = await import('node:fs')
  writeFileSync(globalConfigFile(), 'not-json{{{')
  const r = await callRoute(getRoute, 'GET', '/skill-manager/api/list?cwd=')
  assert.equal(r.status, 200)
  assert.deepEqual(r.json.value.global.disabled, [])
})

test('invalidating after save refreshes the catalog', async () => {
  let invalidated = 0
  const holder = captureRoute('/skill-manager/api')
  const ctx = {
    logger: { warn: () => {} },
    webRuntime: { trustedHosts: [] },
    webServer: { register: (route) => { holder.set(route); return () => {} } },
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
    skills: {
      registerProvider(create) {
        create({ invalidate: () => { invalidated += 1 } })
        return () => {}
      },
      async list() {
        return []
      },
    },
  }
  apply(ctx)
  const res = makeResponse()
  await holder.get().handler(makeRequest('PUT', '/skill-manager/api/config', { scope: 'global', disabled: ['x'] }), res)
  assert.equal(res._status, 200)
  assert.ok(invalidated >= 1, 'config save invalidates the skill catalog')
})

test('fence: non-loopback hosts, origin mismatch and trusted hosts', async () => {
  // 非回环 host 拒绝
  const { getRoute } = await boot()
  const res1 = makeResponse()
  await getRoute().handler(makeRequest('GET', '/skill-manager/api/list', undefined, {
    headers: { host: '192.168.1.10:3080', 'sec-fetch-site': 'same-origin' },
  }), res1)
  assert.equal(res1._status, 403, 'non-loopback host refused')
  // origin 与 host 不一致拒绝
  const res2 = makeResponse()
  await getRoute().handler(makeRequest('GET', '/skill-manager/api/list', undefined, {
    headers: { host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin', origin: 'http://evil.example' },
  }), res2)
  assert.equal(res2._status, 403, 'origin mismatch refused')
  // 显式 trusted host 放行
  const holder = captureRoute('/skill-manager/api')
  const ctx = {
    logger: { warn: () => {} },
    webRuntime: { trustedHosts: ['dsh.internal:3080'] },
    skills: { registerProvider: () => () => {}, list: async () => [] },
    webServer: { register: (route) => { holder.set(route); return () => {} } },
    events: [],
    effectCallbacks: [],
    on() {},
    effect(callback) {
      callback()
      return () => {}
    },
  }
  apply(ctx)
  const res3 = makeResponse()
  await holder.get().handler(makeRequest('GET', '/skill-manager/api/list', undefined, {
    headers: { host: 'dsh.internal:3080', 'sec-fetch-site': 'same-origin', origin: 'http://dsh.internal:3080' },
  }), res3)
  assert.equal(res3._status, 200, 'trusted host allowed')
})

test('handler errors are answered with a 400 JSON body', async () => {
  const { getRoute } = await boot()
  // 请求体超过 1MB 上限 → 抛错 → writeError 400
  const huge = 'x'.repeat(1_100_000)
  const res = makeResponse()
  const route = getRoute()
  const req = makeRequest('PUT', '/skill-manager/api/config', { scope: 'global', disabled: [huge] })
  await route.handler(req, res)
  assert.equal(res._status, 400)
  const body = JSON.parse(res._body)
  assert.equal(body.ok, false)
  assert.ok(typeof body.error.message === 'string')
})
