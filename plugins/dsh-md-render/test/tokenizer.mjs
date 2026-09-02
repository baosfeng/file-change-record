import { test } from 'vitest'
/**
 * Tokenizer unit tests for dsh-md-render code-block highlight (issue #80).
 *
 * Loads the BUILT bundle lib/client.js (parts spliced by scripts/build.mjs)
 * against a stubbed react, then exercises the exported `tokenizeCode` pure
 * function directly (per-language keyword/string/comment/number/function
 * recognition, unknown-language plain fallback) and `langLabel`.
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
assert.equal(typeof exportsObj.tokenizeCode, 'function', 'tokenizeCode exported')
assert.equal(typeof exportsObj.langLabel, 'function', 'langLabel exported')

function findToken(tokens, type, text) {
  return tokens.find((t) => t.type === type && t.text === text)
}

// ── JavaScript / TypeScript ──────────────────────────────────────────────
test('JS：关键字 / 字符串 / 注释 / 数字 / 函数名识别', () => {
  const lines = exportsObj.tokenizeCode('const x = "hi" // comment\nlet n = 42\nfunction foo() {}', 'javascript')
  assert.equal(lines.length, 3, '3 lines')
  assert.ok(findToken(lines[0], 'keyword', 'const'), 'const is keyword')
  assert.ok(findToken(lines[0], 'string', '"hi"'), 'string literal recognized')
  assert.ok(findToken(lines[0], 'comment', '// comment'), 'line comment recognized')
  assert.ok(findToken(lines[1], 'keyword', 'let'), 'let is keyword')
  assert.ok(findToken(lines[1], 'number', '42'), 'number recognized')
  assert.ok(findToken(lines[2], 'keyword', 'function'), 'function declaration keyword')
  assert.ok(findToken(lines[2], 'function', 'foo'), 'function name (before paren) recognized')
})

test('JS：单行块注释与模板串', () => {
  const lines = exportsObj.tokenizeCode('/* block */ const a = 1\nconst t = `x`', 'javascript')
  assert.ok(findToken(lines[0], 'comment', '/* block */'), 'block comment recognized')
  assert.ok(findToken(lines[1], 'string', '`x`'), 'template literal recognized')
})

test('TypeScript：类型关键字', () => {
  const lines = exportsObj.tokenizeCode('interface User { id: number }\ntype X = string | undefined', 'typescript')
  assert.ok(findToken(lines[0], 'keyword', 'interface'), 'interface keyword')
  assert.ok(findToken(lines[0], 'keyword', 'number'), 'number type keyword')
  assert.ok(findToken(lines[1], 'keyword', 'type'), 'type keyword')
})

test('Python：def/return/函数名/注释/三引号', () => {
  const lines = exportsObj.tokenizeCode('def foo(a):\n    return a  # sum\n    """doc"""', 'python')
  assert.ok(findToken(lines[0], 'keyword', 'def'), 'def keyword')
  assert.ok(findToken(lines[0], 'function', 'foo'), 'python function name')
  assert.ok(findToken(lines[1], 'keyword', 'return'), 'return keyword')
  assert.ok(findToken(lines[1], 'comment', '# sum'), 'python line comment')
  assert.ok(findToken(lines[2], 'string', '"""doc"""'), 'triple-quote string')
})

test('JSON：键值字符串与数字', () => {
  const lines = exportsObj.tokenizeCode('{"name": "x", "n": 3}', 'json')
  assert.ok(findToken(lines[0], 'string', '"name"'), 'json key string')
  assert.ok(findToken(lines[0], 'string', '"x"'), 'json value string')
  assert.ok(findToken(lines[0], 'number', '3'), 'json number')
})

test('Bash：关键字 / 字符串 / 注释', () => {
  const lines = exportsObj.tokenizeCode('echo "hello" # say', 'bash')
  assert.ok(findToken(lines[0], 'keyword', 'echo'), 'bash echo keyword')
  assert.ok(findToken(lines[0], 'string', '"hello"'), 'bash string')
  assert.ok(findToken(lines[0], 'comment', '# say'), 'bash comment')
})

test('YAML：注释', () => {
  const lines = exportsObj.tokenizeCode('key: value\n# comment', 'yaml')
  assert.ok(findToken(lines[1], 'comment', '# comment'), 'yaml comment')
})

test('Markdown：标题关键字与行内代码字符串', () => {
  const lines = exportsObj.tokenizeCode('## Title\n`code`', 'markdown')
  assert.ok(findToken(lines[0], 'keyword', '##'), 'markdown heading keyword')
  assert.ok(findToken(lines[1], 'string', '`code`'), 'markdown inline code string')
})

test('未知语言回退纯文本', () => {
  const lines = exportsObj.tokenizeCode('flowchart TD\n  A --> B', 'mermaid')
  assert.equal(lines.length, 2, 'keeps line count')
  assert.ok(
    lines.every((l) => l.every((t) => t.type === 'plain')),
    'unknown language → plain tokens only',
  )
})

test('langLabel：别名与未知回退', () => {
  assert.equal(exportsObj.langLabel('js'), 'javascript', 'js alias → javascript')
  assert.equal(exportsObj.langLabel('py'), 'python', 'py alias → python')
  assert.equal(exportsObj.langLabel('sh'), 'bash', 'sh alias → bash')
  assert.equal(exportsObj.langLabel('mermaid'), 'mermaid', 'unknown → raw name')
  assert.equal(exportsObj.langLabel(''), 'text', 'empty → text')
})
