/**
 * Step definitions for dsh-mermaid-render Gherkin acceptance tests.
 * Loads the BUILT bundle lib/client.js (parts spliced + base64 engine
 * injected by scripts/build.mjs) against stubbed react + a fake DOM,
 * mirroring client-render.mjs: card mount, loading state, toggle, non-mermaid
 * ignore and stylesheet injection.
 */
import { Given, Then, After, setWorldConstructor } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import fs from 'node:fs'

function makeElement(tag, attrs = {}) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    textContent: '',
    className: attrs.className || '',
    style: {},
    dataset: {},
    parentNode: null,
    appendChild(child) {
      this.children.push(child)
      child.parentNode = this
      this.textContent += child.textContent
      return child
    },
    removeChild(child) {
      const i = this.children.indexOf(child)
      if (i >= 0) this.children.splice(i, 1)
    },
    setAttribute(k, v) {
      this[k] = v
    },
    getAttribute(k) {
      return this[k]
    },
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

class World {
  constructor() {
    this.styleTags = []
    this.capturedRender = null
    this.mermaidPre = null
    this.jsBlock = null
  }

  buildDom(withMermaid) {
    const scrollEl = makeElement('div')
    scrollEl.dataset.conversationScroll = '1'
    if (withMermaid) {
      const mermaidBlock = makeElement('div', { className: 'md-code-block' })
      const mermaidPre = makeElement('pre')
      const mermaidCode = makeElement('code', { className: 'language-mermaid' })
      mermaidCode.textContent = 'flowchart TD\n  A --> B'
      mermaidPre.appendChild(mermaidCode)
      mermaidBlock.appendChild(mermaidPre)
      scrollEl.appendChild(mermaidBlock)
      this.mermaidPre = mermaidPre
    }
    const jsBlock = makeElement('div', { className: 'md-code-block' })
    const jsPre = makeElement('pre')
    const jsCode = makeElement('code', { className: 'language-js' })
    jsCode.textContent = 'const x = 1'
    jsPre.appendChild(jsCode)
    jsBlock.appendChild(jsPre)
    scrollEl.appendChild(jsBlock)
    this.jsBlock = jsBlock
    const bodyEl = makeElement('body')
    bodyEl.appendChild(scrollEl)
    return bodyEl
  }

  loadAndApply(bodyEl) {
    const stubbed = {
      createElement(type, props, ...children) {
        return { type, props: { ...(props || {}), children: children.flat() } }
      },
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect: () => {},
      useMemo: (fn) => fn(),
      useSyncExternalStore: (_s, get) => get(),
    }
    const world = this
    const stubbedReactDomClient = {
      createRoot: () => ({
        render: (el) => {
          world.capturedRender = el
        },
        unmount: () => {},
      }),
    }
    let registered = null
    global.window = {
      location: { href: 'http://127.0.0.1:3080/app', search: '' },
      mermaid: {
        initialize: () => {},
        render: async (id) => ({ svg: `<svg id="${id}" width="100%"></svg>` }),
      },
      __ModuleLoader__: {
        load: (reg) => {
          registered = reg
        },
      },
    }
    global.document = {
      body: bodyEl,
      head: {
        appendChild(el) {
          world.styleTags.push(el)
          return el
        },
        removeChild() {},
      },
      createElement(tag) {
        return makeElement(tag)
      },
    }
    global.Element = function Element() {}
    global.MutationObserver = class {
      constructor() {}
      observe() {}
      disconnect() {}
    }
    global.NodeFilter = { SHOW_TEXT: 4 }

    // P2 parts 化后 client.src.js 是含占位符的模板，改为加载构建产物。
    eval(fs.readFileSync(new URL('../../../lib/client.js', import.meta.url), 'utf8'))
    assert.ok(registered, 'bundle registered')
    const exportsObj = registered.factory((spec) => {
      if (spec === 'react') return stubbed
      if (spec === 'react-dom/client') return stubbedReactDomClient
      throw new Error('unexpected require: ' + spec)
    })
    const ctx = { effect: (fn) => fn() }
    exportsObj.apply(ctx)
  }

  cardTexts() {
    const cardEl = this.capturedRender
    assert.ok(cardEl, 'card captured')
    const texts = []
    function walk(node) {
      if (node === null || node === undefined || typeof node === 'boolean') return
      if (typeof node === 'string' || typeof node === 'number') {
        texts.push(String(node))
        return
      }
      if (Array.isArray(node)) {
        for (const c of node) walk(c)
        return
      }
      const props = node.props ?? {}
      if (typeof node.type === 'function') {
        walk(node.type(props))
        return
      }
      walk(props.children)
    }
    walk(cardEl.type(cardEl.props))
    return texts
  }
}

setWorldConstructor(World)

After(async function () {
  delete global.window
  delete global.document
  delete global.Element
  delete global.MutationObserver
  delete global.Node
})

// ── Given ─────────────────────────────────────────────────────────────────
Given('渲染插件已启动且页面含 mermaid 与普通代码块', async function () {
  const bodyEl = this.buildDom(true)
  this.loadAndApply(bodyEl)
})

Given('渲染插件已启动且页面只含普通代码块', async function () {
  const bodyEl = this.buildDom(false)
  this.loadAndApply(bodyEl)
})

// ── Then ──────────────────────────────────────────────────────────────────
Then('生成一个图表卡片', async function () {
  assert.ok(this.capturedRender, 'card element captured via createRoot')
  assert.equal(this.capturedRender.type.name, 'MermaidCard', 'captured element is the card')
})

Then('卡片包含渲染中的加载状态', async function () {
  assert.ok(this.cardTexts().includes('渲染中…'), 'loading state shown initially')
})

Then('卡片提供预览与代码切换', async function () {
  const texts = this.cardTexts()
  assert.ok(texts.includes('预览') && texts.includes('代码'), 'preview/code toggle present')
})

Then('原始代码块被隐藏', async function () {
  assert.equal(this.mermaidPre.style.display, 'none', 'original pre hidden after mount')
})

Then('不生成任何图表卡片', async function () {
  assert.equal(this.capturedRender, null, 'no card for non-mermaid blocks')
})

Then('页面注入包含卡片规则的样式', async function () {
  assert.ok(this.styleTags.length === 1, 'stylesheet injected')
  assert.ok(this.styleTags[0].textContent.includes('.dsh-mermaid-render-card'), 'stylesheet has card rules')
})
