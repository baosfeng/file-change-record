/**
 * Step definitions for dsh-my-memory Gherkin acceptance tests.
 * Boots the plugin against a mocked ctx per scenario (fresh world), drives
 * the /my-memory/api routes through it, and inspects the system-prompt
 * section and the memory_query tool — mirroring test/host-api.mjs,
 * test/prompt.mjs and test/tool.mjs.
 */
import { When, Then, After, setWorldConstructor } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../../../lib/index.js'

class World {
  constructor() {
    this.dir = mkdtempSync(join(tmpdir(), 'dmm-feature-'))
    process.env.DSH_HOME = this.dir
    this.apiHolder = captureRoute('/my-memory/api')
    this.sections = []
    this.tools = []
    this.lastResponse = null
    this.lastSectionText = ''
    this.lastToolValue = null
    this.boot()
  }

  boot() {
    const ctx = {
      logger: { warn: () => {} },
      webRuntime: { trustedHosts: [] },
      webServer: {
        register: (route) => {
          this.apiHolder.set(route)
          return () => {}
        },
      },
      systemPrompt: {
        section: (section) => {
          this.sections.push(section)
          return () => {}
        },
      },
      tools: {
        register: (tool) => {
          this.tools.push(tool)
          return () => {}
        },
      },
      events: [],
      effectCallbacks: [],
      on() {},
      effect(callback) {
        this.effectCallbacks.push({ callback })
        const disposer = callback()
        if (typeof disposer === 'function') this.effectCallbacks.push({ disposer })
        return disposer
      },
    }
    this.ctx = ctx
    apply(ctx)
  }

  async callRoute(method, url, body) {
    const route = this.apiHolder.get()
    assert.ok(route, 'route registered')
    const res = makeResponse()
    await route.handler(makeRequest(method, url, body), res)
    this.lastResponse = {
      status: res._status,
      json: res._body === '' ? null : JSON.parse(res._body),
    }
    return this.lastResponse
  }

  section() {
    return this.sections.find((s) => s.name === 'dsh-my-memory')
  }

  tool() {
    return this.tools.find((t) => t.name === 'memory_query')
  }

  async callTool(args, exec) {
    this.lastToolValue = await this.tool().execute(args, exec ?? {})
    return this.lastToolValue
  }
}

function captureRoute(prefix) {
  let captured
  return {
    set: (route) => {
      if (route.kind === 'prefix' && route.path === prefix) captured = route
    },
    get: () => captured,
  }
}

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

function makeRequest(method, url, body) {
  const req = {
    method,
    url,
    headers: {
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'same-origin',
      origin: 'http://127.0.0.1:3080',
    },
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

setWorldConstructor(World)

After(function () {
  rmSync(this.dir, { recursive: true, force: true })
})

// ── 场景 1：写操作必须携带用户同意标记 ──────────────────────────────────
When('提交未携带同意标记的写操作', async function () {
  await this.callRoute('POST', '/my-memory/api/memory', {
    action: 'add',
    scope: 'global',
    desc: '静默写入',
  })
})

Then('接口返回 400', function () {
  assert.equal(this.lastResponse.status, 400)
})

Then('记忆列表为空', async function () {
  const r = await this.callRoute('GET', '/my-memory/api/memory?scope=global')
  assert.deepEqual(r.json.value.items, [])
})

// ── 场景 2：新增/修改/删除全局记忆 ──────────────────────────────────────
When('用户确认新增全局记忆 {string}', async function (desc) {
  await this.callRoute('POST', '/my-memory/api/memory', {
    action: 'add',
    scope: 'global',
    desc,
    confirmed: true,
  })
})

When('查询全局记忆', async function () {
  await this.callRoute('GET', '/my-memory/api/memory?scope=global')
})

Then('全局记忆包含 {string}', function (desc) {
  const items = this.lastResponse.json.value.items
  assert.ok(
    items.some((i) => i.desc === desc),
    `global memory contains ${desc}`,
  )
})

When('用户确认修改该记忆为 {string}', async function (desc) {
  const items = this.lastResponse.json.value.items
  const id = items[0].id
  await this.callRoute('POST', '/my-memory/api/memory', {
    action: 'update',
    scope: 'global',
    id,
    desc,
    confirmed: true,
  })
})

When('用户确认删除该记忆', async function () {
  const items = this.lastResponse.json.value.items
  const id = items[0].id
  await this.callRoute('POST', '/my-memory/api/memory', {
    action: 'delete',
    scope: 'global',
    id,
    confirmed: true,
  })
})

Then('全局记忆为空', function () {
  assert.deepEqual(this.lastResponse.json.value.items, [])
})

// ── 场景 3：项目记忆与全局记忆隔离 ──────────────────────────────────────
When('用户确认在项目 {string} 新增项目记忆 {string}', async function (cwd, desc) {
  const projectDir = join(this.dir, cwd)
  mkdirSync(join(projectDir, '.git'), { recursive: true })
  await this.callRoute('POST', '/my-memory/api/memory', {
    action: 'add',
    scope: 'project',
    cwd: projectDir,
    desc,
    confirmed: true,
  })
})

Then('全局记忆包含 {string} 且不包含 {string}', async function (present, absent) {
  const r = await this.callRoute('GET', '/my-memory/api/memory?scope=global')
  const items = r.json.value.items
  assert.ok(
    items.some((i) => i.desc === present),
    `global memory contains ${present}`,
  )
  assert.ok(!items.some((i) => i.desc === absent), `global memory excludes ${absent}`)
})

When('查询项目 {string} 的记忆', async function (cwd) {
  const projectDir = join(this.dir, cwd)
  await this.callRoute('GET', `/my-memory/api/memory?scope=project&cwd=${encodeURIComponent(projectDir)}`)
})

Then('项目记忆包含 {string} 且不包含 {string}', function (present, absent) {
  const items = this.lastResponse.json.value.items
  assert.ok(
    items.some((i) => i.desc === present),
    `project memory contains ${present}`,
  )
  assert.ok(!items.some((i) => i.desc === absent), `project memory excludes ${absent}`)
})

Then('项目记忆为空', function () {
  assert.deepEqual(this.lastResponse.json.value.items, [])
})

// ── 场景 4：系统提示词注入 ──────────────────────────────────────────────
When('组装系统提示词', function () {
  const section = this.section()
  assert.ok(section, 'dsh-my-memory section registered')
  this.lastSectionText = section.text({})
})

Then('系统提示词包含名为 {string} 的 section', function (name) {
  assert.ok(this.section(), `section ${name} registered`)
})

Then('section 顺序为 {int}', function (order) {
  assert.equal(this.section().order, order)
})

Then('section 文本包含 {string}', function (desc) {
  assert.ok(this.lastSectionText.includes(desc), `section text contains ${desc}`)
})

When('清空全局记忆', async function () {
  const r = await this.callRoute('GET', '/my-memory/api/memory?scope=global')
  for (const item of r.json.value.items) {
    await this.callRoute('POST', '/my-memory/api/memory', {
      action: 'delete',
      scope: 'global',
      id: item.id,
      confirmed: true,
    })
  }
  this.lastSectionText = this.section().text({})
})

Then('section 文本为空', function () {
  assert.equal(this.lastSectionText, '')
})

// ── 场景 5：memory_query 工具 ───────────────────────────────────────────
When('agent 调用 memory_query 查询全局记忆', async function () {
  await this.callTool({ scope: 'global' })
})

Then('返回两条记忆', function () {
  assert.equal(this.lastToolValue.items.length, 2)
})

When('agent 以关键词 {string} 过滤查询', async function (keyword) {
  await this.callTool({ scope: 'global', keyword })
})

Then('只返回 {string}', function (desc) {
  assert.equal(this.lastToolValue.items.length, 1)
  assert.equal(this.lastToolValue.items[0].desc, desc)
})

Then('查询不改变记忆内容', async function () {
  const r = await this.callRoute('GET', '/my-memory/api/memory?scope=global')
  assert.equal(r.json.value.items.length, 2, 'memory unchanged after read-only queries')
})
