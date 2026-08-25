import { test } from 'vitest'
/**
 * Client render-path test for dsh-mermaid-render: loads the BUILT bundle
 * lib/client.js (lib/parts/*.part.js spliced + vendored base64 engine
 * injected by scripts/build.mjs) against stubbed react + a fake DOM, then
 * verifies:
 *  - the bundle registers and apply() injects the stylesheet,
 *  - the scanner detects a mermaid md-code-block and mounts a card
 *    (react-dom/client.createRoot captured),
 *  - the card renders its shell (preview/code toggle + loading state),
 *  - a non-mermaid block is ignored.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'

// ── minimal react stub (self-contained: no react install needed, so the
//    test also runs in CI where the dsh react path does not exist) ────────
function createElement(type, props, ...children) {
  // Mirror react's shape: children live under props.children (flattened),
  // so tree-walking code written against react works unchanged.
  return { type, props: { ...(props || {}), children: children.flat() } }
}

// useState 按组件调用顺序维护状态槽（支持 setter 更新后重渲染验证）；
// useEffect 同步执行回调（promise 链仍走微任务，同步 walk 时状态不变）。
let hookCall = 0
const hookSlots = []
const stubbed = {
  createElement,
  useState: (initial) => {
    const i = hookCall++
    if (hookSlots[i] === undefined) hookSlots[i] = typeof initial === 'function' ? initial() : initial
    const set = (v) => { hookSlots[i] = typeof v === 'function' ? v(hookSlots[i]) : v }
    return [hookSlots[i], set]
  },
  useEffect: (fn) => fn(),
  useMemo: (fn) => fn(),
  useSyncExternalStore: (_s, get) => get(),
}
let capturedRender = null
const stubbedReactDomClient = {
  createRoot: (_container) => ({
    render: (el) => { capturedRender = el },
    unmount: () => {},
  }),
}

// ── fake DOM ─────────────────────────────────────────────────────────────
function makeElement(tag, attrs = {}) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    textContent: '',
    className: attrs.className || '',
    style: {},
    dataset: {},
    parentNode: null,
    appendChild(child) { this.children.push(child); child.parentNode = this; this.textContent += child.textContent; return child },
    removeChild(child) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1) },
    setAttribute(k, v) { this[k] = v },
    getAttribute(k) { return this[k] },
    querySelector(sel) {
      const walk = (els) => {
        for (const e of els) {
          if (e.matchesSel && e.matchesSel(sel)) return e
          const found = walk(e.children)
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
          walk(e.children)
        }
      }
      walk(this.children)
      return out
    },
    matchesSel(sel) {
      if (sel === 'pre') return this.tagName === 'PRE'
      if (sel === 'code') return this.tagName === 'CODE'
      if (sel === '[data-conversation-scroll]') return this.dataset.conversationScroll === '1'
      if (sel === '[data-streaming]') return this.dataset.streaming === '1'
      if (sel === 'div.md-code-block') return this.tagName === 'DIV' && this.className === 'md-code-block'
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
  return el
}

// conversation-scroll container holding one mermaid block and one js block
const scrollEl = makeElement('div')
scrollEl.dataset.conversationScroll = '1'
const mermaidBlock = makeElement('div', { className: 'md-code-block' })
const mermaidPre = makeElement('pre')
const mermaidCode = makeElement('code', { className: 'language-mermaid' })
mermaidCode.textContent = 'flowchart TD\n  A --> B'
mermaidPre.appendChild(mermaidCode)
mermaidBlock.appendChild(mermaidPre)
const jsBlock = makeElement('div', { className: 'md-code-block' })
const jsPre = makeElement('pre')
const jsCode = makeElement('code', { className: 'language-js' })
jsCode.textContent = 'const x = 1'
jsPre.appendChild(jsCode)
jsBlock.appendChild(jsPre)
scrollEl.appendChild(mermaidBlock)
scrollEl.appendChild(jsBlock)
// streaming 中的 mermaid 块（祖先带 data-streaming）：scanner 应跳过，
// 等流式结束（observer 重扫）才挂载——此处验证初始不挂载
const streamingRow = makeElement('div')
streamingRow.dataset.streaming = '1'
const streamingBlock = makeElement('div', { className: 'md-code-block' })
const streamingPre = makeElement('pre')
const streamingCode = makeElement('code', { className: 'language-mermaid' })
streamingCode.textContent = 'flowchart TD\n  A --> B'
streamingPre.appendChild(streamingCode)
streamingBlock.appendChild(streamingPre)
streamingRow.appendChild(streamingBlock)
scrollEl.appendChild(streamingRow)

const styleTags = []
const bodyEl = makeElement('body')
bodyEl.appendChild(scrollEl)
global.window = {
  location: { href: 'http://127.0.0.1:3080/app', search: '' },
  mermaid: {
    initialize: () => {},
    render: async (id, _src) => ({ svg: `<svg id="${id}" width="100%"></svg>` }),
  },
}
global.document = {
  body: bodyEl,
  head: {
    appendChild(el) { styleTags.push(el); return el },
    removeChild() {},
  },
  createElement(tag) { return makeElement(tag) },
}
global.Element = function Element() {}
global.MutationObserver = class { constructor() {} observe() {} disconnect() {} }
global.NodeFilter = { SHOW_TEXT: 4 }

// ── load bundle ───────────────────────────────────────────────────────────
let registered = null
global.window.__ModuleLoader__ = { load: (reg) => { registered = reg } }

// P2 parts 化后 client.src.js 是含 __PART_*__ 占位符的模板，不可直接
// eval；这里加载构建产物 lib/client.js（与 dsh-file-activity /
// dsh-think-zh-expand 的 client-render 测试一致）。
eval(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
assert.ok(registered, 'bundle registered')
const exportsObj = registered.factory((spec) => {
  if (spec === 'react') return stubbed
  if (spec === 'react-dom/client') return stubbedReactDomClient
  throw new Error('unexpected require: ' + spec)
})
assert.deepEqual(exportsObj.inject, [])
assert.equal(typeof exportsObj.apply, 'function')

// ── apply with a mock ctx (effects run immediately) ───────────────────────
const effects = []
const ctx = { effect: (fn, label) => { effects.push(label); return fn() } }
exportsObj.apply(ctx)

try {
  // stylesheet injected first
  assert.ok(styleTags.length === 1, 'stylesheet injected')
  assert.ok(styleTags[0].textContent.includes('.dmr-card'), 'stylesheet has card rules')

  // scanner mounted a card for the mermaid block (createRoot captured)
  assert.ok(capturedRender, 'card element captured via createRoot')
  const cardEl = capturedRender
  assert.equal(cardEl.type.name, 'MermaidCard', 'captured element is the card')
  assert.ok(cardEl.props.source.includes('flowchart TD'), 'card got the mermaid source')
  assert.ok(cardEl.props.entryId.startsWith('dsh-mermaid-'), 'card entry id assigned')
  // the original pre is hidden
  assert.equal(mermaidPre.style.display, 'none', 'original pre hidden after mount')

  // non-mermaid md-code-block was NOT mounted (only one card captured)
  // (scanner ran synchronously over the fake DOM before the card render)
  assert.equal(jsPre.style.display, undefined, '非 mermaid 块的 pre 未被隐藏')
  // streaming 中的 mermaid 块不挂载（等流式结束才渲染）
  assert.equal(streamingPre.style.display, undefined, '流式中的 mermaid 块 pre 未被隐藏')
  assert.equal(streamingBlock.querySelector('.dmr-card-host'), null, '流式中的 mermaid 块未挂载卡片')
  const cardTree = cardEl.type(cardEl.props)
  const texts = []
  function walk(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') { texts.push(String(node)); return }
    if (Array.isArray(node)) { for (const c of node) walk(c); return }
    const props = node.props ?? {}
    if (typeof node.type === 'function') { walk(node.type(props)); return }
    walk(props.children)
  }
  walk(cardTree)
  assert.ok(texts.includes('渲染中…'), 'loading state shown initially')
  assert.ok(texts.includes('预览') && texts.includes('代码'), 'preview/code toggle present')

  // 错误渲染兜底：mermaid.render 失败 → 卡片显示错误横幅（不崩溃、保留原始块）
  hookCall = 0
  global.window.mermaid.render = async () => { throw new Error('render boom') }
  cardEl.type(cardEl.props) // 第二次渲染：effect 同步执行 → render reject（微任务）
  await new Promise((r) => setTimeout(r, 0)) // 等 catch 回调（setError/setStatus）执行
  hookCall = 0
  const errorTree = cardEl.type(cardEl.props) // 第三次渲染：error 状态
  walk(errorTree) // walk 闭包写入 texts（与 cardTree 同一数组）
  assert.ok(texts.some((t) => t.includes('render boom')), '错误信息显示在卡片中')
  assert.ok(texts.some((t) => t.includes('渲染失败') || t.includes('失败')), '错误横幅出现')

  console.log('ALL CLIENT RENDER-PATH TESTS PASSED')
} finally {
  delete global.window
  delete global.document
  delete global.Element
  delete global.MutationObserver
  delete global.Node
}

test('script-style suite (assertions ran at module load)', () => {})
