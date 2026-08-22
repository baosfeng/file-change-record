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
    const idx = hookValues.size
    if (!hookValues.has(idx)) {
      const value = typeof initial === 'function' ? initial() : initial
      hookValues.set(idx, [value, () => {}])
    }
    return hookValues.get(idx)
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
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
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
const openFileCalls = []
const openTabCalls = []
const mockService = {
  registerTab: (descriptor) => {
    capturedTab = descriptor
    return () => {}
  },
  features: ['openFile'],
  isTabEnabled: () => true,
  openFile: (scope, path) => { openFileCalls.push({ scope, path }) },
  openTab: (seed) => { openTabCalls.push(seed) },
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
    rows.push({ title: props.title, depth, onClick: props.onClick })
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

// Directory tree with chain compression: single-child directory chains
// collapse into one dotted label (a/b/c/d → a.b.c.d); a directory with
// siblings or files keeps its own level (src/), and no loose labels remain
assert.ok(texts.includes('a.b.c.d'), 'chain dirs compressed to a.b.c.d')
assert.ok(!texts.includes('a/'), 'no loose dir a/ after compression')
assert.ok(!texts.includes('b/'), 'no loose dir b/ after compression')
assert.ok(!texts.includes('c/'), 'no loose dir c/ after compression')
assert.ok(!texts.includes('d/'), 'no loose dir d/ after compression')
assert.ok(texts.includes('src/'), 'dir src/ present (has siblings, not compressed)')
assert.ok(texts.includes('components.ui'), 'chain dirs compressed to components.ui')
assert.ok(!texts.includes('components/'), 'no loose dir components/ after compression')
assert.ok(!texts.includes('ui/'), 'no loose dir ui/ after compression')
assert.ok(!texts.includes('src.components.ui'), 'no flat chain crossing a non-chain dir')
assert.ok(!joined.includes('根目录'), 'no root group label (root files shown flat)')

// File rows carry the absolute path as title (native preview targets);
// directory rows end with '/' and toggle collapse instead:
// 4 stats rows + 4 recent rows = 8 file rows.
const fileRows = rows.filter((r) => typeof r.title === 'string' && r.title !== '' && !r.title.endsWith('/'))
assert.equal(fileRows.length, 8, `expected 8 file rows, got ${fileRows.length}`)
const titles = fileRows.map((r) => r.title)
assert.ok(titles.includes('/work/a/b/c/d/e.txt'), 'nested file row present')
assert.ok(titles.includes('/work/README.md'), 'root file row present')

// Directory rows are clickable collapse toggles carrying their folder path.
const dirRows = rows.filter((r) => typeof r.title === 'string' && r.title.endsWith('/'))
assert.equal(dirRows.length, 4, `expected 4 directory rows, got ${dirRows.length}`)
assert.ok(dirRows.every((r) => typeof r.onClick === 'function'), 'directory rows toggle collapse on click')

// recent entries are also clickable (4 recent rows with path titles)
const recentRows = rows.filter((r) => r.title === '/work/a/b/c/d/e.txt' || r.title === '/work/README.md' || r.title === '/work/src/components/ui/Button.tsx')
assert.ok(recentRows.length >= 4, 'recent entries clickable')

// the nested-tree example: a/b/c/d/e.txt renders as dirs a/ b/ c/ d/ with e.txt
assert.ok(texts.includes('e.txt'), 'nested file name present')

// ── click behavior: every clickable file row opens the floating preview ───
// (sets dataStore.preview; no sidebar tab is opened; dir rows are excluded)
const clickableRows = rows.filter((r) => typeof r.onClick === 'function' && typeof r.title === 'string' && r.title !== '' && !r.title.endsWith('/'))
for (const row of clickableRows) row.onClick()
assert.equal(openFileCalls.length, 0, 'clicking rows does not open the sidebar editor')
assert.equal(openTabCalls.length, 0, 'clicking rows does not open any sidebar tab')
const previewAfterClick = dataStore.getSnapshot().preview
assert.ok(previewAfterClick !== null && typeof previewAfterClick === 'object', 'click opens the floating preview')
assert.equal(previewAfterClick.abs, clickableRows[clickableRows.length - 1].title, 'preview targets the clicked file')

// ── preview window renders with title, close and open-in-sidebar actions ──
const previewTree = element.type(element.props)
const previewTexts = []
const previewButtons = []
const walkPreview = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return
  if (typeof node === 'string' || typeof node === 'number') { previewTexts.push(String(node)); return }
  if (Array.isArray(node)) { for (const child of node) walkPreview(child); return }
  // Expand function components manually (no React runtime in this test).
  if (typeof node.type === 'function') { walkPreview(node.type(node.props)); return }
  const props = node.props ?? {}
  if (typeof props.onClick === 'function') previewButtons.push(props)
  walkPreview(props.children)
}
walkPreview(previewTree)
assert.ok(previewTexts.includes(previewAfterClick.name), 'preview header shows the file name')
assert.ok(previewTexts.includes('关闭'), 'close button present')
const closeButton = previewButtons.find((b) => Array.isArray(b.children) ? b.children.includes('关闭') : b.children === '关闭')
assert.ok(closeButton, 'close button wired')
closeButton.onClick()
assert.equal(dataStore.getSnapshot().preview, null, 'close dismisses the preview')

// ── auto-close: leaving the window closes it after a delay, re-entering cancels ──
dataStore.set({ preview: { abs: '/work/README.md', name: 'README.md' } })
const autoTree = element.type(element.props)
let overlayProps = null
const findOverlay = (node) => {
  if (overlayProps !== null || node === null || node === undefined || typeof node === 'boolean') return
  if (Array.isArray(node)) { for (const child of node) findOverlay(child); return }
  if (typeof node.type === 'function') { findOverlay(node.type(node.props)); return }
  if (node.props && typeof node.props.onMouseLeave === 'function' && typeof node.props.onMouseEnter === 'function') {
    overlayProps = node.props
    return
  }
  findOverlay(node.props?.children)
}
findOverlay(autoTree)
assert.ok(overlayProps !== null, 'preview overlay carries mouse leave/enter handlers')

// re-enter cancels a pending auto-close
overlayProps.onMouseEnter()
overlayProps.onMouseLeave()
overlayProps.onMouseEnter()
await new Promise((resolve) => setTimeout(resolve, 700))
assert.ok(dataStore.getSnapshot().preview !== null, 're-entering cancels the auto-close')

// leaving without re-entering closes the preview after the delay
overlayProps.onMouseLeave()
await new Promise((resolve) => setTimeout(resolve, 700))
assert.equal(dataStore.getSnapshot().preview, null, 'mouse leave auto-closes the preview')

// ── editor-disabled scenario: preview still works; open-in-sidebar guarded ─
const openFileCallsDisabled = []
const mockServiceDisabled = {
  ...mockService,
  isTabEnabled: () => false,
  openFile: (s, p) => { openFileCallsDisabled.push({ scope: s, path: p }) },
}
const ctxDisabled = { betterSidebar: mockServiceDisabled, effect: (fn) => fn() }
exportsObj.apply(ctxDisabled)
const disabledElement = capturedTab.component({ ctx: ctxDisabled, scope, visible: true })
const disabledStore = disabledElement.props.dataStore
disabledStore.set({ recent: [], counts: { '/work/README.md': { read: 1, create: 1, modify: 0 } }, preview: { abs: '/work/README.md', name: 'README.md' } })
const disabledTree = disabledElement.type(disabledElement.props)
const disabledButtons = []
const walkDisabled = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return
  if (Array.isArray(node)) { for (const child of node) walkDisabled(child); return }
  if (typeof node.type === 'function') { walkDisabled(node.type(node.props)); return }
  const props = node.props ?? {}
  if (typeof props.onClick === 'function') disabledButtons.push(props)
  walkDisabled(props.children)
}
walkDisabled(disabledTree)
const sidebarButton = disabledButtons.find((b) => b.children === '在侧边栏打开')
assert.ok(sidebarButton, 'open-in-sidebar button present in preview window')
sidebarButton.onClick()
assert.equal(openFileCallsDisabled.length, 0, 'no openFile call when editor tab is disabled')
assert.equal(disabledStore.getSnapshot().preview.abs, '/work/README.md', 'preview stays open when sidebar open is refused')

console.log('ALL CLIENT RENDER-PATH TESTS PASSED')
console.log('sample output tree (clickable rows):')
for (const row of rows) console.log('  '.repeat(row.depth) + row.title)
