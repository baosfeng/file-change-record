/**
 * Client render-path test: loads the client bundle with a stubbed react
 * (real createElement; hooks stubbed to no-ops), registers the tab through a
 * mocked betterSidebar service, then invokes the view component directly to
 * verify the element tree builds without errors and the folder flattening /
 * dotted-label / recent-list logic produces the expected structure.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ── stubbed react ─────────────────────────────────────────────────────────
const reactPath = '/Users/bsfeng/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/react/index.js'
const react = require(reactPath)

const hookValues = new Map()
const stubbed = {
  createElement: react.createElement,
  useState: (initial) => {
    if (!hookValues.has('state')) hookValues.set('state', [initial, () => {}])
    return hookValues.get('state')
  },
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}

// ── browser globals ────────────────────────────────────────────────────────
let registered = null
global.window = {
  __ModuleLoader__: { load: (registration) => { registered = registration } },
  location: { href: 'http://127.0.0.1:3080/app', search: '' },
  confirm: () => true,
  fetch: () => Promise.resolve({ json: () => Promise.resolve({ ok: true, value: {} }) }),
}
Object.defineProperty(global, 'navigator', { value: { language: 'zh-CN' }, configurable: true })
global.localStorage = { getItem: () => null, setItem: () => {} }
global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ ok: true, value: {} }) })

// ── load bundle ────────────────────────────────────────────────────────────
eval(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
assert.ok(registered, 'bundle registered')
const exportsObj = registered.factory((spec) => {
  if (spec === 'react') return stubbed
  throw new Error('unexpected require: ' + spec)
})
assert.deepEqual(exportsObj.inject, ['betterSidebar'])
assert.equal(typeof exportsObj.apply, 'function')

// ── mock betterSidebar service + context ───────────────────────────────────
let capturedTab = null
const mockService = {
  registerTab: (descriptor) => {
    capturedTab = descriptor
    return () => {}
  },
  features: ['openFile'],
  openFile: () => {},
  openTab: () => {},
  getSnapshot: () => undefined,
  subscribeState: () => () => {},
}
const ctx = {
  betterSidebar: mockService,
  effect: (fn) => fn(),
}
exportsObj.apply(ctx)
assert.ok(capturedTab, 'tab registered')
assert.equal(capturedTab.id, 'file-activity:recent')
assert.equal(capturedTab.single, true)
assert.equal(capturedTab.order, 15)
assert.ok(capturedTab.settings?.pluginToggles?.length === 1, 'autoOpen toggle declared')

// ── build the view element with data ───────────────────────────────────────
const scope = { sessionId: 'sess-test', cwd: '/work' }
const element = capturedTab.component({ ctx, scope, visible: true })
assert.equal(element.type.name, 'FileActivityView', 'component wired')

// Seed the store with realistic data (multi-level folders like a.b.c.d + e).
const dataStore = element.props.dataStore
dataStore.set({
  recent: [
    { path: '/work/a/b/c/d/e.txt', op: 'create', time: Date.now() },
    { path: '/work/a/b/c/d/e.txt', op: 'read', time: Date.now() },
    { path: '/work/src/components/ui/Button.tsx', op: 'modify', time: Date.now() },
    { path: '/work/README.md', op: 'read', time: Date.now() },
  ],
  counts: {
    '/work/a/b/c/d/e.txt': { read: 1, create: 2, modify: 0 },
    '/work/src/components/ui/Button.tsx': { read: 3, create: 0, modify: 5 },
    '/work/README.md': { read: 1, create: 1, modify: 0 },
    '/work/src/index.ts': { read: 2, create: 0, modify: 1 },
  },
})

// ── invoke the component directly (stubbed hooks) ──────────────────────────
const tree = element.type(element.props)
assert.ok(tree, 'view tree built')

// Traverse the tree and collect text + clickable rows.
const texts = []
const rows = []
function walk(node, depth) {
  if (node === null || node === undefined || typeof node === 'boolean') return
  if (typeof node === 'string' || typeof node === 'number') {
    texts.push(String(node))
    return
  }
  if (Array.isArray(node)) {
    for (const child of node) walk(child, depth)
    return
  }
  const props = node.props ?? {}
  if (typeof props.onClick === 'function') {
    rows.push({ title: props.title, depth })
  }
  walk(props.children, depth + 1)
}
walk(tree, 0)

// ── assertions ─────────────────────────────────────────────────────────────
const joined = texts.join('|')
assert.ok(joined.includes('文件活动'), 'tab title')
assert.ok(joined.includes('最近访问'), 'recent section')
assert.ok(joined.includes('文件统计'), 'stats section')
assert.ok(joined.includes('刷新'), 'refresh button')
assert.ok(joined.includes('清空'), 'clear button')

// Directory tree: every directory renders as its own node label (name + '/'),
// nested — no flat dotted labels like a.b.c.d / src.components.ui
assert.ok(texts.includes('a/'), 'dir a/ present (nested tree)')
assert.ok(texts.includes('b/'), 'dir b/ present')
assert.ok(texts.includes('c/'), 'dir c/ present')
assert.ok(texts.includes('d/'), 'dir d/ present')
assert.ok(texts.includes('src/'), 'dir src/ present')
assert.ok(texts.includes('components/'), 'dir components/ present')
assert.ok(texts.includes('ui/'), 'dir ui/ present')
assert.ok(!texts.includes('a.b.c.d'), 'no flat dotted label a.b.c.d')
assert.ok(!texts.includes('src.components.ui'), 'no flat dotted label src.components.ui')
assert.ok(!joined.includes('根目录'), 'no root group label (root files shown flat)')

// File rows carry the absolute path as title (native preview targets):
// 4 stats rows + 4 recent rows = 8.
const fileRows = rows.filter((r) => typeof r.title === 'string' && r.title !== '')
assert.equal(fileRows.length, 8, `expected 8 titled rows, got ${fileRows.length}`)
const titles = fileRows.map((r) => r.title)
assert.ok(titles.includes('/work/a/b/c/d/e.txt'), 'nested file row present')
assert.ok(titles.includes('/work/README.md'), 'root file row present')

// recent entries are also clickable (4 recent rows with path titles)
const recentRows = rows.filter((r) => r.title === '/work/a/b/c/d/e.txt' || r.title === '/work/README.md' || r.title === '/work/src/components/ui/Button.tsx')
assert.ok(recentRows.length >= 4, 'recent entries clickable')

// the nested-tree example: a/b/c/d/e.txt renders as dirs a/ b/ c/ d/ with e.txt
assert.ok(texts.includes('e.txt'), 'nested file name present')

console.log('ALL CLIENT RENDER-PATH TESTS PASSED')
console.log('sample output tree (clickable rows):')
for (const row of rows) console.log('  '.repeat(row.depth) + row.title)
