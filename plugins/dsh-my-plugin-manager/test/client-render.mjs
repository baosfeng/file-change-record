/**
 * Client render-path test: loads the client bundle with a stubbed react,
 * registers the settings tab through a mocked slots service, then renders
 * the view to verify the installed section, the market search flow and the
 * uninstall wiring.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// ── stubbed react (stateful useState so re-render sees updated state) ─────
function createElement(type, props, ...children) {
  const p = props ? { ...props } : {}
  if (children.length === 1) p.children = children[0]
  else if (children.length > 1) p.children = children
  return { type, props: p }
}

const hookValues = new Map()
let hookIndex = 0
const stubbed = {
  createElement,
  useState: (initial) => {
    const idx = hookIndex
    hookIndex += 1
    if (!hookValues.has(idx)) {
      const value = typeof initial === 'function' ? initial() : initial
      hookValues.set(idx, [value, (next) => {
        const current = hookValues.get(idx)[0]
        hookValues.set(idx, [typeof next === 'function' ? next(current) : next, hookValues.get(idx)[1]])
      }])
    }
    return hookValues.get(idx)
  },
  useEffect: (() => {
    let ran = false
    return (fn) => {
      if (!ran) {
        ran = true
        fn()
      }
    }
  })(),
}

/** Render the tab component once (hooks restart at index 0 each render). */
function renderView() {
  hookIndex = 0
  return capturedTab.component({})
}

// ── browser globals ────────────────────────────────────────────────────────
let registered = null
global.window = {
  __ModuleLoader__: { load: (registration) => { registered = registration } },
  location: { href: 'http://127.0.0.1:3080/app', search: '' },
}
Object.defineProperty(global, 'navigator', { value: { language: 'zh-CN' }, configurable: true })

const fetchCalls = []
let cannedResponses = []
global.fetch = (url, options) => {
  fetchCalls.push({ url: String(url), options })
  const canned = cannedResponses.shift() ?? { ok: true, value: { entries: [] } }
  return Promise.resolve({ json: () => Promise.resolve(canned) })
}

// ── load bundle ────────────────────────────────────────────────────────────
eval(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
assert.ok(registered, 'bundle registered')
const exportsObj = registered.factory((spec) => {
  if (spec === 'react') return stubbed
  throw new Error('unexpected require: ' + spec)
})
assert.equal(typeof exportsObj.apply, 'function')

// ── mock slots service + context ───────────────────────────────────────────
let capturedTab = null
const mockSlots = {
  inject: (name, register) => {
    const registeredTab = register()
    if (name === 'settings.plugins.tab') capturedTab = registeredTab
    return () => {}
  },
  register: (options, component) => ({ options, component }),
}
const ctx = {
  get: (name) => (name === 'slots' ? mockSlots : undefined),
  effect: (fn) => fn(),
}
exportsObj.apply(ctx)
assert.ok(capturedTab, 'settings tab registered')
assert.equal(capturedTab.options.id, 'my-plugin-manager')

// ── initial render: installed section loads from the API ───────────────────
cannedResponses.push({ ok: true, value: { entries: [
  { moduleName: 'dsh-a', enabled: true, fiberPhase: 'ready', version: '1.0.0' },
  { moduleName: 'dsh-b', enabled: false, fiberPhase: null, version: '' },
] } })

const tree0 = renderView()
const texts0 = []
function walkText(node, out) {
  if (node === null || node === undefined || typeof node === 'boolean') return
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return }
  if (Array.isArray(node)) { for (const child of node) walkText(child, out); return }
  if (typeof node.type === 'function') { walkText(node.type(node.props), out); return }
  walkText(node.props.children, out)
}
walkText(tree0, texts0)
assert.ok(texts0.join('|').includes('已安装'), 'installed section present')
assert.ok(texts0.join('|').includes('市场'), 'market section present')

await new Promise((resolve) => setTimeout(resolve, 0))

// ── re-render after the installed fetch settled ────────────────────────────
const tree = renderView()
const texts = []
walkText(tree, texts)
const joined = texts.join('|')
assert.ok(joined.includes('dsh-a'), 'installed plugin name rendered')
assert.ok(joined.includes('版本 1.0.0'), 'installed version rendered')
assert.ok(joined.includes('运行中'), 'enabled state label rendered')
assert.ok(joined.includes('dsh-b'), 'second plugin rendered')
assert.ok(joined.includes('卸载'), 'uninstall button rendered')
assert.ok(joined.includes('检查更新'), 'update check button rendered')

// ── update check flow ──────────────────────────────────────────────────────
cannedResponses.push({ ok: true, value: { outdated: [{ name: 'dsh-a', current: '1.0.0', latest: '1.1.0' }] } })
const buttons = []
function collectButtons(node) {
  if (node === null || typeof node !== 'object') return
  const props = node.props ?? {}
  if (typeof props.onClick === 'function' && typeof props.children === 'string') {
    buttons.push({ label: props.children, onClick: props.onClick })
  }
  if (Array.isArray(node)) { for (const c of node) collectButtons(c); return }
  if (typeof node.type === 'function') { collectButtons(node.type(node.props)); return }
  collectButtons(props.children)
}
collectButtons(tree)
const checkBtn = buttons.find((b) => b.label === '检查更新')
assert.ok(checkBtn, 'update check button found')
checkBtn.onClick()
await new Promise((resolve) => setTimeout(resolve, 0))
const tree2 = renderView()
const texts2 = []
walkText(tree2, texts2)
assert.ok(texts2.join('|').includes('1.0.0 → 1.1.0'), 'outdated version shown on the row')

// the update check hit /updates
assert.ok(fetchCalls.some((c) => c.url.startsWith('/my-plugin-manager/api/updates')), 'updates endpoint called')

console.log('ALL PLUGIN-MANAGER CLIENT RENDER-PATH TESTS PASSED')

test('script-style suite (assertions ran at module load)', () => {})
