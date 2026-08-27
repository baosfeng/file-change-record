/**
 * Step definitions for dsh-md-render Gherkin acceptance tests.
 * Loads the BUILT bundle lib/client.js (parts spliced by scripts/build.mjs)
 * against stubbed react + a fake DOM, mirroring client-render.mjs:
 * non-standard table paragraph replacement, already-rendered table skip,
 * plain paragraph untouched, stylesheet injection, reasoning-block table
 * untouched (regression).
 */
import { Given, Then, After, setWorldConstructor } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import fs from 'node:fs'

function makeElement(tag, attrs = {}) {
  const el = {
    tagName: String(tag).toUpperCase(),
    nodeType: tag === 'fragment' ? 11 : 1,
    children: [],
    _text: '',
    className: attrs.className || '',
    style: {},
    dataset: {},
    parentNode: null,
    appendChild(child) { this.children.push(child); child.parentNode = this; return child },
    removeChild(child) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); child.parentNode = null },
    replaceWith(...nodes) {
      const parent = this.parentNode
      if (!parent) return
      const i = parent.children.indexOf(this)
      if (i < 0) return
      const flat = []
      for (const n of nodes) {
        if (n && n.nodeType === 11) flat.push(...n.children)
        else flat.push(n)
      }
      parent.children.splice(i, 1, ...flat)
      this.parentNode = null
      flat.forEach((n) => { n.parentNode = parent })
    },
    setAttribute(k, v) { this[k] = v },
    getAttribute(k) { return this[k] },
    querySelector(sel) {
      const walk = (els) => {
        for (const e of els) {
          if (e.matchesSel && e.matchesSel(sel)) return e
          const found = walk(e.children || [])
          if (found) return found
        }
        return null
      }
      return walk(this.children)
    },
    querySelectorAll(sel) {
      const out = []
      const walk = (els) => {
        for (const e of els) {
          if (e.matchesSel && e.matchesSel(sel)) out.push(e)
          walk(e.children || [])
        }
      }
      walk(this.children)
      return out
    },
    matchesSel(sel) {
      if (sel === 'p.tzx-p') return this.tagName === 'P' && this.className === 'tzx-p'
      if (sel === 'div.tzx-md') return this.tagName === 'DIV' && this.className === 'tzx-md'
      if (sel === 'div.md-table-wide') return this.tagName === 'DIV' && this.className === 'md-table-wide'
      if (sel === 'div.tzx-md, div.md-table-wide') {
        return (this.tagName === 'DIV' && this.className === 'tzx-md') || (this.tagName === 'DIV' && this.className === 'md-table-wide')
      }
      if (sel === '[data-conversation-scroll]') return this.dataset.conversationScroll === '1'
      if (sel === '[data-streaming]') return this.dataset.streaming === '1'
      if (sel === 'table') return this.tagName === 'TABLE'
      if (sel === 'table.tzx-table') return this.tagName === 'TABLE' && this.className === 'tzx-table'
      if (sel === 'table.dmr-table') return this.tagName === 'TABLE' && this.className === 'dmr-table'
      if (sel === 'div.dmr-table-scroll') return this.tagName === 'DIV' && this.className === 'dmr-table-scroll'
      if (/^[a-z]+$/.test(sel)) return this.tagName === sel.toUpperCase()
      return false
    },
    closest(sel) {
      let node = this
      while (node) {
        if (node.matchesSel && node.matchesSel(sel)) return node
        node = node.parentNode
      }
      return null
    },
  }
  Object.defineProperty(el, 'textContent', {
    get() {
      if (this.children.length === 0) return this._text
      return this.children.map((c) => c.textContent).join('')
    },
    set(v) { this._text = v; this.children = [] },
  })
  return el
}

class World {
  constructor() {
    this.styleTags = []
    this.scrollEl = null
    this.pNonStd = null
    this.renderedTable = null
    this.pPlain = null
    this.thinkTable = null
  }

  buildDom() {
    const scrollEl = makeElement('div')
    scrollEl.dataset.conversationScroll = '1'

    // 不标准表格段落（无首尾管道符）
    const md1 = makeElement('div', { className: 'tzx-md' })
    const pNonStd = makeElement('p', { className: 'tzx-p' })
    pNonStd.textContent = '插件 | 版本\n--- | ---\ndsh-file-activity | 0.4.2'
    md1.appendChild(pNonStd)
    scrollEl.appendChild(md1)
    this.pNonStd = pNonStd

    // 已渲染的表格（table.tzx-table）
    const md2 = makeElement('div', { className: 'tzx-md' })
    const renderedTable = makeElement('table', { className: 'tzx-table' })
    md2.appendChild(renderedTable)
    scrollEl.appendChild(md2)
    this.renderedTable = renderedTable

    // 普通文本段落
    const md3 = makeElement('div', { className: 'tzx-md' })
    const pPlain = makeElement('p', { className: 'tzx-p' })
    pPlain.textContent = '这是一段普通文本，不含表格。'
    md3.appendChild(pPlain)
    scrollEl.appendChild(md3)
    this.pPlain = pPlain

    // 思考块内已渲染的表格（reasoning 块同款结构：tzx-md 内 table.tzx-table）
    const md4 = makeElement('div', { className: 'tzx-md' })
    const thinkTable = makeElement('table', { className: 'tzx-table' })
    md4.appendChild(thinkTable)
    scrollEl.appendChild(md4)
    this.thinkTable = thinkTable

    const bodyEl = makeElement('body')
    bodyEl.appendChild(scrollEl)
    this.scrollEl = scrollEl
    return bodyEl
  }

  loadAndApply(bodyEl) {
    const stubbed = {
      createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children: children.flat() } }),
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect: () => {},
      useMemo: (fn) => fn(),
      useSyncExternalStore: (_s, get) => get(),
    }
    const world = this
    let registered = null
    global.window = {
      location: { href: 'http://127.0.0.1:3080/app', search: '' },
      __ModuleLoader__: { load: (reg) => { registered = reg } },
    }
    global.document = {
      body: bodyEl,
      head: {
        appendChild(el) { world.styleTags.push(el); return el },
        removeChild() {},
      },
      createElement(tag) { return makeElement(tag) },
      createTextNode(text) { return { nodeType: 3, textContent: text } },
      createDocumentFragment() { return makeElement('fragment') },
    }
    global.Element = function Element() {}
    global.MutationObserver = class { constructor() {} observe() {} disconnect() {} }

    eval(fs.readFileSync(new URL('../../../lib/client.js', import.meta.url), 'utf8'))
    assert.ok(registered, 'bundle registered')
    const exportsObj = registered.factory((spec) => {
      if (spec === 'react') return stubbed
      throw new Error('unexpected require: ' + spec)
    })
    const ctx = { effect: (fn) => fn() }
    exportsObj.apply(ctx)
  }
}

setWorldConstructor(World)

After(async function () {
  delete global.window
  delete global.document
  delete global.Element
  delete global.MutationObserver
})

// ── Given ─────────────────────────────────────────────────────────────────
Given('渲染插件已启动且对话含不标准表格段落', async function () {
  const bodyEl = this.buildDom()
  this.loadAndApply(bodyEl)
})

Given('渲染插件已启动且对话含已渲染的表格', async function () {
  const bodyEl = this.buildDom()
  this.loadAndApply(bodyEl)
})

Given('渲染插件已启动且对话含普通文本段落', async function () {
  const bodyEl = this.buildDom()
  this.loadAndApply(bodyEl)
})

Given('渲染插件已启动且对话含思考块内已渲染的表格', async function () {
  const bodyEl = this.buildDom()
  this.loadAndApply(bodyEl)
})

// ── Then ──────────────────────────────────────────────────────────────────
Then('段落被替换为表格元素', async function () {
  assert.equal(this.pNonStd.parentNode, null, 'original paragraph detached')
  const table = this.scrollEl.querySelector('table.dmr-table')
  assert.ok(table, 'table element rendered')
})

Then('表格包含表头与数据行', async function () {
  const table = this.scrollEl.querySelector('table.dmr-table')
  assert.ok(table, 'table element present')
  const thead = table.querySelector('thead')
  const tbody = table.querySelector('tbody')
  assert.ok(thead, 'thead rendered')
  assert.ok(tbody, 'tbody rendered')
  assert.equal(thead.querySelectorAll('th').length, 2, '2 header cells')
  assert.equal(tbody.querySelectorAll('td').length, 2, '2 data cells')
})

Then('表格外层有横向滚动容器', async function () {
  const scroll = this.scrollEl.querySelector('div.dmr-table-scroll')
  assert.ok(scroll, 'scroll container present')
  assert.ok(scroll.querySelector('table.dmr-table'), 'table inside scroll container')
})

Then('已渲染的表格保持原样', async function () {
  assert.equal(this.renderedTable.parentNode, this.scrollEl.querySelectorAll('div.tzx-md')[1], 'rendered table untouched')
})

Then('普通文本段落保持原样', async function () {
  assert.equal(this.pPlain.parentNode, this.scrollEl.querySelectorAll('div.tzx-md')[2], 'plain paragraph untouched')
  assert.equal(this.pPlain.textContent, '这是一段普通文本，不含表格。', 'plain paragraph text intact')
})

Then('页面注入包含表格规则的样式', async function () {
  assert.ok(this.styleTags.length === 1, 'stylesheet injected')
  assert.ok(this.styleTags[0].textContent.includes('.dmr-table'), 'stylesheet has table rules')
})

Then('思考块内的表格保持原样', async function () {
  assert.equal(this.thinkTable.parentNode, this.scrollEl.querySelectorAll('div.tzx-md')[3], 'reasoning-block table untouched')
})
