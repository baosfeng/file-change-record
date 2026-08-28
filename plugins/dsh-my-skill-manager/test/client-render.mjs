/**
 * Client render-path test: loads the client bundle with a stubbed react
 * (real createElement; hooks stubbed to stateful no-ops), registers the
 * settings tab through a mocked slots service, then invokes the view
 * component to verify the global/project sections, disabled badges and the
 * toggle→PUT wiring.
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
  __ModuleLoader__: {
    load: (registration) => {
      registered = registration
    },
  },
  location: { href: 'http://127.0.0.1:3080/app', search: '' },
}
Object.defineProperty(global, 'navigator', { value: { language: 'zh-CN' }, configurable: true })

const fetchCalls = []
let cannedResponses = []
global.fetch = (url, options) => {
  fetchCalls.push({ url: String(url), options })
  const canned = cannedResponses.shift() ?? {
    ok: true,
    value: { skills: [], global: { disabled: [] }, project: [], cwd: '', projectRoot: '' },
  }
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
assert.equal(capturedTab.options.id, 'my-skill-manager')
assert.equal(typeof capturedTab.component, 'function')

// ── render the view with a canned catalog response ─────────────────────────
const catalog = {
  ok: true,
  value: {
    cwd: '',
    projectRoot: '',
    skills: [
      { name: 'web-search', description: '网络搜索', source: 'user-dsh', provider: 'filesystem' },
      {
        name: 'codebase-memory',
        description: '图查询',
        source: 'project-dsh',
        provider: 'filesystem',
      },
    ],
    global: { disabled: ['web-search'] },
    project: [],
  },
}
cannedResponses.push(catalog)

const tree = renderView()
// 初始渲染：data=null → loading 分支
const texts0 = []
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
walkText(tree, texts0)
assert.ok(texts0.join('|').includes('加载中'), 'initial render shows the loading state')

// await the fetch microtasks so setData lands in the stub hook
await new Promise((resolve) => setTimeout(resolve, 0))

// ── re-render: catalog branch ──────────────────────────────────────────────
const tree2 = renderView()
const texts = []
walkText(tree2, texts)
const joined = texts.join('|')

assert.ok(joined.includes('加载'), 'load button rendered')
assert.ok(joined.includes('全局'), 'global section present')
assert.equal(countSections(tree2), 1, 'global view renders exactly one section (no project section)')
assert.ok(joined.includes('web-search'), 'skill name rendered')
assert.ok(joined.includes('codebase-memory'), 'second skill rendered')
assert.ok(joined.includes('网络搜索'), 'skill description rendered')
assert.ok(joined.includes('已禁用'), 'disabled badge rendered for web-search')
assert.ok(joined.includes('启用'), 'enabled badge rendered for codebase-memory')

const listCall = fetchCalls[0]
assert.ok(listCall.url.startsWith('/my-skill-manager/api/list'), 'initial list fetch')
assert.equal(fetchCalls.length, 1, 'only the initial list call so far')

// ── toggle: click the global enable toggle of codebase-memory ─────────────
const toggles = []
function collectButtons(node) {
  if (node === null || typeof node !== 'object') return
  const props = node.props ?? {}
  if (typeof props.onClick === 'function' && typeof props['aria-label'] === 'string') {
    toggles.push({ label: props['aria-label'], onClick: props.onClick })
  }
  if (Array.isArray(node)) {
    for (const c of node) collectButtons(c)
    return
  }
  if (typeof node.type === 'function') {
    collectButtons(node.type(node.props))
    return
  }
  collectButtons(props.children)
}

/** Count rendered `.dsm-section` blocks (global view = 1, project view = 1). */
function countSections(node) {
  if (node === null || typeof node !== 'object') return 0
  const props = node.props ?? {}
  let count = props.className === 'dsm-section' ? 1 : 0
  if (Array.isArray(node)) {
    for (const c of node) count += countSections(c)
    return count
  }
  if (typeof node.type === 'function') return count + countSections(node.type(node.props))
  return count + countSections(props.children)
}

/** Collect the path input element props (className dsm-path-input). */
function collectInputs(node, out) {
  if (node === null || typeof node !== 'object') return
  const props = node.props ?? {}
  if (props.className === 'dsm-path-input') out.push(props)
  if (Array.isArray(node)) {
    for (const c of node) collectInputs(c, out)
    return
  }
  if (typeof node.type === 'function') {
    collectInputs(node.type(node.props), out)
    return
  }
  collectInputs(props.children, out)
}
collectButtons(tree2)
const toggle = toggles.find((t) => t.label.includes('codebase-memory') && t.label.includes('启用'))
assert.ok(toggle, 'toggle for the enabled skill found')

cannedResponses.push({ ok: true }) // PUT response
cannedResponses.push(catalog) // refresh list after save
toggle.onClick()
await new Promise((resolve) => setTimeout(resolve, 0))

const putCall = fetchCalls.find((c) => c.url.startsWith('/my-skill-manager/api/config'))
assert.ok(putCall, 'toggle issues a PUT config call')
assert.equal(putCall.options.method, 'PUT')
const payload = JSON.parse(putCall.options.body)
assert.equal(payload.scope, 'global')
assert.deepEqual(payload.disabled, ['web-search', 'codebase-memory'], 'disabled list extended')
assert.equal(payload.cwd, '', 'global scope saves without cwd')

// ── refresh button: click triggers a rescan fetch and shows new skills ─────
const refreshBtn = toggles.find((t) => t.label.includes('刷新'))
assert.ok(refreshBtn, 'refresh button rendered')
cannedResponses.push({
  ok: true,
  value: {
    ...catalog.value,
    skills: [
      ...catalog.value.skills,
      {
        name: 'dsh-issue-request',
        description: '新需求',
        source: 'user-dsh',
        provider: 'filesystem',
      },
      {
        name: 'teach',
        description: '教学',
        source: 'user-dsh',
        provider: 'filesystem',
        cataloged: false,
      },
    ],
    diagnostics: {
      missing: [
        {
          name: 'ego-browser',
          path: '/home/u/.agents/skills/ego-browser',
          reason: 'broken-symlink',
        },
      ],
    },
  },
})
refreshBtn.onClick()
await new Promise((resolve) => setTimeout(resolve, 0))

const rescanCall = fetchCalls.find((c) => c.url.startsWith('/my-skill-manager/api/rescan'))
assert.ok(rescanCall, 'refresh issues a rescan call')
const tree3 = renderView()
const texts3 = []
walkText(tree3, texts3)
const joined3 = texts3.join('|')
assert.ok(joined3.includes('dsh-issue-request'), 'new skill visible after rescan')
assert.ok(joined3.includes('未收录'), 'not-cataloged badge rendered')
assert.ok(joined3.includes('扫描诊断'), 'diagnostics section rendered after rescan')
assert.ok(joined3.includes('ego-browser'), 'missing entry name rendered')
assert.ok(joined3.includes('符号链接'), 'missing entry reason rendered')

// ── project view: load a project path, only the project section renders ────
const inputProps = []
collectInputs(tree3, inputProps)
assert.equal(inputProps.length, 1, 'path input rendered')
inputProps[0].onChange({ target: { value: '/proj' } })
const tree4 = renderView()
collectButtons(tree4)
const loadBtn = toggles.find((b) => b.label.includes('加载'))
assert.ok(loadBtn, 'load button rendered')
cannedResponses.push({
  ok: true,
  value: {
    cwd: '/proj',
    projectRoot: '/proj',
    skills: [
      {
        name: 'codebase-memory',
        description: '图查询',
        source: 'project-dsh',
        provider: 'filesystem',
      },
    ],
    global: { disabled: [] },
    project: [],
    diagnostics: { missing: [] },
  },
})
loadBtn.onClick()
await new Promise((resolve) => setTimeout(resolve, 0))

const tree5 = renderView()
const texts5 = []
walkText(tree5, texts5)
const joined5 = texts5.join('|')
assert.ok(joined5.includes('项目'), 'project section present in project view')
assert.ok(!joined5.includes('全局（'), 'no global-sourced skill rows in project view')
assert.equal(countSections(tree5), 1, 'project view renders exactly one section')
assert.ok(joined5.includes('codebase-memory'), 'project skill rendered in project view')
assert.ok(!joined5.includes('web-search'), 'global skill not rendered in project view')

console.log('ALL SKILL-MANAGER CLIENT RENDER-PATH TESTS PASSED')

test('script-style suite (assertions ran at module load)', () => {})
