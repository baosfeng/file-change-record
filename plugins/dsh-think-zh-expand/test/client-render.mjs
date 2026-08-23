/**
 * Client render-path test for dsh-think-zh-expand: loads the client bundle
 * with a stubbed react (real createElement; hooks stubbed), mounts the plugin
 * against a mocked slots service, captures the assistant-step renderer it
 * registers, then invokes it with markdown text blocks to verify:
 *  - tables (| a | b | + separator + data rows) render as table/thead/tbody
 *    with th/td cells and per-column alignment from the separator row,
 *  - a non-table pipe line (no separator row) falls back to a paragraph,
 *  - basic inline markdown inside cells still works (bold / inline code).
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ── stubbed react ─────────────────────────────────────────────────────────
const reactPath = '/Users/bsfeng/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/react/index.js'
const react = require(reactPath)

const stubbed = {
  createElement: react.createElement,
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}

// ── load bundle ────────────────────────────────────────────────────────────
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

eval(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
assert.ok(registered, 'bundle registered')
const exportsObj = registered.factory((spec) => {
  if (spec === 'react') return stubbed
  throw new Error('unexpected require: ' + spec)
})
assert.deepEqual(exportsObj.inject, ['slots'])
assert.equal(typeof exportsObj.apply, 'function')

// ── mock ctx: effect runs immediately; slots.inject/register captured ─────
let registerFn = null
let capturedRenderer = null
const ctx = {
  effect: (fn) => fn(),
  slots: {
    inject: (_name, fn) => { registerFn = fn; return () => {} },
    register: (_desc, renderer) => { capturedRenderer = renderer; return () => {} },
  },
}
exportsObj.apply(ctx)
assert.equal(typeof registerFn, 'function', 'slots.inject callback captured')
registerFn()
assert.equal(typeof capturedRenderer, 'function', 'assistant-step renderer captured')

// ── helpers ───────────────────────────────────────────────────────────────
function renderText(text) {
  const tree = capturedRenderer({ node: { data: { blocks: [{ kind: 'text', text }] } } })
  const tags = []
  const texts = []
  const thStyles = []
  function walk(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') { texts.push(String(node)); return }
    if (Array.isArray(node)) { for (const c of node) walk(c); return }
    const props = node.props ?? {}
    if (typeof node.type === 'string') {
      tags.push(node.type)
      if (node.type === 'th' && props.style && typeof props.style.textAlign === 'string') {
        thStyles.push(props.style.textAlign)
      }
    } else if (typeof node.type === 'function') {
      // plugin internal components (AssistantStepView / MarkdownView / ThinkBlock)
      walk(node.type(node.props))
      return
    }
    walk(props.children)
  }
  walk(tree)
  return { tags, texts, thStyles }
}

// ── assertions ────────────────────────────────────────────────────────────
try {
  // 1. standard table: header + separator + data rows
  const t1 = renderText('| 插件 | 版本 |\n|:-----|:----:|\n| dsh-file-activity | **0.4.2** |\n| dsh-think-zh-expand | `0.2.0` |')
  assert.ok(t1.tags.includes('table'), 'table rendered')
  assert.ok(t1.tags.includes('thead'), 'thead rendered')
  assert.ok(t1.tags.includes('tbody'), 'tbody rendered')
  const thCount = t1.tags.filter((t) => t === 'th').length
  const tdCount = t1.tags.filter((t) => t === 'td').length
  assert.equal(thCount, 2, `2 header cells, got ${thCount}`)
  assert.equal(tdCount, 4, `4 data cells (2 rows × 2 cols), got ${tdCount}`)
  assert.ok(t1.texts.includes('插件'), 'header cell text')
  assert.ok(t1.texts.includes('版本'), 'header cell text 2')
  assert.ok(t1.texts.includes('dsh-file-activity'), 'data cell text')
  assert.ok(t1.texts.includes('0.4.2'), 'bold content inside cell (rendered)')
  assert.ok(t1.texts.includes('0.2.0'), 'inline code content inside cell (rendered)')
  // alignment: ':----' left, ':----:' center (from the separator row)
  assert.deepEqual(t1.thStyles, ['left', 'center'], 'alignment from separator row')

  // 2. alignment variants: :---: center, ---: right
  const r2 = renderText('| a | b |\n|:---:|---:|\n| 1 | 2 |')
  assert.deepEqual(r2.thStyles, ['center', 'right'], 'center + right alignment')

  // 3. non-table pipe line (no separator row) falls back to a paragraph
  const r3 = renderText('| just a pipe line')
  assert.ok(!r3.tags.includes('table'), 'no table without separator row')
  assert.ok(r3.tags.includes('p'), 'falls back to paragraph')

  // 4. pipe line followed by non-table line also falls back
  const r4 = renderText('| a | b |\nnot a separator')
  assert.ok(!r4.tags.includes('table'), 'no table when second line is not a separator')
  assert.ok(r4.tags.includes('p'), 'paragraph fallback for non-table pipes')

  // 5. reasoning block still renders as think block (regression: default expanded)
  const think = capturedRenderer({ node: { data: { blocks: [{ kind: 'reasoning', text: '第一行\n第二行' }] } } })
  const thinkTexts = []
  function walkText(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') { thinkTexts.push(String(node)); return }
    if (Array.isArray(node)) { for (const c of node) walkText(c); return }
    const props = node.props ?? {}
    if (typeof node.type === 'function') { walkText(node.type(props)); return }
    walkText(props.children)
  }
  walkText(think)
  assert.ok(thinkTexts.includes('思考'), 'think block title')
  assert.ok(thinkTexts.some((t) => t.includes('第一行')), 'thinking content expanded')

  // 6. fenced code blocks keep their language marker (```mermaid → language-mermaid)
  //    and are wrapped in the host `md-code-block` container, so third-party
  //    renderers (dsh-mermaid-render scans `div.md-code-block`) can find them.
  const codeLangs = []
  let mdCodeBlockWrappers = 0
  function walkLangs(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (Array.isArray(node)) { for (const c of node) walkLangs(c); return }
    const props = node.props ?? {}
    if (typeof node.type === 'function') { walkLangs(node.type(props)); return }
    if (node.type === 'div' && props.className === 'md-code-block') mdCodeBlockWrappers += 1
    if (node.type === 'code' && typeof props.className === 'string') codeLangs.push(props.className)
    walkLangs(props.children)
  }
  walkLangs(capturedRenderer({ node: { data: { blocks: [{ kind: 'text', text: '```mermaid\nflowchart TD\n    A --> B\n```\n\n```js\nconst x = 1\n```' }] } } }))
  assert.ok(codeLangs.includes('language-mermaid'), 'mermaid fence keeps language class')
  assert.ok(codeLangs.includes('language-js'), 'js fence keeps language class')
  assert.ok(mdCodeBlockWrappers >= 2, 'fenced blocks wrapped in md-code-block for third-party renderers')

  console.log('ALL CLIENT RENDER-PATH TESTS PASSED')
} finally {
  delete global.window
  delete global.localStorage
  delete global.fetch
  delete global.navigator
}
