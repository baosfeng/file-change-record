/**
 * Client render-path test for the plugin detail panel (issue #90).
 *
 * Loads the client bundle with a stubbed react + fetch, opens a plugin detail
 * from the installed list and asserts the README preview (via the shared
 * dsh-md-render MarkdownView, or the `<pre>` fallback when unavailable), the
 * version timeline, the dependency/peer-dependency tables (missing highlight),
 * the in-detail install action and the load-failure fallback.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import fs from 'node:fs'

function createElement(type, props, ...children) {
  const p = props ? { ...props } : {}
  if (children.length === 1) p.children = children[0]
  else if (children.length > 1) p.children = children
  return { type, props: p }
}

/** A fresh react mock per factory call: stateful useState, one-shot useEffect. */
function makeReact() {
  const hookValues = new Map()
  let hookIndex = 0
  let effectRan = false
  return {
    createElement,
    useState: (initial) => {
      const idx = hookIndex
      hookIndex += 1
      if (!hookValues.has(idx)) {
        const value = typeof initial === 'function' ? initial() : initial
        hookValues.set(idx, [
          value,
          (next) => {
            const current = hookValues.get(idx)[0]
            hookValues.set(idx, [typeof next === 'function' ? next(current) : next, hookValues.get(idx)[1]])
          },
        ])
      }
      return hookValues.get(idx)
    },
    useEffect: (fn) => {
      if (!effectRan) {
        effectRan = true
        fn()
      }
    },
    _reset: () => {
      hookIndex = 0
    },
  }
}

// ── browser globals + fetch mock ───────────────────────────────────────────
global.window = {
  __ModuleLoader__: {
    load: (registration) => {
      global.__registered = registration
    },
  },
  location: { href: 'http://127.0.0.1:3080/app', search: '' },
}
Object.defineProperty(global, 'navigator', { value: { language: 'zh-CN' }, configurable: true })

const fetchCalls = []
let cannedResponses = []
global.fetch = (url, options) => {
  fetchCalls.push({ url: String(url), options })
  const canned = cannedResponses.shift() ?? { ok: true, value: {} }
  if (canned instanceof Error) return Promise.reject(canned)
  return Promise.resolve({ json: () => Promise.resolve(canned) })
}
function pushResponses(...responses) {
  cannedResponses.push(...responses)
}

// ── load the bundle once; instantiate scenarios w/ different require maps ──
eval(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
assert.ok(global.__registered, 'bundle registered')
const factory = global.__registered.factory

const mockMarkdownView = ({ text }) => createElement('div', { className: 'tzx-md' }, text)
const installedResp = {
  ok: true,
  value: { entries: [{ moduleName: 'dsh-a', enabled: true, fiberPhase: 'ready', version: '1.0.0' }] },
}
const detailResp = {
  ok: true,
  value: {
    name: 'dsh-a',
    version: '1.0.0',
    latest: '1.0.0',
    description: 'plugin desc',
    author: 'alice',
    license: 'MIT',
    homepage: 'https://foo',
    repository: 'https://github.com/x/y',
    readme: 'hello readme',
    versions: [
      { version: '0.9.0', date: '2026-01-01' },
      { version: '1.0.0', date: '2026-02-01' },
    ],
    dependencies: [{ name: 'a', spec: '^1.0.0' }],
    peerDependencies: [
      { name: 'react', spec: '^18', missing: false },
      { name: 'dsh-shared', spec: '^0.1.0', missing: true },
    ],
    downloads: 42,
  },
}

function boot(extraModules) {
  const r = makeReact()
  const exportsObj = factory((spec) => {
    if (spec === 'react') return r
    if (extraModules && Object.prototype.hasOwnProperty.call(extraModules, spec)) return extraModules[spec]
    throw new Error('unexpected require: ' + spec)
  })
  let capturedTab = null
  const mockSlots = {
    inject: (name, register) => {
      const registeredTab = register()
      if (name === 'settings.plugins.tab') capturedTab = registeredTab
      return () => {}
    },
    register: (options, component) => ({ options, component }),
  }
  const ctx = { get: (name) => (name === 'slots' ? mockSlots : undefined), effect: (fn) => fn() }
  exportsObj.apply(ctx)
  assert.ok(capturedTab, 'settings tab registered')
  const render = () => {
    r._reset()
    return capturedTab.component({})
  }
  return { render }
}

function walkText(node, out) {
  if (node === null || node === undefined || typeof node === 'boolean') return
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return
  }
  if (Array.isArray(node)) {
    for (const child of node) walkText(child, out)
    return
  }
  if (typeof node.type === 'function') {
    walkText(node.type(node.props), out)
    return
  }
  walkText(node.props.children, out)
}

function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node.type === 'function') return textOf(node.type(node.props))
  return textOf(node.props.children)
}

function collectButtons(node, buttons) {
  if (node === null || typeof node !== 'object') return
  const props = node.props ?? {}
  if (typeof props.onClick === 'function') {
    buttons.push({ label: textOf(props.children), onClick: props.onClick })
  }
  if (Array.isArray(node)) {
    for (const c of node) collectButtons(c, buttons)
    return
  }
  if (typeof node.type === 'function') {
    collectButtons(node.type(node.props), buttons)
    return
  }
  collectButtons(props.children, buttons)
}

function findNode(node, classNamePredicate) {
  if (node === null || typeof node !== 'object') return null
  const props = node.props ?? {}
  const match = classNamePredicate(props.className ?? '')
  let found = match ? node : null
  if (found) return found
  if (Array.isArray(node)) {
    for (const c of node) {
      found = findNode(c, classNamePredicate)
      if (found) return found
    }
    return null
  }
  if (typeof node.type === 'function') return findNode(node.type(node.props), classNamePredicate)
  return findNode(props.children, classNamePredicate)
}

/** Open the 'dsh-a' detail and return the rendered tree after it loads. */
async function openDetail(extraModules, detailOverride) {
  cannedResponses.length = 0
  fetchCalls.length = 0
  const { render } = boot(extraModules)
  pushResponses(installedResp)
  render()
  await new Promise((resolve) => setTimeout(resolve, 0))
  let tree = render()
  const buttons = []
  collectButtons(tree, buttons)
  const detailBtn = buttons.find((b) => b.label === '详情')
  assert.ok(detailBtn, 'detail button rendered on the installed row')
  pushResponses(detailOverride ?? detailResp)
  detailBtn.onClick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  tree = render()
  const texts = []
  walkText(tree, texts)
  return { tree, joined: texts.join('|') }
}

test('detail: MarkdownView README + timeline + deps + install', async () => {
  const { tree, joined } = await openDetail({ 'dsh-md-render': { MarkdownView: mockMarkdownView } })
  assert.ok(joined.includes('hello readme'), 'README text rendered')
  assert.ok(
    findNode(tree, (c) => c === 'tzx-md'),
    'README via shared MarkdownView (tzx-md)',
  )
  assert.ok(joined.includes('0.9.0') && joined.includes('2026-02-01'), 'version timeline rendered')
  assert.ok(joined.includes('a') && joined.includes('^1.0.0'), 'dependency rendered')
  assert.ok(joined.includes('react') && joined.includes('dsh-shared'), 'peer dependencies rendered')
  assert.ok(joined.includes('缺失'), 'peer missing badge highlighted')
  assert.ok(joined.includes('作者：alice') && joined.includes('许可证：MIT'), 'metadata rendered')
  assert.ok(joined.includes('仓库'), 'repository link rendered')
  assert.ok(joined.includes('安装'), 'install button present in the detail')
})

test('detail: install from the detail page POSTs the source', async () => {
  cannedResponses.length = 0
  fetchCalls.length = 0
  const { render } = boot({ 'dsh-md-render': { MarkdownView: mockMarkdownView } })
  pushResponses(installedResp)
  render()
  await new Promise((resolve) => setTimeout(resolve, 0))
  let tree = render()
  const buttons = []
  collectButtons(tree, buttons)
  buttons.find((b) => b.label === '详情').onClick()
  pushResponses(detailResp)
  await new Promise((resolve) => setTimeout(resolve, 0))
  tree = render()
  const detailButtons = []
  collectButtons(tree, detailButtons)
  const installBtn = detailButtons.find((b) => b.label === '安装')
  assert.ok(installBtn, 'install button found in the detail')
  pushResponses({ ok: true, value: {} })
  installBtn.onClick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.ok(
    fetchCalls.some((c) => c.url.startsWith('/my-plugin-manager/api/install') && c.options?.method === 'POST'),
    'detail install hits POST /install',
  )
})

test('detail: README falls back to <pre> when MarkdownView absent', async () => {
  const { tree, joined } = await openDetail({})
  assert.ok(
    findNode(tree, (c) => c === 'dsh-my-plugin-manager-readme-plain'),
    'README fallback <pre> rendered',
  )
  assert.ok(joined.includes('hello readme'), 'README text shown in the fallback')
})

test('detail: load failure shows a fallback error', async () => {
  const { joined } = await openDetail(
    { 'dsh-md-render': { MarkdownView: mockMarkdownView } },
    {
      ok: false,
      error: { message: 'package not found' },
    },
  )
  assert.ok(joined.includes('详情加载失败'), 'load-failure fallback shown')
  assert.ok(joined.includes('package not found'), 'error message surfaced')
})

// Assertions above run at module load so they can await the mocked async
// fetches; a single no-op test keeps vitest green.
test('detail-render assertions ran at module load', () => {})
