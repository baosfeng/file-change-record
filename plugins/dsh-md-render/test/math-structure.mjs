import { test } from 'vitest'
/**
 * 公式结构渲染单测（issue #82）：分数 / 根号 / 上下标 / 求和积分 /
 * 希腊字母 + 回退 + mathStructures 开关门控。
 *
 * 加载已构建 lib/client.js（parts 拼装产物），用桩 React：
 *  - 直接调用 exportsObj.parseMath（纯函数 AST 断言）；
 *  - 调用 MarkdownView 渲染公式（结构元素计数 + 文本扁平化断言）；
 *  - setRenderOptions({ mathStructures: false }) 关闭 → 公式结构不渲染
 *    （与 issue #84 配置体系一致）。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'

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
assert.equal(typeof exportsObj.parseMath, 'function', 'parseMath exported')

// ── 渲染树收集（结构计数 + 文本扁平化）────────────────────────────────
function renderTree(text) {
  const tags = []
  const texts = []
  const mathSpans = []
  const mathBlocks = []
  const fracs = []
  const sqrts = []
  const supsubs = []
  const bigs = []
  const errors = []
  function walk(node, depth) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') {
      texts.push(String(node))
      return
    }
    if (Array.isArray(node)) {
      for (const c of node) walk(c, depth)
      return
    }
    const props = node.props ?? {}
    if (typeof node.type === 'function') {
      walk(node.type(props), depth)
      return
    }
    tags.push(node.type)
    if (props.className === 'dsh-md-render-math') mathSpans.push(node)
    if (props.className === 'dsh-md-render-math-block') mathBlocks.push(node)
    if (props.className === 'dsh-md-render-frac') fracs.push(node)
    if (props.className === 'dsh-md-render-sqrt') sqrts.push(node)
    if (props.className === 'dsh-md-render-supsub') supsubs.push(node)
    if (props.className === 'dsh-md-render-big') bigs.push(node)
    if (props.className === 'dsh-md-render-math-error') errors.push(node)
    walk(props.children, depth + 1)
  }
  walk(exportsObj.MarkdownView({ text }), 0)
  return { tags, texts, mathSpans, mathBlocks, fracs, sqrts, supsubs, bigs, errors }
}

function reset() {
  exportsObj.setRenderOptions({
    copyButton: true,
    syntaxHighlight: true,
    languageLabel: true,
    lineNumbers: true,
    taskList: true,
    strikethrough: true,
    image: true,
    nestedList: true,
    mathStructures: true,
    tableSort: true,
    tableFold: true,
  })
}

// ── parseMath 纯函数 AST 断言 ──────────────────────────────────────────
test('parseMath：\\frac{a}{b} 产出 frac 节点（num/den）', () => {
  const { nodes, failed } = exportsObj.parseMath('\\frac{a}{b}')
  assert.equal(failed, false, 'not failed')
  assert.equal(nodes.length, 1, 'single node')
  assert.equal(nodes[0].t, 'frac', 'frac node')
  assert.equal(nodes[0].num.t, 'text', 'numerator is text')
  assert.equal(nodes[0].num.v, 'a', 'numerator value')
  assert.equal(nodes[0].den.v, 'b', 'denominator value')
})

test('parseMath：\\sqrt{x} 产出 sqrt 节点（body）', () => {
  const { nodes, failed } = exportsObj.parseMath('\\sqrt{x}')
  assert.equal(failed, false, 'not failed')
  assert.equal(nodes[0].t, 'sqrt', 'sqrt node')
  assert.equal(nodes[0].body.v, 'x', 'body value')
})

test('parseMath：x^2 与 x_i 与 x_i^2 产出 supsub 节点', () => {
  const sup = exportsObj.parseMath('x^2')
  assert.equal(sup.failed, false, 'x^2 not failed')
  assert.equal(sup.nodes[0].t, 'supsub', 'supsub node for x^2')
  assert.equal(sup.nodes[0].base.v, 'x', 'base x')
  assert.equal(sup.nodes[0].sup.v, '2', 'sup 2')
  assert.equal(sup.nodes[0].sub, null, 'no sub')

  const sub = exportsObj.parseMath('x_i')
  assert.equal(sub.nodes[0].t, 'supsub', 'supsub node for x_i')
  assert.equal(sub.nodes[0].sub.v, 'i', 'sub i')
  assert.equal(sub.nodes[0].sup, null, 'no sup')

  const both = exportsObj.parseMath('x_i^2')
  assert.equal(both.nodes[0].t, 'supsub', 'supsub node for x_i^2')
  assert.equal(both.nodes[0].sub.v, 'i', 'sub i')
  assert.equal(both.nodes[0].sup.v, '2', 'sup 2')
})

test('parseMath：\\sum_{i=1}^{n} 产出 big 节点（sym=∑，sub/sup）', () => {
  const { nodes, failed } = exportsObj.parseMath('\\sum_{i=1}^{n}')
  assert.equal(failed, false, 'not failed')
  assert.equal(nodes[0].t, 'big', 'big node')
  assert.equal(nodes[0].sym, '∑', 'sum symbol')
  assert.ok(nodes[0].sub, 'sub limits present')
  assert.ok(nodes[0].sup, 'sup limits present')
})

test('parseMath：\\int_0^1 产出 big 节点（sym=∫）', () => {
  const { nodes, failed } = exportsObj.parseMath('\\int_0^1')
  assert.equal(failed, false, 'not failed')
  assert.equal(nodes[0].t, 'big', 'big node')
  assert.equal(nodes[0].sym, '∫', 'integral symbol')
  assert.equal(nodes[0].sub.t, 'text', 'sub is text')
  assert.equal(nodes[0].sub.v, '0', 'sub 0')
  assert.equal(nodes[0].sup.v, '1', 'sup 1')
})

test('parseMath：\\alpha 等希腊字母命令转 Unicode 符号', () => {
  const { nodes, failed } = exportsObj.parseMath('\\alpha + \\beta \\cdot \\omega')
  assert.equal(failed, false, 'not failed')
  const text = nodes.map((n) => (n.t === 'text' ? n.v : '')).join('')
  assert.ok(text.includes('α'), 'alpha → α')
  assert.ok(text.includes('β'), 'beta → β')
  assert.ok(text.includes('⋅'), 'cdot → ⋅')
  assert.ok(text.includes('ω'), 'omega → ω')
})

test('parseMath：无法解析的公式回退（\\frac 参数不完整 → failed）', () => {
  const r1 = exportsObj.parseMath('\\frac{a}{b')
  assert.equal(r1.failed, true, 'unclosed frac group → failed')
  const r2 = exportsObj.parseMath('\\frac a b')
  assert.equal(r2.failed, true, 'frac without braces → failed')
  const r3 = exportsObj.parseMath('\\sqrt{x')
  assert.equal(r3.failed, true, 'unclosed sqrt group → failed')
  const r4 = exportsObj.parseMath('x^{2')
  assert.equal(r4.failed, true, 'unclosed group for sup → failed')
  const r5 = exportsObj.parseMath('^2')
  assert.equal(r5.failed, true, 'sup without base → failed')
})

test('parseMath：未知命令保持原样文本（不失败、不误伤）', () => {
  const { nodes, failed } = exportsObj.parseMath('\\unknowncmd{x}')
  assert.equal(failed, false, 'unknown command not failed')
  assert.equal(nodes[0].t, 'text', 'unknown command is text')
  assert.equal(nodes[0].v, '\\unknowncmd', 'kept as literal')
})

test('parseMath：嵌套结构（frac 内 frac / sqrt 内 supsub）', () => {
  const nested = exportsObj.parseMath('\\frac{1}{1+\\frac{1}{x}}')
  assert.equal(nested.failed, false, 'nested frac not failed')
  assert.equal(nested.nodes[0].t, 'frac', 'outer frac')
  assert.equal(nested.nodes[0].den.t, 'seq', 'denominator is seq')
  const comb = exportsObj.parseMath('\\sqrt{x^2+y^2}')
  assert.equal(comb.failed, false, 'sqrt with supsub not failed')
  assert.equal(comb.nodes[0].t, 'sqrt', 'sqrt node')
  assert.equal(comb.nodes[0].body.t, 'seq', 'sqrt body is seq')
})

// ── MarkdownView 渲染断言（结构元素 + 文本扁平化）─────────────────────
test('渲染：\\frac{a}{b} 渲染为 dsh-md-render-frac（num/den）', () => {
  const r = renderTree('求 $\\frac{a}{b}$ 值')
  assert.equal(r.mathSpans.length, 1, 'math span rendered')
  assert.equal(r.fracs.length, 1, 'frac structure rendered')
  const frac = r.fracs[0]
  const classes = []
  function collectClasses(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') return
    if (Array.isArray(node)) {
      for (const c of node) collectClasses(c)
      return
    }
    if (typeof node.type === 'function') {
      collectClasses(node.type(node.props))
      return
    }
    if (typeof node.props.className === 'string') classes.push(node.props.className)
    collectClasses(node.props.children)
  }
  collectClasses(frac)
  assert.ok(classes.includes('dsh-md-render-frac-num'), 'num class present')
  assert.ok(classes.includes('dsh-md-render-frac-den'), 'den class present')
  assert.ok(r.texts.join('').includes('ab'), 'a/b content kept')
})

test('渲染：\\sqrt{x} 渲染为 dsh-md-render-sqrt（含 √ 符号）', () => {
  const r = renderTree('求 $\\sqrt{x}$ 值')
  assert.equal(r.sqrts.length, 1, 'sqrt structure rendered')
  assert.ok(r.texts.join('').includes('√'), 'sqrt symbol rendered')
  assert.ok(r.texts.join('').includes('x'), 'sqrt body content kept')
})

test('渲染：x^2 / x_i 渲染为 dsh-md-render-supsub（上下标）', () => {
  const r = renderTree('$x^2$ 与 $x_i$ 与 $x_i^2$')
  assert.equal(r.supsubs.length, 3, 'three supsub structures')
  assert.equal(r.mathSpans.length, 3, 'three inline math spans')
  const flat = r.texts.join('')
  assert.ok(flat.includes('x2'), 'superscript content kept')
  assert.ok(flat.includes('xi'), 'subscript content kept')
})

test('渲染：\\sum_{i=1}^{n} 与 \\int_0^1 渲染为 dsh-md-render-big（符号+上下限）', () => {
  const r = renderTree('$\\sum_{i=1}^{n} i$ 与 $\\int_0^1 x dx$')
  assert.equal(r.bigs.length, 2, 'two big structures')
  assert.ok(r.texts.join('').includes('∑'), 'sum symbol rendered')
  assert.ok(r.texts.join('').includes('∫'), 'integral symbol rendered')
  const flat = r.texts.join('')
  assert.ok(flat.includes('i=1'), 'sum lower limit kept')
  assert.ok(flat.includes('n'), 'sum upper limit kept')
  assert.ok(flat.includes('0') && flat.includes('1'), 'integral limits kept')
})

test('渲染：\\alpha 等希腊字母渲染为符号（行内 + 块级）', () => {
  const r = renderTree('$\\alpha + \\beta = \\gamma$')
  assert.ok(r.texts.join('').includes('α'), 'alpha rendered')
  assert.ok(r.texts.join('').includes('β'), 'beta rendered')
  assert.ok(r.texts.join('').includes('γ'), 'gamma rendered')
})

test('渲染：无法解析的公式保持原文（不渲染结构、不报错）', () => {
  const r = renderTree('$\\frac{a}{b$ 测试')
  assert.equal(r.fracs.length, 0, 'no frac structure for unparseable math')
  assert.equal(r.sqrts.length, 0, 'no sqrt structure')
  assert.equal(r.errors.length, 0, 'no error marker (fallback keeps original)')
  assert.ok(r.texts.join('').includes('\\frac{a}{b'), 'original text kept inside math span')
})

test('渲染：未知命令与 \text 命令不误伤（部分结构 + 原样文本）', () => {
  const r = renderTree('$\\frac{a}{b} + \\foo$ 与 $\\text{if } x>0$')
  assert.equal(r.fracs.length, 1, 'frac still rendered')
  assert.ok(r.texts.join('').includes('\\foo'), 'unknown command kept literal')
  assert.ok(r.texts.join('').includes('if'), '\\text arg kept')
})

test('渲染：块级公式结构（$$\\sum_{i=1}^{n} x_i$$）', () => {
  const r = renderTree('$$\n\\sum_{i=1}^{n} x_i\n$$')
  assert.equal(r.mathBlocks.length, 1, 'block math rendered')
  assert.equal(r.bigs.length, 1, 'big structure inside block')
  assert.equal(r.supsubs.length, 1, 'supsub structure inside block')
})

// ── issue #84：mathStructures 开关门控 ─────────────────────────────────
test('mathStructures 关闭 → 公式结构不渲染（保持原文）', () => {
  reset()
  exportsObj.setRenderOptions({ mathStructures: false })
  try {
    const r = renderTree('公式 $\\frac{a}{b}$ 与 $x^2$ 测试')
    assert.equal(r.mathSpans.length, 0, 'no inline math span when disabled')
    assert.equal(r.fracs.length, 0, 'no frac structure when disabled')
    assert.equal(r.supsubs.length, 0, 'no supsub structure when disabled')
    assert.equal(r.mathBlocks.length, 0, 'no block math when disabled')
    assert.ok(r.texts.join('').includes('\\frac{a}{b}'), 'math syntax kept')
    assert.ok(r.texts.join('').includes('x^2'), 'script syntax kept')
  } finally {
    reset()
  }
})

test('mathStructures 默认开启 → 公式结构渲染', () => {
  reset()
  const r = renderTree('$\\frac{a}{b}$ 与 $\\sqrt{x}$')
  assert.equal(r.fracs.length, 1, 'frac rendered by default')
  assert.equal(r.sqrts.length, 1, 'sqrt rendered by default')
})
