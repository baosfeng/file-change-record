/**
 * dsh-skill-manager — API route + apply() integration tests.
 *
 * 覆盖：fence 403、GET list（分组/状态）、PUT config（全局/项目保存 +
 * invalidate 触发）、非法 scope 400、未知方法 404、错误响应。
 */
import { test, afterAll } from 'vitest'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, inject } from '../lib/index.js'
import { globalConfigFile } from '../lib/config.js'

const dir = mkdtempSync(join(tmpdir(), 'dsm-api-test-'))
process.env.DSH_HOME = dir
process.env.DSH_AGENTS_HOME = join(dir, 'agents')

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
    ['teach', { name: 'teach', description: '教学', source: 'user-agents', provider: 'filesystem' }],
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

test('apply declares the required injects and returns effect disposers', async () => {
  const { ctx } = await boot()
  assert.deepEqual(inject, ['skills', 'webServer', 'webRuntime'], 'inject list intact')
  const disposers = ctx.effectCallbacks.filter((e) => typeof e.disposer === 'function')
  assert.ok(disposers.length >= 2, 'provider and route effects return disposers')
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

test('wrong HTTP methods on known paths answer 404', async () => {
  const { getRoute } = await boot()
  const getConfig = await callRoute(getRoute, 'GET', '/skill-manager/api/config')
  assert.equal(getConfig.status, 404, 'GET /config is not a config save')
  const putList = await callRoute(getRoute, 'PUT', '/skill-manager/api/list', {})
  assert.equal(putList.status, 404, 'PUT /list is not a list read')
  const postRescan = await callRoute(getRoute, 'POST', '/skill-manager/api/rescan')
  assert.equal(postRescan.status, 404, 'POST /rescan is not a rescan')
})

test('fence 403 and success responses carry the ok flag', async () => {
  const { getRoute } = await boot()
  const res = makeResponse()
  await getRoute().handler(makeRequest('GET', '/skill-manager/api/list', undefined, {
    headers: { host: 'evil.example', 'sec-fetch-site': 'cross-site' },
  }), res)
  assert.equal(res._status, 403)
  assert.equal(JSON.parse(res._body).ok, false, '403 body marks ok:false')
  const ok = await callRoute(getRoute, 'GET', '/skill-manager/api/list?cwd=')
  assert.equal(ok.json.ok, true, 'list body marks ok:true')
  const rescan = await callRoute(getRoute, 'GET', '/skill-manager/api/rescan?cwd=')
  assert.equal(rescan.json.ok, true, 'rescan body marks ok:true')
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

test('GET /list with a cwd returns only project-sourced skills', async () => {
  const { getRoute } = await boot()
  const r = await callRoute(getRoute, 'GET', `/skill-manager/api/list?cwd=${encodeURIComponent(join(dir, 'proj'))}`)
  assert.equal(r.status, 200)
  const names = r.json.value.skills.map((s) => s.name)
  assert.ok(names.includes('codebase-memory'), 'project skill present in project view')
  assert.ok(!names.includes('web-search'), 'user-dsh skill filtered out in project view')
  assert.ok(!names.includes('teach'), 'user-agents skill filtered out in project view')
  assert.ok(r.json.value.skills.every((s) => s.source.startsWith('project-')), 'only project sources remain')
})

test('GET /rescan invalidates the catalog and returns fresh data', async () => {
  let invalidated = 0
  const holder = captureRoute('/skill-manager/api')
  const ctx = {
    logger: { warn: () => {} },
    webRuntime: { trustedHosts: [] },
    webServer: { register: (route) => { holder.set(route); return () => {} } },
    events: [],
    effectCallbacks: [],
    on() {},
    effect(callback) {
      callback()
      return () => {}
    },
    skills: {
      registerProvider(create) {
        create({ invalidate: () => { invalidated += 1 } })
        return () => {}
      },
      async list() {
        return [{ name: 'fresh', description: '新', source: 'user-dsh', provider: 'filesystem' }]
      },
    },
  }
  apply(ctx)
  const res = makeResponse()
  await holder.get().handler(makeRequest('GET', '/skill-manager/api/rescan?cwd='), res)
  assert.equal(res._status, 200)
  assert.ok(invalidated >= 1, 'rescan invalidates the skill catalog')
  const body = JSON.parse(res._body)
  assert.equal(body.ok, true)
  assert.ok(body.value.skills.some((s) => s.name === 'fresh'), 'rescan returns the fresh catalog')
})

test('GET /list reports missing skill entries with reasons', async () => {
  const { getRoute } = await boot()
  const skillsDir = join(dir, 'skills')
  mkdirSync(skillsDir, { recursive: true })
  // 1. broken symlink → broken-symlink
  symlinkSync(join(skillsDir, 'nowhere'), join(skillsDir, 'broken-link'))
  // 2. .md without frontmatter → missing-frontmatter
  writeFileSync(join(skillsDir, 'no-frontmatter.md'), 'hello')
  // 3. directory without SKILL.md → missing-skills-md
  mkdirSync(join(skillsDir, 'empty-dir'))
  // 4. valid frontmatter but absent from the catalog → listed as not cataloged
  mkdirSync(join(skillsDir, 'good-skill'))
  writeFileSync(join(skillsDir, 'good-skill', 'SKILL.md'), '---\nname: good-skill\ndescription: 好\n---\nbody')
  // 5. frontmatter without name → missing-name-description
  writeFileSync(join(skillsDir, 'no-name.md'), '---\ndescription: 缺名字\n---\nbody')
  // 6. invalid kebab-case name → invalid-name
  writeFileSync(join(skillsDir, 'Bad_Name.md'), '---\nname: Bad_Name\ndescription: 非法\n---\nbody')

  const r = await callRoute(getRoute, 'GET', '/skill-manager/api/list?cwd=')
  assert.equal(r.status, 200)
  const missing = r.json.value.diagnostics.missing
  const byName = Object.fromEntries(missing.map((m) => [m.name, m]))
  assert.equal(byName['broken-link'].reason, 'broken-symlink')
  assert.equal(byName['no-frontmatter'].reason, 'missing-frontmatter')
  assert.equal(byName['empty-dir'].reason, 'missing-skills-md')
  assert.equal(byName['no-name'].reason, 'missing-name-description')
  assert.equal(byName['Bad_Name'].reason, 'invalid-name')
  assert.equal(byName['good-skill'], undefined, 'valid frontmatter is not a diagnostic issue')
  const good = r.json.value.skills.find((s) => s.name === 'good-skill')
  assert.ok(good, 'valid directory skill is listed')
  assert.equal(good.cataloged, false, 'directory skill absent from the catalog is marked not cataloged')
  assert.equal(good.source, 'user-dsh')
})

test('project view diagnostics only scan the project roots', async () => {
  const { getRoute } = await boot()
  // 全局 root 下的坏条目：项目视图不应报告它（catalog 已过滤为项目条目）
  const skillsDir = join(dir, 'skills')
  mkdirSync(skillsDir, { recursive: true })
  symlinkSync(join(skillsDir, 'nowhere'), join(skillsDir, 'global-broken'))
  // 项目 root 下的坏条目：项目视图应报告它
  const projSkills = join(dir, 'proj', '.dsh', 'skills')
  mkdirSync(projSkills, { recursive: true })
  writeFileSync(join(projSkills, 'proj-no-frontmatter.md'), 'hello')

  const r = await callRoute(getRoute, 'GET', `/skill-manager/api/list?cwd=${encodeURIComponent(join(dir, 'proj'))}`)
  assert.equal(r.status, 200)
  const names = r.json.value.diagnostics.missing.map((m) => m.name)
  assert.ok(names.includes('proj-no-frontmatter'), 'project-root issue reported in project view')
  assert.ok(!names.includes('global-broken'), 'global-root issue not reported in project view')
})
