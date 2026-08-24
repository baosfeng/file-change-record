/**
 * Step definitions for dsh-think-zh-expand Gherkin acceptance tests.
 * Covers the server half (system-prompt section injection) and the client
 * half (localization pure functions + markdown table rendering), mirroring
 * host-smoke.mjs and client-render.mjs.
 */
import { Given, When, Then, After, setWorldConstructor } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { apply, PROMPT_TEXT } from '../../../lib/index.js'

class World {
  constructor() {
    this.sections = []
    this.exportsObj = null
    this.renderer = null
    this.lastRender = null
  }

  bootServer() {
    const sections = this.sections
    const ctx = {
      systemPrompt: {
        section(section) {
          sections.push(section)
          return () => {}
        },
      },
    }
    apply(ctx)
  }

  loadClient() {
    const stubbed = {
      createElement(type, props, ...children) {
        return { type, props: { ...(props || {}), children: children.flat() } }
      },
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect: () => {},
      useMemo: (fn) => fn(),
      useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    }
    let registered = null
    global.window = {
      __ModuleLoader__: { load: (registration) => { registered = registration } },
      location: { href: 'http://127.0.0.1:3080/app', search: '' },
      confirm: () => true,
      fetch: () => Promise.resolve({ json: () => Promise.resolve({ ok: true, value: {} }) }),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id),
    }
    Object.defineProperty(global, 'navigator', { value: { language: 'zh-CN' }, configurable: true })
    global.localStorage = { getItem: () => null, setItem: () => {} }
    global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ ok: true, value: {} }) })

    eval(fs.readFileSync(new URL('../../../lib/client.js', import.meta.url), 'utf8'))
    assert.ok(registered, 'bundle registered')
    const exportsObj = registered.factory((spec) => {
      if (spec === 'react') return stubbed
      throw new Error('unexpected require: ' + spec)
    })
    this.exportsObj = exportsObj
  }

  registerRenderer() {
    let registerFn = null
    const world = this
    const ctx = {
      effect: (fn) => fn(),
      slots: {
        inject: (_name, fn) => { registerFn = fn; return () => {} },
        register: (_desc, renderer) => { world.renderer = renderer; return () => {} },
      },
    }
    this.exportsObj.apply(ctx)
    assert.equal(typeof registerFn, 'function', 'slots.inject callback captured')
    registerFn()
    assert.equal(typeof this.renderer, 'function', 'assistant-step renderer captured')
  }

  renderText(text) {
    const tree = this.renderer({ node: { data: { blocks: [{ kind: 'text', text }] } } })
    const tags = []
    const texts = []
    function walk(node) {
      if (node === null || node === undefined || typeof node === 'boolean') return
      if (typeof node === 'string' || typeof node === 'number') { texts.push(String(node)); return }
      if (Array.isArray(node)) { for (const c of node) walk(c); return }
      const props = node.props ?? {}
      if (typeof node.type === 'string') {
        tags.push(node.type)
      } else if (typeof node.type === 'function') {
        // plugin internal components (MarkdownView / ThinkBlock …): expand
        walk(node.type(node.props))
        return
      }
      walk(props.children)
    }
    walk(tree)
    this.lastRender = { tags, texts }
  }
}

setWorldConstructor(World)

After(async function () {
  delete global.window
  delete global.localStorage
})

// ── Given ─────────────────────────────────────────────────────────────────
Given('思考增强插件已启动', async function () {
  this.bootServer()
})

Given('客户端模块已加载', async function () {
  this.loadClient()
})

Given('渲染器已注册', async function () {
  this.loadClient()
  this.registerRenderer()
})

// ── When ──────────────────────────────────────────────────────────────────
When('渲染含分隔行的文本块', async function () {
  this.renderText('| 插件 | 版本 |\n|:-----|:----:|\n| dsh-file-activity | **0.4.2** |')
})

// ── Then ──────────────────────────────────────────────────────────────────
Then('注册了唯一的 system-prompt section', async function () {
  assert.equal(this.sections.length, 1)
})

Then('section 名为 {string} 且顺序为 {int}', async function (name, order) {
  const section = this.sections[0]
  assert.equal(section.name, name)
  assert.equal(section.order, order)
})

Then('section 文本要求思考与回复使用中文', async function () {
  const section = this.sections[0]
  assert.equal(section.text, PROMPT_TEXT)
  assert.ok(section.text.includes('思考'), 'covers thinking')
  assert.ok(section.text.includes('中文'), 'forces Chinese')
  assert.ok(section.text.includes('回复'), 'covers replies')
})

Then('section 文本覆盖关键场景与代码术语', async function () {
  const section = this.sections[0]
  assert.ok(section.text.includes('错误消息'), 'covers English error-message scenario')
  assert.ok(section.text.includes('不翻译'), 'keeps code/commands/paths untranslated')
  assert.ok(section.text.includes('最高优先级'), 'declares top priority over context')
})

Then('{string} 的卡片标题为 {string}', async function (title, expected) {
  assert.equal(this.exportsObj.zhCardTitle(title), expected)
})

Then('工具名 {string} 映射为 {string}', async function (name, expected) {
  assert.equal(this.exportsObj.zhToolName(name), expected)
})

Then('未覆盖的工具名 {string} 映射为空', async function (name) {
  assert.equal(this.exportsObj.zhToolName(name), null)
})

Then('输出包含 table 标签', async function () {
  assert.ok(this.lastRender.tags.includes('table'), `tags: ${this.lastRender.tags.join(',')}`)
})

Then('输出包含表头文本 {string}', async function (text) {
  assert.ok(this.lastRender.texts.includes(text), `texts: ${this.lastRender.texts.join(',')}`)
})

Then('输出包含数据文本 {string}', async function (text) {
  assert.ok(this.lastRender.texts.includes(text), `texts: ${this.lastRender.texts.join(',')}`)
})
