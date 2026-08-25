/**
 * Client render-path test: loads the client bundle with a self-contained
 * createElement stub (zero dependencies, platform-independent), registers
 * the sidebar tab through a mocked betterSidebar service, then invokes the
 * panel component directly to verify the element tree builds without errors
 * and renders the mode switches / task list / pending questions structure.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// ── self-contained createElement stub（零依赖，跨平台）────────────────────
function createElement(type, props, ...children) {
  return { type, props: { ...(props ?? {}), children } }
}

const hookValues = new Map()
const stubbed = {
  createElement,
  useState: (initial) => {
    const idx = hookValues.size
    if (!hookValues.has(idx)) {
      const value = typeof initial === 'function' ? initial() : initial
      hookValues.set(idx, [value, () => {}])
    }
    return hookValues.get(idx)
  },
  useEffect: () => {},
}

function loadBundle() {
  let registered = null
  global.window = {
    __ModuleLoader__: { load: (registration) => { registered = registration } },
  }
  Object.defineProperty(global, 'navigator', { value: { language: 'en-US' }, configurable: true })
  eval(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
  assert.ok(registered, 'bundle registered')
  assert.equal(registered.id, 'dsh-task-reliability')
  const exportsObj = registered.factory((spec) => {
    if (spec === 'react') return stubbed
    throw new Error('unexpected require: ' + spec)
  })
  assert.equal(typeof exportsObj.apply, 'function')
  return exportsObj
}

test('client bundle registers sidebar tab and renders panel structure', () => {
  hookValues.clear()
  const exportsObj = loadBundle()

  // ── mock betterSidebar service + context ──────────────────────────────
  let capturedTab = null
  const mockService = {
    registerTab: (descriptor) => {
      capturedTab = descriptor
      return () => {}
    },
  }
  const ctx = {
    betterSidebar: mockService,
    effect: (fn) => fn(),
    get(name) {
      if (name === 'betterSidebar') return mockService
      return undefined
    },
  }
  exportsObj.apply(ctx)
  assert.ok(capturedTab, 'tab registered')
  assert.equal(capturedTab.id, 'task-reliability:panel')
  assert.equal(capturedTab.single, true)
  assert.ok(typeof capturedTab.title === 'function' && capturedTab.title() !== '')
  assert.equal(capturedTab.order, 70)

  // ── build the panel element ───────────────────────────────────────────
  const scope = { sessionId: 'sess-test' }
  const element = capturedTab.component({ ctx, scope, visible: true })
  assert.ok(element, 'component wired')

  // ── invoke the component directly (stubbed hooks) ─────────────────────
  const tree = element.type(element.props)
  assert.ok(tree, 'panel tree built')

  // Traverse the tree and collect all leaf texts (expanding function components).
  const texts = []
  function walk(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') {
      texts.push(String(node))
      return
    }
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    if (typeof node.type === 'function') {
      walk(node.type(node.props))
      return
    }
    walk(node.props?.children)
  }
  walk(tree)

  const joined = texts.join('|')
  assert.ok(joined.includes('Reliability tracking'), 'tracking switch rendered')
  assert.ok(joined.includes('Completion verify'), 'verify switch rendered')
  assert.ok(joined.includes('Autopilot'), 'autopilot switch rendered')
  assert.ok(joined.includes('Active tasks'), 'tasks section title')
  assert.ok(joined.includes('No tasks'), 'empty tasks state')
  assert.ok(joined.includes('Pending questions'), 'questions section title')
  assert.ok(joined.includes('No pending questions'), 'empty questions state')
  assert.ok(joined.includes('Register task'), 'register form rendered')
})

test('apply without betterSidebar must not throw', () => {
  hookValues.clear()
  const exportsObj = loadBundle()
  let error = null
  try {
    exportsObj.apply({
      effect: () => () => {},
      get: () => undefined,
    })
  } catch (caught) {
    error = caught
  }
  assert.equal(error, null, 'apply without betterSidebar must not throw')
})
