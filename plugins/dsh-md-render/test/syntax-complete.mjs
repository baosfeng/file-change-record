import { test } from 'vitest'
/**
 * Markdown 语法补全（issue #81）：任务列表 / 删除线 / 图片 / 嵌套列表。
 *
 * 加载已构建 lib/client.js（parts 拼装产物），用桩 React 调用 MarkdownView，
 * 遍历元素树断言：
 *  - 任务列表：- [ ] / - [x] 渲染为带 checkbox 的列表项（勾选态区分），
 *  - 删除线：~~text~~ 渲染为 <del>，
 *  - 图片：![alt](url) 渲染为 <img>（alt 兜底），
 *  - 嵌套列表：多级缩进正确嵌套（ul/ol 层级），
 *  - 与现有语法（粗体/斜体/代码/链接/表格/代码块/公式）共存不冲突。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'

// ── stubbed react（自包含）───────────────────────────────────────────────
function createElement(type, props, ...children) {
  const p = props ? { ...props } : {}
  if (children.length === 1) p.children = children[0]
  else if (children.length > 1) p.children = children
  return { type, props: p }
}
const stubbed = {
  createElement,
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useSyncExternalStore: (_s, get) => get(),
}

// ── load bundle ──────────────────────────────────────────────────────────
let registered = null
global.window = {
  __ModuleLoader__: {
    load: (registration) => {
      registered = registration
    },
  },
  location: { href: 'http://127.0.0.1:3080/app', search: '' },
}
global.document = undefined
global.Element = function Element() {}
global.MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
}

eval(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
assert.ok(registered, 'bundle registered')
const exportsObj = registered.factory((spec) => {
  if (spec === 'react') return stubbed
  throw new Error('unexpected require: ' + spec)
})
assert.equal(typeof exportsObj.MarkdownView, 'function', 'MarkdownView exported')

// ── 元素树遍历收集（捕获新语法相关 surface）──────────────────────────────
function render(text) {
  const tree = exportsObj.MarkdownView({ text })
  const tags = []
  const texts = []
  const checkboxes = [] // { checked }
  const dels = []
  const imgs = [] // { src, alt }
  const lis = []
  let ulCount = 0
  let olCount = 0
  let tableCount = 0
  let codeWrappers = 0
  let mathSpans = 0
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
    if (typeof node.type === 'string') {
      tags.push(node.type)
      if (node.type === 'input' && props.type === 'checkbox') checkboxes.push({ checked: Boolean(props.checked) })
      if (node.type === 'del') dels.push(collectText(node))
      if (node.type === 'img') imgs.push({ src: props.src, alt: props.alt })
      if (node.type === 'li') lis.push(node)
      if (node.type === 'ul') ulCount += 1
      if (node.type === 'ol') olCount += 1
      if (node.type === 'table') tableCount += 1
      if (node.type === 'div' && props.className === 'md-code-block') codeWrappers += 1
      if (node.type === 'span' && props.className === 'dsh-md-render-math') mathSpans += 1
    } else if (typeof node.type === 'function') {
      walk(node.type(node.props))
      return
    }
    walk(props.children)
  }
  walk(tree)
  return { tags, texts, checkboxes, dels, imgs, lis, ulCount, olCount, tableCount, codeWrappers, mathSpans }
}

/** 递归拼接某子树下的叶子字符串。 */
function collectText(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  const props = node.props ?? {}
  const kids = props.children
  if (kids === undefined) return ''
  if (typeof kids === 'string' || typeof kids === 'number') return String(kids)
  if (!Array.isArray(kids)) return ''
  return kids.map((c) => collectText(c)).join('')
}

/** 渲染 Markdown 文本并返回完整元素树（用于独立遍历断言）。 */
function resolveTree(text) {
  return exportsObj.MarkdownView({ text })
}

/** 收集每个 <li> 所处的列表嵌套深度（文档序）。 */
function liDepths(listNode) {
  const depths = []
  function walk(node, depth) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') return
    if (Array.isArray(node)) {
      for (const c of node) walk(c, depth)
      return
    }
    if (typeof node.type === 'function') {
      walk(node.type(node.props), depth)
      return
    }
    const type = node.type
    const props = node.props ?? {}
    if (type === 'ul' || type === 'ol') {
      walk(props.children, depth + 1)
      return
    }
    if (type === 'li') {
      depths.push(depth)
      walk(props.children, depth)
      return
    }
    walk(props.children, depth)
  }
  walk(listNode, 0)
  return depths
}

// ── 任务列表 ────────────────────────────────────────────────────────────────
test('任务列表：- [ ] / - [x] 渲染为带 checkbox 的列表项（勾选态区分）', () => {
  const r = render('- [ ] 待办\n- [x] 已完成')
  assert.ok(r.tags.includes('ul'), 'task list renders a ul')
  assert.equal(r.lis.length, 2, 'two list items')
  assert.equal(r.checkboxes.length, 2, 'two checkboxes')
  assert.equal(r.checkboxes[0].checked, false, 'unchecked for `- [ ]`')
  assert.equal(r.checkboxes[1].checked, true, 'checked for `- [x]`')
  assert.ok(r.texts.includes('待办'), 'unchecked task text kept')
  assert.ok(r.texts.includes('已完成'), 'checked task text kept')
})

test('任务列表：checkbox 位于列表项文本之前', () => {
  const li = render('- [x] 事项').lis[0]
  const seq = []
  ;(function collect(n) {
    if (typeof n === 'string' || typeof n === 'number') {
      seq.push('text:' + String(n))
      return
    }
    if (n === null || n === undefined || typeof n === 'boolean') return
    if (Array.isArray(n)) {
      for (const c of n) collect(c)
      return
    }
    if (typeof n.type === 'function') {
      collect(n.type(n.props))
      return
    }
    if (String(n.type) === 'input') {
      seq.push('input')
      return
    }
    collect(n.props.children)
  })(li)
  assert.equal(seq[0], 'input', 'checkbox is the first child of the li')
  assert.ok(
    seq.some((s) => s.startsWith('text:')),
    'li has text content',
  )
})

test('任务列表：[ ] / [x] / [X] 三种勾选标记均识别', () => {
  const r = render('- [ ] a\n- [x] b\n- [X] c')
  assert.equal(r.checkboxes.length, 3, 'three checkboxes')
  assert.equal(r.checkboxes.map((c) => c.checked).join(','), 'false,true,true', 'checked states by marker')
})

// ── 删除线 ────────────────────────────────────────────────────────────────
test('删除线：~~text~~ 渲染为 <del>（内容保留）', () => {
  const r = render('~~已废弃~~ 内容')
  assert.ok(r.dels.length >= 1, 'del element rendered')
  assert.ok(r.dels.includes('已废弃'), 'strikethrough content kept')
})

test('删除线与粗体/斜体/代码/链接共存', () => {
  const r = render('**加粗** ~~删除~~ *斜体* `code` [链接](https://x.com)')
  assert.ok(r.tags.includes('strong'), 'bold coexists')
  assert.ok(r.dels.includes('删除'), 'strikethrough coexists')
  assert.ok(r.tags.includes('em'), 'italic coexists')
  assert.ok(r.tags.includes('code'), 'inline code coexists')
  assert.ok(r.tags.includes('a'), 'link coexists')
})

// ── 图片 ──────────────────────────────────────────────────────────────────
test('图片：![alt](url) 渲染为 <img>（src/alt 正确）', () => {
  const r = render('![示意图](https://cdn.example.com/a.png)')
  assert.equal(r.imgs.length, 1, 'img rendered')
  assert.equal(r.imgs[0].src, 'https://cdn.example.com/a.png', 'src set')
  assert.equal(r.imgs[0].alt, '示意图', 'alt set')
})

test('图片：alt 为空时兜底（![ ](url) 仍渲染 img 且 alt 非空）', () => {
  const r = render('![](https://cdn.example.com/b.png)')
  assert.equal(r.imgs.length, 1, 'img rendered with empty alt')
  assert.equal(r.imgs[0].src, 'https://cdn.example.com/b.png', 'src set')
  assert.ok(r.imgs[0].alt && r.imgs[0].alt.length > 0, 'alt fallback non-empty')
})

test('图片与链接区分；图片不被解析为链接', () => {
  const r = render('![图](img://a.png) [文字](https://x.com)')
  assert.equal(r.imgs.length, 1, 'image parsed as img')
  assert.ok(r.tags.includes('a'), 'plain link still rendered as a')
  assert.equal(r.tags.filter((t) => t === 'a').length, 1, 'exactly one link')
})

// ── 嵌套列表 ──────────────────────────────────────────────────────────────
test('嵌套列表：多级缩进正确嵌套（ul 层级）', () => {
  const r = render('- 一级\n  - 二级\n    - 三级\n- 同级')
  assert.equal(r.ulCount, 3, 'three nested ul levels')
  assert.equal(r.lis.length, 4, 'four list items')
  const depths = liDepths(resolveTree('- 一级\n  - 二级\n    - 三级\n- 同级'))
  assert.deepEqual(depths, [1, 2, 3, 1], 'items at depths 1/2/3/1 (document order)')
})

test('嵌套有序列表（ol）层级正确', () => {
  const r = render('1. 第一\n   1. 第一.一\n2. 第二')
  assert.equal(r.olCount, 2, 'two nested ol levels')
  assert.equal(r.lis.length, 3, 'three ordered items')
  const depths = liDepths(resolveTree('1. 第一\n   1. 第一.一\n2. 第二'))
  assert.deepEqual(depths, [1, 2, 1], 'ordered items at depths 1/2/1')
})

test('嵌套列表中的任务列表（子层也能勾选）', () => {
  const r = render('- [ ] 父项\n  - [x] 子项')
  assert.equal(r.lis.length, 2, 'two items')
  assert.equal(r.checkboxes.length, 2, 'nested task list checkboxes')
  assert.equal(r.checkboxes[0].checked, false, 'parent unchecked')
  assert.equal(r.checkboxes[1].checked, true, 'child checked')
})

// ── 与既有语法共存 ────────────────────────────────────────────────────────
test('与表格/代码块/公式/标题/引用共存，互不冲突', () => {
  const text = [
    '# 标题',
    '',
    '| 名称 | 说明 |',
    '| --- | --- |',
    '| 甲 | **加粗** ~~删除~~ |',
    '| 乙 | `code` ![img](i.png) |',
    '',
    '```js',
    'const x = 1',
    '```',
    '',
    '公式 $E=mc^2$ 与 $$E=1$$',
    '',
    '- [ ] 任务',
    '  - 嵌套',
    '',
    '> 引用',
  ].join('\n')
  const r = render(text)
  assert.equal(r.tableCount, 1, 'table still rendered')
  assert.equal(r.codeWrappers, 1, 'code block still rendered')
  assert.equal(r.mathSpans, 1, 'inline math still rendered')
  assert.ok(r.tags.includes('h1'), 'heading still rendered')
  assert.ok(r.tags.includes('blockquote'), 'quote still rendered')
  assert.ok(r.tags.includes('strong'), 'bold in table cell still rendered')
  assert.equal(r.dels.length, 1, 'strikethrough in table cell rendered')
  assert.equal(r.imgs.length, 1, 'image in table cell rendered')
  assert.equal(r.checkboxes.length, 1, 'task checkboxes still rendered')
  assert.ok(r.lis.length >= 2, 'nested list items still rendered')
})
