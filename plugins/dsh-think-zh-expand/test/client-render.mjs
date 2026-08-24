import { test } from 'vitest'
/**
 * Client render-path test for dsh-think-zh-expand: loads the client bundle
 * with a stubbed react (real createElement; hooks stubbed), mounts the plugin
 * against a mocked slots service, captures the assistant-step renderer it
 * registers, then invokes it with markdown text blocks to verify:
 *  - tables (| a | b | + separator + data rows) render as table/thead/tbody
 *    with th/td cells and per-column alignment from the separator row,
 *  - a non-table pipe line (no separator row) falls back to a paragraph,
 *  - basic inline markdown inside cells still works (bold / inline code).
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'

// ── stubbed react ─────────────────────────────────────────────────────────
// 渲染路径测试只需要元素树结构（type/props/children），不依赖真实 react：
// 自写最小 createElement（children 语义与 React 一致：单 child 直接赋值、
// 多 child 组装数组、数组 child 原样保留）。CI（ubuntu runner 无 node_modules）
// 与本机均可运行——此前 require 本机绝对路径的 react，导致远程 CI 必然失败。
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
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}

// ── load bundle ────────────────────────────────────────────────────────────
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

eval(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
assert.ok(registered, 'bundle registered')
const exportsObj = registered.factory((spec) => {
  if (spec === 'react') return stubbed
  throw new Error('unexpected require: ' + spec)
})
assert.deepEqual(exportsObj.inject, ['slots'])
assert.equal(typeof exportsObj.apply, 'function')

// ── mock ctx: effect runs immediately; slots.inject/register captured ─────
let registerFn = null
let capturedRenderer = null
const ctx = {
  effect: (fn) => fn(),
  slots: {
    inject: (_name, fn) => { registerFn = fn; return () => {} },
    register: (_desc, renderer) => { capturedRenderer = renderer; return () => {} },
  },
}
exportsObj.apply(ctx)
assert.equal(typeof registerFn, 'function', 'slots.inject callback captured')
registerFn()
assert.equal(typeof capturedRenderer, 'function', 'assistant-step renderer captured')

// ── helpers ───────────────────────────────────────────────────────────────
function renderText(text) {
  const tree = capturedRenderer({ node: { data: { blocks: [{ kind: 'text', text }] } } })
  const tags = []
  const texts = []
  const thStyles = []
  function walk(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') { texts.push(String(node)); return }
    if (Array.isArray(node)) { for (const c of node) walk(c); return }
    const props = node.props ?? {}
    if (typeof node.type === 'string') {
      tags.push(node.type)
      if (node.type === 'th' && props.style && typeof props.style.textAlign === 'string') {
        thStyles.push(props.style.textAlign)
      }
    } else if (typeof node.type === 'function') {
      // plugin internal components (AssistantStepView / MarkdownView / ThinkBlock)
      walk(node.type(node.props))
      return
    }
    walk(props.children)
  }
  walk(tree)
  return { tags, texts, thStyles }
}

// ── assertions ────────────────────────────────────────────────────────────
try {
  // 1. standard table: header + separator + data rows
  const t1 = renderText('| 插件 | 版本 |\n|:-----|:----:|\n| dsh-file-activity | **0.4.2** |\n| dsh-think-zh-expand | `0.2.0` |')
  assert.ok(t1.tags.includes('table'), 'table rendered')
  assert.ok(t1.tags.includes('thead'), 'thead rendered')
  assert.ok(t1.tags.includes('tbody'), 'tbody rendered')
  const thCount = t1.tags.filter((t) => t === 'th').length
  const tdCount = t1.tags.filter((t) => t === 'td').length
  assert.equal(thCount, 2, `2 header cells, got ${thCount}`)
  assert.equal(tdCount, 4, `4 data cells (2 rows × 2 cols), got ${tdCount}`)
  assert.ok(t1.texts.includes('插件'), 'header cell text')
  assert.ok(t1.texts.includes('版本'), 'header cell text 2')
  assert.ok(t1.texts.includes('dsh-file-activity'), 'data cell text')
  assert.ok(t1.texts.includes('0.4.2'), 'bold content inside cell (rendered)')
  assert.ok(t1.texts.includes('0.2.0'), 'inline code content inside cell (rendered)')
  // alignment: ':----' left, ':----:' center (from the separator row)
  assert.deepEqual(t1.thStyles, ['left', 'center'], 'alignment from separator row')

  // 2. alignment variants: :---: center, ---: right
  const r2 = renderText('| a | b |\n|:---:|---:|\n| 1 | 2 |')
  assert.deepEqual(r2.thStyles, ['center', 'right'], 'center + right alignment')

  // 3. non-table pipe line (no separator row) falls back to a paragraph
  const r3 = renderText('| just a pipe line')
  assert.ok(!r3.tags.includes('table'), 'no table without separator row')
  assert.ok(r3.tags.includes('p'), 'falls back to paragraph')

  // 4. pipe line followed by non-table line also falls back
  const r4 = renderText('| a | b |\nnot a separator')
  assert.ok(!r4.tags.includes('table'), 'no table when second line is not a separator')
  assert.ok(r4.tags.includes('p'), 'paragraph fallback for non-table pipes')

  // 5. reasoning block still renders as think block (regression: default expanded)
  const think = capturedRenderer({ node: { data: { blocks: [{ kind: 'reasoning', text: '第一行\n第二行' }] } } })
  const thinkTexts = []
  function walkText(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') { thinkTexts.push(String(node)); return }
    if (Array.isArray(node)) { for (const c of node) walkText(c); return }
    const props = node.props ?? {}
    if (typeof node.type === 'function') { walkText(node.type(props)); return }
    walkText(props.children)
  }
  walkText(think)
  assert.ok(thinkTexts.includes('思考'), 'think block title')
  assert.ok(thinkTexts.some((t) => t.includes('第一行')), 'thinking content expanded')

  // 6. fenced code blocks keep their language marker (```mermaid → language-mermaid)
  //    and are wrapped in the host `md-code-block` container, so third-party
  //    renderers (dsh-mermaid-render scans `div.md-code-block`) can find them.
  const codeLangs = []
  let mdCodeBlockWrappers = 0
  function walkLangs(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (Array.isArray(node)) { for (const c of node) walkLangs(c); return }
    const props = node.props ?? {}
    if (typeof node.type === 'function') { walkLangs(node.type(props)); return }
    if (node.type === 'div' && props.className === 'md-code-block') mdCodeBlockWrappers += 1
    if (node.type === 'code' && typeof props.className === 'string') codeLangs.push(props.className)
    walkLangs(props.children)
  }
  walkLangs(capturedRenderer({ node: { data: { blocks: [{ kind: 'text', text: '```mermaid\nflowchart TD\n    A --> B\n```\n\n```js\nconst x = 1\n```' }] } } }))
  assert.ok(codeLangs.includes('language-mermaid'), 'mermaid fence keeps language class')
  assert.ok(codeLangs.includes('language-js'), 'js fence keeps language class')
  assert.ok(mdCodeBlockWrappers >= 2, 'fenced blocks wrapped in md-code-block for third-party renderers')

  // 7. CommonMark 多反引号行内代码：`` `agent/status` ``（内容含单反引号）
  //    应整体渲染为 code 且内容为 `agent/status`（回归：mdInline 只支持单
  //    反引号配对时，双反引号输入会错位——反引号裸露、agent/status 变裸
  //    文本、出现内容为空白的 code）。
  function constText(node) {
    const out = []
    function walk(n) {
      if (n === null || n === undefined || typeof n === 'boolean') return
      if (typeof n === 'string' || typeof n === 'number') { out.push(String(n)); return }
      if (Array.isArray(n)) { for (const c of n) walk(c); return }
      const props = n.props ?? {}
      if (typeof n.type === 'function') { walk(n.type(props)); return }
      walk(props.children)
    }
    walk(node)
    return out.join('')
  }
  function collectCode(tree) {
    const codeTexts = []
    const allTexts = []
    function walk(node) {
      if (node === null || node === undefined || typeof node === 'boolean') return
      if (typeof node === 'string' || typeof node === 'number') { allTexts.push(String(node)); return }
      if (Array.isArray(node)) { for (const c of node) walk(c); return }
      const props = node.props ?? {}
      if (typeof node.type === 'function') { walk(node.type(props)); return }
      if (node.type === 'code') codeTexts.push(constText(props.children))
      walk(props.children)
    }
    walk(tree)
    return { codeTexts, allTexts }
  }
  const r7 = collectCode(capturedRenderer({ node: { data: { blocks: [{ kind: 'text', text: '思考内容中的 `` `agent/status` `` 应该会被 `mdInline` 解析' }] } } }))
  assert.deepEqual(r7.codeTexts, ['`agent/status`', 'mdInline'], 'double-backtick span renders whole token as code, single backtick still works')
  assert.ok(!r7.codeTexts.includes(' '), 'no whitespace-only code artifact')
  assert.ok(!r7.codeTexts.includes(''), 'no empty code artifact')

  // 8. 混合：双反引号（紧凑/带空格）与单反引号共存
  const r8 = collectCode(capturedRenderer({ node: { data: { blocks: [{ kind: 'text', text: '`` `job_list` `` 与 `agent/status`' }] } } }))
  assert.deepEqual(r8.codeTexts, ['`job_list`', 'agent/status'], 'mixed multi/single backticks')

  // 9. 无内容的连续反引号串（4 连）保持字面量，不解析为 code
  const r9 = collectCode(capturedRenderer({ node: { data: { blocks: [{ kind: 'text', text: '无内容反引号串 ```` 原样' }] } } }))
  assert.ok(!r9.codeTexts.some((t) => t.includes('`')), 'four consecutive backticks stay literal')
  assert.ok(r9.allTexts.some((t) => t.includes('````')), 'four backticks text retained')

  // 10. 思考块（reasoning）内的双反引号同样渲染为 code（用户场景回归）
  const r10 = collectCode(capturedRenderer({ node: { data: { blocks: [{ kind: 'reasoning', text: '调用 `` `agent/status` `` 查看状态' }] } } }))
  assert.ok(r10.codeTexts.includes('`agent/status`'), 'reasoning block renders multi-backtick code')

  // 11. 工具中文化映射（需求 3a）：卡片标题 / 工具名 / 工具描述 / others 摘要
  assert.equal(exportsObj.zhCardTitle('Search'), '搜索', 'variant title Search')
  assert.equal(exportsObj.zhCardTitle('Bash'), '命令行', 'variant title Bash')
  assert.equal(exportsObj.zhCardTitle('Read'), '读取', 'variant title Read')
  assert.equal(exportsObj.zhCardTitle('Write'), '写入', 'variant title Write')
  assert.equal(exportsObj.zhCardTitle('Edit'), '编辑', 'variant title Edit')
  assert.equal(exportsObj.zhCardTitle('Code'), '代码', 'variant title Code')
  assert.equal(exportsObj.zhCardTitle('Inspect'), '检查', 'cordis inspect title')
  assert.equal(exportsObj.zhCardTitle('Run Cordis Plugin'), '运行 Cordis 插件', 'cordis run title')
  assert.equal(exportsObj.zhCardTitle('Tool call'), null, '"Tool call" stays with the global table')
  assert.equal(exportsObj.zhToolName('web_search'), '网络搜索', 'tool name web_search')
  assert.equal(exportsObj.zhToolName('bash'), '命令行', 'tool name bash')
  assert.equal(exportsObj.zhToolName('read'), '读取文件', 'tool name read')
  assert.equal(exportsObj.zhToolName('ask_user_question'), '询问用户', 'tool name ask_user_question')
  assert.equal(exportsObj.zhToolName('mcp__codebase-memory__search_graph'), '图搜索', 'tool name codebase-memory')
  assert.equal(exportsObj.zhToolName('unknown_tool'), null, 'unmapped tool stays english')
  assert.equal(exportsObj.zhToolDesc('web_search'), '搜索网络获取最新信息。', 'tool desc web_search')
  assert.equal(exportsObj.zhToolDesc('bash'), '执行命令并返回输出（可设置工作目录、超时）。', 'tool desc bash')
  assert.equal(exportsObj.zhToolDesc('unknown_tool'), null, 'unmapped desc stays english')
  assert.equal(
    exportsObj.zhCardSummary('ask_user_question · {"text":"确认"}'),
    '询问用户 · {"text":"确认"}',
    'others summary tool-name prefix localized'
  )
  assert.equal(exportsObj.zhCardSummary('web_search · 关键词'), '网络搜索 · 关键词', 'others summary web_search')
  assert.equal(exportsObj.zhCardSummary('no_prefix_here'), null, 'summary without tool prefix untouched')
  assert.equal(exportsObj.zhCardSummary('unknown_tool · x'), null, 'unmapped summary tool untouched')

  console.log('ALL CLIENT RENDER-PATH TESTS PASSED')
} finally {
  delete global.window
  delete global.localStorage
  delete global.fetch
  delete global.navigator
}

test('script-style suite (assertions ran at module load)', () => {})
