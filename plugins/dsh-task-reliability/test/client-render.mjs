/**
 * Client render-path test: loads the client bundle with a stubbed react
 * (real createElement; hooks stubbed to no-ops), registers the sidebar tab
 * through a mocked betterSidebar service, then invokes the panel component
 * directly to verify the element tree builds without errors and renders the
 * mode switches / task list / pending questions structure.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

test('client bundle registers sidebar tab and renders panel structure', () => {
  // ── stubbed react ─────────────────────────────────────────────────────
  const reactPath = '/Users/bsfeng/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/react/index.js'
  const react = require(reactPath)

  const hookValues = new Map()
  const stubbed = {
    createElement: react.createElement,
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

  // ── browser globals ───────────────────────────────────────────────────
  let registered = null
  global.window = {
    __ModuleLoader__: { load: (registration) => { registered = registration } },
  }
  Object.defineProperty(global, 'navigator', { value: { language: 'zh-CN' }, configurable: true })

  // ── load bundle ───────────────────────────────────────────────────────
  eval(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
  assert.ok(registered, 'bundle registered')
  assert.equal(registered.id, 'dsh-task-reliability')
  const exportsObj = registered.factory((spec) => {
    if (spec === 'react') return stubbed
    throw new Error('unexpected require: ' + spec)
  })
  assert.equal(typeof exportsObj.apply, 'function')

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
  assert.ok(joined.includes('可靠性跟踪'), 'tracking switch rendered')
  assert.ok(joined.includes('完成度校验'), 'verify switch rendered')
  assert.ok(joined.includes('自主决策'), 'autopilot switch rendered')
  assert.ok(joined.includes('活动任务'), 'tasks section title')
  assert.ok(joined.includes('暂无任务'), 'empty tasks state')
  assert.ok(joined.includes('待确认问题'), 'questions section title')
  assert.ok(joined.includes('暂无待确认问题'), 'empty questions state')
  assert.ok(joined.includes('注册任务'), 'register form rendered')
})

test('apply without betterSidebar must not throw', () => {
  const reactPath = '/Users/bsfeng/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/react/index.js'
  const react = require(reactPath)
  let registered = null
  global.window = {
    __ModuleLoader__: { load: (registration) => { registered = registration } },
  }
  Object.defineProperty(global, 'navigator', { value: { language: 'zh-CN' }, configurable: true })
  eval(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
  const exportsObj = registered.factory((spec) => {
    if (spec === 'react') return react
    throw new Error('unexpected require: ' + spec)
  })
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
