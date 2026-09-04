/**
 * Step definitions for dsh-my-memory Gherkin acceptance tests.
 * Boots the plugin against a mocked ctx per scenario (fresh world), drives
 * the /my-memory/api routes through it, and inspects the system-prompt
 * section and the memory_query tool — mirroring test/host-api.mjs,
 * test/prompt.mjs and test/tool.mjs.
 */
import { When, Then, After, setWorldConstructor } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../../../lib/index.js'
import { projectMemoryDir, projectIdOf } from '../../../lib/store.js'

class World {
  constructor() {
    this.dir = mkdtempSync(join(tmpdir(), 'dmm-feature-'))
    process.env.DSH_HOME = this.dir
    this.apiHolder = captureRoute('/my-memory/api')
    this.sections = []
    this.tools = []
    this.events = []
    this.lastResponse = null
    this.lastSectionText = ''
    this.lastToolValue = null
    this.lastSaveValue = null
    this.lastAsk = null
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
      sessions: {
        get: (id) => (id === 'work-session' ? { header: { cwd: '/work/proj' } } : undefined),
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
      events: this.events,
      effectCallbacks: [],
      on(name, listener) {
        this.events.push({ name, listener })
      },
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

  saveTool() {
    return this.tools.find((t) => t.name === 'memory_save')
  }

  gate() {
    return this.events.find((e) => e.name === 'tools/pre-execute')?.listener
  }

  /** Run the pre-execute gate for one tool call; returns the gate decision. */
  async runGate(name, args) {
    if (this.gate() === undefined) return null
    this.lastAsk = await this.gate()({ name, arguments: args ?? {} }, async () => ({ kind: 'allow' }))
    return this.lastAsk
  }

  /** Execute a save tool call after approval; records the returned value. */
  async callSave(args, exec) {
    const tool = this.saveTool()
    assert.ok(tool, 'memory_save tool registered')
    this.lastSaveValue = await tool.execute(args, exec ?? {})
    return this.lastSaveValue
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

Then('返回一条记忆', function () {
  assert.equal(this.lastToolValue.items.length, 1)
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

// ── 场景 6：面板打开时解析当前会话项目根 ──────────────────────────────────
When('查询会话 {string} 的工作目录', async function (sessionId) {
  await this.callRoute('GET', `/my-memory/api/session?sessionId=${encodeURIComponent(sessionId)}`)
})

Then('返回工作目录 {string}', function (cwd) {
  assert.equal(this.lastResponse.json.value.cwd, cwd)
})

Then('返回空工作目录', function () {
  assert.equal(this.lastResponse.json.value.cwd, '')
})

// ── 场景 6-8：memory_save 工具（issue #107）────────────────────────────
When('agent 调用 memory_save 保存全局记忆 {string}', async function (desc) {
  await this.runGate('memory_save', { scope: 'global', desc })
})

Then('触发用户确认流程（ask 门）', function () {
  assert.ok(this.lastAsk, 'gate answered')
  assert.equal(this.lastAsk.kind, 'ask', 'memory_save raises a DSH native approval (ask)')
  assert.ok(this.lastAsk.reason.includes('确认'), 'reason asks for user consent')
})

When('用户批准该保存', async function () {
  await this.callSave({ scope: 'global', desc: '用户偏好用 pnpm' })
})

Then('memory_save 写入成功并返回条目 id', function () {
  assert.ok(this.lastSaveValue, 'save returned a value')
  assert.ok(this.lastSaveValue.item.id.startsWith('mem-'), 'returned item id')
  assert.equal(this.lastSaveValue.item.desc, '用户偏好用 pnpm')
})

Then('该记忆内容为 {string}', function (desc) {
  assert.equal(this.lastToolValue.items[0].desc, desc)
})

Then('查询不触发用户确认流程', async function () {
  await this.runGate('memory_query', { scope: 'global' })
  assert.equal(this.lastAsk.kind, 'allow', 'read-only tools do not raise an approval gate')
})

// ── 场景 9：旧位置项目记忆自动迁移（issue #108）─────────────────────────
When('项目 {string} 存在旧位置记忆文件', async function (name) {
  const projectDir = join(this.dir, name)
  mkdirSync(join(projectDir, '.git'), { recursive: true })
  mkdirSync(join(projectDir, '.dsh'), { recursive: true })
  writeFileSync(
    join(projectDir, '.dsh', 'memory.json'),
    JSON.stringify({
      items: [{ id: 'legacy-1', desc: '旧项目约定（迁移）', createdAt: 1, updatedAt: 2 }],
    }),
    'utf8',
  )
  this.legacyProject = projectDir
  this.legacyFile = join(projectDir, '.dsh', 'memory.json')
})

Then('项目记忆包含迁移后的旧记忆', function () {
  const items = this.lastResponse.json.value.items
  assert.equal(items.length, 1, 'legacy item readable after migration')
  assert.equal(items[0].desc, '旧项目约定（迁移）')
})

Then('旧位置记忆文件已清理', function () {
  assert.ok(!existsSync(this.legacyFile), 'legacy <projectRoot>/.dsh/memory.json removed')
})

Then('项目记忆存于集中存储位置', function () {
  const centralized = join(projectMemoryDir(), `${projectIdOf(this.legacyProject)}.json`)
  // GET /memory 只暴露 items；这里验证磁盘上集中位置存在且项目根下不再有记忆文件
  assert.equal(JSON.parse(readFileSync(centralized, 'utf8')).items.length, 1, 'centralized file holds the data')
})
