/**
 * Client render-path test: loads the client bundle with a stubbed react
 * (real createElement; hooks stubbed to stateful no-ops), registers the
 * settings tab through a mocked slots service, then invokes the view
 * component to verify:
 *  - the GLOBAL and PROJECT sections render side by side (project accented),
 *  - memory rows render with edit/delete actions,
 *  - the custom confirmation UI: delete is a red two-step confirm, save/add
 *    is green, and the confirmed write carries `confirmed: true`.
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
    value: { scope: 'global', cwd: '', projectRoot: '', items: [] },
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
assert.equal(capturedTab.options.id, 'my-memory')
assert.equal(typeof capturedTab.component, 'function')

// ── helpers ────────────────────────────────────────────────────────────────
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

function collectButtons(node, out) {
  if (node === null || typeof node !== 'object') return
  const props = node.props ?? {}
  if (typeof props.onClick === 'function' && typeof props['aria-label'] === 'string') {
    out.push({ label: props['aria-label'], onClick: props.onClick })
  }
  if (Array.isArray(node)) {
    for (const c of node) collectButtons(c, out)
    return
  }
  if (typeof node.type === 'function') {
    collectButtons(node.type(node.props), out)
    return
  }
  collectButtons(props.children, out)
}

function collectInputs(node, out) {
  if (node === null || typeof node !== 'object') return
  const props = node.props ?? {}
  if (props.className === 'dsh-my-memory-add-input' || props.className === 'dsh-my-memory-path-input') out.push(props)
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

/** True when the node tree contains an <svg> element (icon rendering). */
function hasIcon(node) {
  if (node === null || typeof node !== 'object') return false
  if (node.type === 'svg') return true
  if (Array.isArray(node)) return node.some(hasIcon)
  if (typeof node.type === 'function') return hasIcon(node.type(node.props))
  return hasIcon(node.props.children)
}

function countSections(node) {
  if (node === null || typeof node !== 'object') return 0
  const props = node.props ?? {}
  const cls = props.className
  let count =
    typeof cls === 'string' && (cls === 'dsh-my-memory-section' || cls.startsWith('dsh-my-memory-section ')) ? 1 : 0
  if (Array.isArray(node)) {
    for (const c of node) count += countSections(c)
    return count
  }
  if (typeof node.type === 'function') return count + countSections(node.type(node.props))
  return count + countSections(props.children)
}

function countConfirmPanels(node) {
  if (node === null || typeof node !== 'object') return 0
  const props = node.props ?? {}
  const cls = props.className
  let count =
    typeof cls === 'string' && (cls === 'dsh-my-memory-confirm' || cls.startsWith('dsh-my-memory-confirm ')) ? 1 : 0
  if (Array.isArray(node)) {
    for (const c of node) count += countConfirmPanels(c)
    return count
  }
  if (typeof node.type === 'function') return count + countConfirmPanels(node.type(node.props))
  return count + countConfirmPanels(props.children)
}

// ── render the view with canned two-scope data ─────────────────────────────
const globalValue = {
  ok: true,
  value: {
    scope: 'global',
    cwd: '',
    projectRoot: '',
    items: [{ id: 'g1', desc: '回复使用中文', createdAt: 1, updatedAt: 2 }],
  },
}
const projectValue = {
  ok: true,
  value: {
    scope: 'project',
    cwd: '/work/proj',
    projectRoot: '/work/proj',
    items: [{ id: 'p1', desc: '本项目用 vitest', createdAt: 1, updatedAt: 2 }],
  },
}
cannedResponses.push(globalValue)

const tree = renderView()
const texts0 = []
walkText(tree, texts0)
assert.ok(texts0.join('|').includes('加载中'), 'initial render shows the loading state')

await new Promise((resolve) => setTimeout(resolve, 0))

// ── re-render: both sections side by side (project empty until loaded) ─────
const tree2 = renderView()
const texts = []
walkText(tree2, texts)
const joined = texts.join('|')

assert.ok(joined.includes('全局记忆'), 'global section present')
assert.ok(joined.includes('项目记忆'), 'project section present')
assert.equal(countSections(tree2), 2, 'both scopes render as sections (side by side)')
assert.ok(joined.includes('回复使用中文'), 'global memory desc rendered')
assert.ok(joined.includes('暂无记忆'), 'project section empty before a project is loaded')
assert.ok(joined.includes('点击下方输入框添加第一条记忆'), 'empty state shows the add hint')
const buttons2 = []
collectButtons(tree2, buttons2)
assert.ok(
  buttons2.some((b) => b.label.includes('编辑')),
  'edit action rendered',
)
assert.ok(
  buttons2.some((b) => b.label.includes('删除')),
  'delete action rendered',
)
assert.ok(joined.includes('新增'), 'add bar rendered')
assert.ok(hasIcon(tree2), 'view renders inline svg icons')

const listCalls = fetchCalls.filter((c) => c.url.startsWith('/my-memory/api/memory') && c.options === undefined)
assert.equal(listCalls.length, 1, 'initial load fetches only the global scope')
assert.ok(listCalls[0].url.includes('scope=global'), 'global fetch')

// ── load a project path: project memory + root badge appear ────────────────
const pathInputs0 = []
collectInputs(tree2, pathInputs0)
const pathInput0 = pathInputs0.find((i) => i.className === 'dsh-my-memory-path-input')
assert.ok(pathInput0, 'project path input rendered')
pathInput0.onChange({ target: { value: '/work/proj' } })
const tree2b = renderView()
const buttons2b = []
collectButtons(tree2b, buttons2b)
const loadBtn0 = buttons2b.find((b) => b.label.includes('加载'))
assert.ok(loadBtn0, 'load button rendered')
// fetchAll 会同时请求 global + project 两个 scope
cannedResponses.push(globalValue, projectValue)
loadBtn0.onClick()
await new Promise((resolve) => setTimeout(resolve, 0))

const tree2c = renderView()
const texts2c = []
walkText(tree2c, texts2c)
const joined2c = texts2c.join('|')
assert.ok(joined2c.includes('本项目用 vitest'), 'project memory desc rendered after load')
assert.ok(joined2c.includes('项目根：/work/proj'), 'project root badge rendered')

// ── delete flow: red two-step confirm, then POST with confirmed: true ─────
const buttons = []
collectButtons(tree2c, buttons)
const deleteBtn = buttons.find((b) => b.label.includes('删除') && b.label.includes('p1'))
assert.ok(deleteBtn, 'delete button for the project memory found')
deleteBtn.onClick()
const tree3 = renderView()
const texts3 = []
walkText(tree3, texts3)
const joined3 = texts3.join('|')
assert.ok(joined3.includes('确定删除这条记忆'), 'delete confirmation text shown')
assert.ok(joined3.includes('确认删除'), 'red confirm-delete button shown')
assert.equal(countConfirmPanels(tree3), 1, 'one confirmation panel open')

// 取消：确认面板消失
const cancelBtn = collectCancel(tree3)
assert.ok(cancelBtn, 'cancel button in the confirm panel')
cancelBtn.onClick()
const tree3b = renderView()
assert.equal(countConfirmPanels(tree3b), 0, 'cancel closes the confirmation panel')

// 再次删除并确认
deleteBtn.onClick()
const tree4 = renderView()
const confirmDelete = collectConfirmOk(tree4)
assert.ok(confirmDelete, 'confirm-delete button found')
cannedResponses.push({
  ok: true,
  value: { scope: 'project', cwd: '/work/proj', projectRoot: '/work/proj', items: [] },
})
confirmDelete.onClick()
await new Promise((resolve) => setTimeout(resolve, 0))

const deleteCall = fetchCalls.find(
  (c) => c.options !== undefined && c.options.method === 'POST' && JSON.parse(c.options.body).action === 'delete',
)
assert.ok(deleteCall, 'confirmed delete issues a POST')
const deletePayload = JSON.parse(deleteCall.options.body)
assert.equal(deletePayload.action, 'delete')
assert.equal(deletePayload.scope, 'project')
assert.equal(deletePayload.id, 'p1')
assert.equal(deletePayload.confirmed, true, 'write carries the user-consent marker')

// ── add flow: green confirm, then POST with confirmed: true ────────────────
const tree5 = renderView()
const inputs = []
collectInputs(tree5, inputs)
const globalAddInput = inputs.find((i) => i.className === 'dsh-my-memory-add-input' && i.placeholder.includes('记住'))
assert.ok(globalAddInput, 'global add input found')
globalAddInput.onChange({ target: { value: '新记忆内容' } })
const tree6 = renderView()
const buttons6 = []
collectButtons(tree6, buttons6)
const addBtn = buttons6.find((b) => b.label.includes('新增') && b.label.includes('global'))
assert.ok(addBtn, 'global add button found')
addBtn.onClick()
const tree7 = renderView()
const texts7 = []
walkText(tree7, texts7)
const joined7 = texts7.join('|')
assert.ok(joined7.includes('确认新增这条记忆'), 'add confirmation text shown')
assert.ok(joined7.includes('确认保存'), 'green confirm-save button shown')
const confirmSave = collectConfirmOk(tree7)
assert.ok(confirmSave, 'confirm-save button found')
cannedResponses.push({
  ok: true,
  value: {
    scope: 'global',
    cwd: '',
    projectRoot: '',
    items: [
      { id: 'g1', desc: '回复使用中文', createdAt: 1, updatedAt: 2 },
      { id: 'g2', desc: '新记忆内容', createdAt: 3, updatedAt: 3 },
    ],
  },
})
confirmSave.onClick()
await new Promise((resolve) => setTimeout(resolve, 0))

const addCall = fetchCalls.find(
  (c) => c.options !== undefined && c.options.method === 'POST' && JSON.parse(c.options.body).action === 'add',
)
assert.ok(addCall, 'confirmed add issues a POST')
const addPayload = JSON.parse(addCall.options.body)
assert.equal(addPayload.action, 'add')
assert.equal(addPayload.scope, 'global')
assert.equal(addPayload.desc, '新记忆内容')
assert.equal(addPayload.confirmed, true, 'add carries the user-consent marker')

// ── edit flow: edit mode input + green save confirm ───────────────────────
const tree8 = renderView()
const buttons8 = []
collectButtons(tree8, buttons8)
const editBtn = buttons8.find((b) => b.label.includes('编辑') && b.label.includes('g1'))
assert.ok(editBtn, 'edit button found')
editBtn.onClick()
const tree9 = renderView()
const texts9 = []
walkText(tree9, texts9)
assert.ok(texts9.join('|').includes('保存'), 'edit mode shows the save button')
const editInputs = []
collectInputs(tree9, editInputs)
const editInput = editInputs.find((i) => i.className === 'dsh-my-memory-add-input' && i.value === '回复使用中文')
assert.ok(editInput, 'edit input prefilled with the current desc')
editInput.onChange({ target: { value: '回复必须使用中文' } })
const tree10 = renderView()
const buttons10 = []
collectButtons(tree10, buttons10)
// 编辑模式的保存按钮没有 aria-label，直接找 dsh-my-memory-btn-save
const saveEdit = findSaveButton(tree10)
assert.ok(saveEdit, 'edit save button found')
saveEdit.onClick()
const tree11 = renderView()
const texts11 = []
walkText(tree11, texts11)
assert.ok(texts11.join('|').includes('确认保存这条记忆'), 'update confirmation text shown')
const confirmUpdate = collectConfirmOk(tree11)
assert.ok(confirmUpdate, 'confirm-update button found')
cannedResponses.push({
  ok: true,
  value: {
    scope: 'global',
    cwd: '',
    projectRoot: '',
    items: [{ id: 'g1', desc: '回复必须使用中文', createdAt: 1, updatedAt: 4 }],
  },
})
confirmUpdate.onClick()
await new Promise((resolve) => setTimeout(resolve, 0))

const updateCall = fetchCalls.find(
  (c) => c.options !== undefined && c.options.method === 'POST' && JSON.parse(c.options.body).action === 'update',
)
assert.ok(updateCall, 'confirmed update issues a POST')
const updatePayload = JSON.parse(updateCall.options.body)
assert.equal(updatePayload.action, 'update')
assert.equal(updatePayload.id, 'g1')
assert.equal(updatePayload.desc, '回复必须使用中文')
assert.equal(updatePayload.confirmed, true, 'update carries the user-consent marker')

// ── project path input: load a project refreshes the project scope ────────
const tree12 = renderView()
const pathInputs = []
collectInputs(tree12, pathInputs)
const pathInput = pathInputs.find((i) => i.className === 'dsh-my-memory-path-input')
assert.ok(pathInput, 'project path input rendered')
pathInput.onChange({ target: { value: '/work/other' } })
const tree13 = renderView()
const buttons13 = []
collectButtons(tree13, buttons13)
const loadBtn = buttons13.find((b) => b.label.includes('加载'))
assert.ok(loadBtn, 'load button rendered')
cannedResponses.push(globalValue, {
  ok: true,
  value: { scope: 'project', cwd: '/work/other', projectRoot: '/work/other', items: [] },
})
loadBtn.onClick()
await new Promise((resolve) => setTimeout(resolve, 0))
const tree14 = renderView()
const texts14 = []
walkText(tree14, texts14)
assert.ok(texts14.join('|').includes('项目根：/work/other'), 'project root badge updated after load')

console.log('ALL MY-MEMORY CLIENT RENDER-PATH TESTS PASSED')

// ── helpers for button collection (no aria-label on some buttons) ─────────
function collectCancel(node) {
  return collectByClass(node, 'dsh-my-memory-confirm-cancel')
}
function collectConfirmOk(node) {
  return collectByClass(node, 'dsh-my-memory-confirm-ok')
}
function findSaveButton(node) {
  return collectByClass(node, 'dsh-my-memory-btn-save')
}
function collectByClass(node, className) {
  if (node === null || typeof node !== 'object') return undefined
  const props = node.props ?? {}
  const cls = props.className
  if (typeof cls === 'string' && cls.split(' ').includes(className) && typeof props.onClick === 'function') return props
  if (Array.isArray(node)) {
    for (const c of node) {
      const hit = collectByClass(c, className)
      if (hit) return hit
    }
    return undefined
  }
  if (typeof node.type === 'function') return collectByClass(node.type(node.props), className)
  return collectByClass(props.children, className)
}

test('script-style suite (assertions ran at module load)', () => {})
