import { test } from 'vitest'
/**
 * MarkdownView unit tests for dsh-md-render (issue #31 渲染职责迁移).
 *
 * Loads the BUILT bundle lib/client.js (parts spliced by scripts/build.mjs)
 * against a stubbed react, then exercises the exported MarkdownView
 * component directly (function-component call + element-tree walk):
 *  - standard GFM tables render as table.tzx-table with thead/tbody and
 *    per-column alignment (thinking-mode regression input included),
 *  - pipe lines without a separator row fall back to paragraphs,
 *  - fenced code blocks keep the language class and are wrapped in the
 *    host `md-code-block` container (dsh-mermaid-render scans it),
 *  - inline math `$...$` renders as span.dsh-md-render-math; currency/`$$` guards
 *    keep `$5` / `$$x$$` literal,
 *  - block math `$$...$$` (single-line and multi-line) renders as
 *    div.dsh-md-render-math-block,
 *  - headings / lists / quotes / paragraphs still render,
 *  - CommonMark multi-backtick inline code still works.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'

// ── stubbed react (self-contained: no react install needed) ───────────────
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

// ── load bundle ────────────────────────────────────────────────────────────
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

// ── element-tree walk helpers ───────────────────────────────────────────────
function render(text) {
  const tree = exportsObj.MarkdownView({ text })
  const tags = []
  const texts = []
  const thStyles = []
  const codeLangs = []
  let mdCodeBlockWrappers = 0
  let mathSpans = 0
  let mathBlocks = 0
  let mathErrorSpans = 0
  let mathErrorBlocks = 0
  let copyButtons = 0
  const mathErrorTitles = []
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
      if (node.type === 'th' && props.style && typeof props.style.textAlign === 'string') {
        thStyles.push(props.style.textAlign)
      }
      if (node.type === 'div' && props.className === 'md-code-block') mdCodeBlockWrappers += 1
      if (node.type === 'code' && typeof props.className === 'string') codeLangs.push(props.className)
      if (node.type === 'span' && props.className === 'dsh-md-render-math') mathSpans += 1
      if (node.type === 'div' && props.className === 'dsh-md-render-math-block') mathBlocks += 1
      if (node.type === 'span' && props.className === 'dsh-md-render-math-error') {
        mathErrorSpans += 1
        if (typeof props.title === 'string') mathErrorTitles.push(props.title)
      }
      if (node.type === 'div' && props.className === 'dsh-md-render-math-error') {
        mathErrorBlocks += 1
        if (typeof props.title === 'string') mathErrorTitles.push(props.title)
      }
      if (
        node.type === 'button' &&
        typeof props.className === 'string' &&
        props.className.includes('dsh-md-render-copy')
      ) {
        copyButtons += 1
      }
    } else if (typeof node.type === 'function') {
      walk(node.type(node.props))
      return
    }
    walk(props.children)
  }
  walk(tree)
  return {
    tags,
    texts,
    thStyles,
    codeLangs,
    mdCodeBlockWrappers,
    mathSpans,
    mathBlocks,
    mathErrorSpans,
    mathErrorBlocks,
    mathErrorTitles,
    copyButtons,
  }
}

// ── assertions ──────────────────────────────────────────────────────────────
test('标准 GFM 表格渲染为 table.tzx-table（表头/数据/对齐）', () => {
  const r = render(
    '| 插件 | 版本 |\n|:-----|:----:|\n| dsh-file-activity | **0.4.2** |\n| dsh-think-zh-expand | `0.2.0` |',
  )
  assert.ok(r.tags.includes('table'), 'table rendered')
  assert.ok(r.tags.includes('thead'), 'thead rendered')
  assert.ok(r.tags.includes('tbody'), 'tbody rendered')
  assert.equal(r.tags.filter((t) => t === 'th').length, 2, '2 header cells')
  assert.equal(r.tags.filter((t) => t === 'td').length, 4, '4 data cells (2 rows × 2 cols)')
  assert.ok(r.texts.includes('插件'), 'header cell text')
  assert.ok(r.texts.includes('0.4.2'), 'bold content inside cell')
  assert.deepEqual(r.thStyles, ['left', 'center'], 'alignment from separator row')
})

test('思考模式回归：reasoning 块同款标准表格输入渲染不受影响', () => {
  const r = render(
    '| 插件 | 版本 |\n|:-----|:----:|\n| dsh-file-activity | **0.4.2** |\n| dsh-think-zh-expand | `0.2.0` |',
  )
  assert.ok(r.tags.includes('table'), 'standard table parsed')
  assert.deepEqual(r.thStyles, ['left', 'center'], 'alignment preserved')
  assert.equal(r.tags.filter((t) => t === 'td').length, 4, 'two data rows')
})

test('无分隔行的管道行回退为段落', () => {
  const r = render('| just a pipe line')
  assert.ok(!r.tags.includes('table'), 'no table without separator row')
  assert.ok(r.tags.includes('p'), 'falls back to paragraph')
})

test('代码块保持语言类并包裹在 md-code-block 容器（mermaid 扫描宿主）', () => {
  const r = render('```mermaid\nflowchart TD\n    A --> B\n```\n\n```js\nconst x = 1\n```')
  assert.ok(r.codeLangs.includes('language-mermaid'), 'mermaid fence keeps language class')
  assert.ok(r.codeLangs.includes('language-js'), 'js fence keeps language class')
  assert.ok(r.mdCodeBlockWrappers >= 2, 'fenced blocks wrapped in md-code-block')
})

test('行内公式 $...$ 渲染为 span.dsh-md-render-math', () => {
  const r = render('公式 $x^2 + y^2$ 测试')
  assert.equal(r.mathSpans, 1, 'inline math span rendered')
  assert.ok(r.texts.includes('x^2 + y^2'), 'math content kept')
})

test('货币 $5 与变量 a$b 不解析为公式', () => {
  const r = render('价格 $5 和 $10 元，变量 a$b$c')
  assert.equal(r.mathSpans, 0, 'currency/variable not treated as math')
  assert.ok(
    r.texts.some((t) => t.includes('$5')),
    'currency text kept literal',
  )
})

test('块级公式 $$...$$ 渲染为 div.dsh-md-render-math-block（单行）', () => {
  const r = render('$$E=mc^2$$')
  assert.equal(r.mathBlocks, 1, 'block math rendered')
  assert.ok(r.texts.includes('E=mc^2'), 'block math content kept')
})

test('块级公式 $$ 开闭块（多行）渲染为 div.dsh-md-render-math-block', () => {
  const r = render('$$\nE = mc^2\n\\int_0^1 x dx\n$$')
  assert.equal(r.mathBlocks, 1, 'multi-line block math rendered')
  assert.ok(
    r.texts.some((t) => t.includes('E = mc^2')),
    'multi-line content kept',
  )
})

// ── 公式错误提示（issue #32）：异常公式 → 错误标记 + 原文保留 ──────────
test('未闭合的行内公式 $ 渲染为错误标记（原文保留）', () => {
  const r = render('公式 $x^2 测试')
  assert.equal(r.mathErrorSpans, 1, 'unclosed inline math marked as error')
  assert.ok(r.mathErrorTitles.includes('未闭合的公式'), 'error title set')
  assert.ok(
    r.texts.some((t) => t.includes('$x^2 测试')),
    'original text kept',
  )
})

test('空公式（内容为空白）渲染为错误标记（原文保留）', () => {
  const r = render('公式 $ $ 测试')
  assert.equal(r.mathErrorSpans, 1, 'empty inline math marked as error')
  assert.ok(r.mathErrorTitles.includes('公式内容异常'), 'error title set')
  assert.ok(
    r.texts.some((t) => t.includes('$ $')),
    'original text kept',
  )
})

test('异常内容（以空白开头）渲染为错误标记（原文保留）', () => {
  const r = render('公式 $ x^2$ 测试')
  assert.equal(r.mathErrorSpans, 1, 'malformed inline math marked as error')
  assert.ok(
    r.texts.some((t) => t.includes('$ x^2$')),
    'original text kept',
  )
})

test('未闭合的块级公式 $$ 渲染为错误标记（原文保留）', () => {
  const r = render('$$\nE = mc^2')
  assert.equal(r.mathErrorBlocks, 1, 'unclosed block math marked as error')
  assert.ok(r.mathErrorTitles.includes('未闭合的公式'), 'error title set')
  assert.ok(
    r.texts.some((t) => t.includes('E = mc^2')),
    'original content kept',
  )
})

test('空块级公式（$$ 开闭块 / $$$$ 单行）渲染为错误标记', () => {
  const r1 = render('$$\n$$')
  assert.equal(r1.mathErrorBlocks, 1, 'empty $$..$$ block marked as error')
  const r2 = render('$$$$')
  assert.equal(r2.mathErrorBlocks, 1, 'empty $$$$ single-line block marked as error')
})

test('货币/变量/块级保护不误报公式错误', () => {
  const r = render('价格 $5 和 $10 元，变量 a$b$c，行内 $$x$$')
  assert.equal(r.mathErrorSpans, 0, 'currency/variable/block-guard not error')
  assert.equal(r.mathErrorBlocks, 0, 'no block error')
  assert.ok(
    r.texts.some((t) => t.includes('$5')),
    'currency text kept literal',
  )
})

test('标题/列表/引用/段落仍正常渲染', () => {
  const r = render('# 标题\n\n- 甲\n- 乙\n\n> 引用\n\n普通段落')
  assert.ok(r.tags.includes('h1'), 'heading rendered')
  assert.ok(r.tags.includes('ul'), 'bullet list rendered')
  assert.ok(r.tags.includes('blockquote'), 'quote rendered')
  assert.ok(r.tags.includes('p'), 'paragraph rendered')
})

test('CommonMark 多反引号行内代码仍正常（迁移回归）', () => {
  const codeTexts = []
  function collect(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') return
    if (Array.isArray(node)) {
      for (const c of node) collect(c)
      return
    }
    const props = node.props ?? {}
    if (typeof node.type === 'function') {
      collect(node.type(props))
      return
    }
    if (node.type === 'code') codeTexts.push(String(props.children))
    collect(props.children)
  }
  collect(exportsObj.MarkdownView({ text: '`` `agent/status` `` 与 `mdInline`' }))
  assert.deepEqual(codeTexts, ['`agent/status`', 'mdInline'], 'multi-backtick span renders whole token as code')
})

// ── 复制按钮（issue #74）：代码块 / 整段内容一键复制 ────────────────
test('代码块右下角渲染复制按钮（每个 md-code-block 一个）', () => {
  const r = render('```js\nconst x = 1\n```\n\n```python\nprint(1)\n```')
  assert.equal(r.mdCodeBlockWrappers, 2, 'two code blocks')
  assert.equal(r.copyButtons, 3, '2 code-block buttons + 1 content button')
  assert.ok(r.texts.includes('复制'), 'button label 复制 rendered')
})

test('整段内容右下角渲染复制按钮（tzx-md 容器内）', () => {
  const r = render('普通段落文本')
  assert.equal(r.copyButtons, 1, 'content copy button rendered')
  assert.ok(r.texts.includes('复制'), 'button label 复制 rendered')
})

test('无代码块时仅内容复制按钮', () => {
  const r = render('# 标题\n\n- 甲\n- 乙')
  assert.equal(r.copyButtons, 1, 'only the content copy button')
})
