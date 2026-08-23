/**
 * Client render-path test for dsh-mermaid-render: loads lib/client.src.js
 * (the build template, with the mermaid placeholder replaced by an empty
 * string so the vendored 3.3MB engine is not evaluated) against stubbed
 * react + a fake DOM, then verifies:
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

const stubbed = {
  createElement,
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
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
      if (sel === 'div.md-code-block') return this.tagName === 'DIV' && this.className === 'md-code-block'
      return false
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

const styleTags = []
const bodyEl = makeElement('body')
bodyEl.appendChild(scrollEl)
global.window = {
  location: { href: 'http://127.0.0.1:3080/app', search: '' },
  mermaid: {
    initialize: () => {},
    render: async (id, src) => ({ svg: `<svg id="${id}" width="100%"></svg>` }),
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

const src = fs.readFileSync(new URL('../lib/client.src.js', import.meta.url), 'utf8')
const withPlaceholder = src.replaceAll('__MERMAID_UMD_B64__', '""')
eval(withPlaceholder)
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

  console.log('ALL CLIENT RENDER-PATH TESTS PASSED')
} finally {
  delete global.window
  delete global.document
  delete global.Element
  delete global.MutationObserver
  delete global.Node
}
