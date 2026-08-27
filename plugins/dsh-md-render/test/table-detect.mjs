import { test } from 'vitest'
/**
 * Table-detection unit tests for dsh-md-render.
 *
 * Loads the BUILT bundle lib/client.js (parts spliced by scripts/build.mjs)
 * against a stubbed react, then exercises the exported pure detection
 * functions (parseTable / isTableLine / isSeparatorLine / splitRow /
 * parseAlign) directly:
 *  - standard GFM tables (leading/trailing pipes),
 *  - non-standard tables WITHOUT leading/trailing pipes,
 *  - separator-line variants (--- | ---, -|-|-, ---),
 *  - alignment markers (:--- left, :---: center, ---: right),
 *  - non-table text / single-column / missing separator / empty input,
 *  - prefix/suffix text around the table inside one paragraph.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'

// ── stubbed react (self-contained: no react install needed) ───────────────
const stubbed = {
  createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children: children.flat() } }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useSyncExternalStore: (_s, get) => get(),
}

// ── load bundle ────────────────────────────────────────────────────────────
let registered = null
global.window = {
  __ModuleLoader__: { load: (registration) => { registered = registration } },
  location: { href: 'http://127.0.0.1:3080/app', search: '' },
}
global.document = undefined
global.Element = function Element() {}
global.MutationObserver = class { constructor() {} observe() {} disconnect() {} }

eval(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
assert.ok(registered, 'bundle registered')
const exportsObj = registered.factory((spec) => {
  if (spec === 'react') return stubbed
  throw new Error('unexpected require: ' + spec)
})

const { parseTable, isTableLine, isSeparatorLine, splitRow, parseAlign } = exportsObj

// ── detection unit tests ───────────────────────────────────────────────────
test('标准 GFM 表格（首尾管道符）解析成功', () => {
  const t = parseTable('| 插件 | 版本 |\n| --- | --- |\n| dsh-file-activity | 0.4.2 |\n| dsh-think-zh-expand | 0.4.2 |')
  assert.ok(t, 'standard GFM table parsed')
  assert.deepEqual(t.header, ['插件', '版本'], 'header cells')
  assert.deepEqual(t.rows, [['dsh-file-activity', '0.4.2'], ['dsh-think-zh-expand', '0.4.2']], 'data rows')
  assert.deepEqual(t.aligns, ['left', 'left'], 'default alignment is left')
})

test('无首尾管道符的表格也能识别', () => {
  const t = parseTable('插件 | 版本\n--- | ---\ndsh-file-activity | 0.4.2')
  assert.ok(t, 'table without leading/trailing pipes parsed')
  assert.deepEqual(t.header, ['插件', '版本'], 'header cells')
  assert.deepEqual(t.rows, [['dsh-file-activity', '0.4.2']], 'data rows')
})

test('分隔行变体：--- | ---（带空格管道符）', () => {
  const t = parseTable('a | b\n--- | ---\n1 | 2')
  assert.ok(t, 'separator variant "--- | ---" parsed')
  assert.deepEqual(t.header, ['a', 'b'], 'header cells')
})

test('分隔行变体：-|-|-（无空格）', () => {
  const t = parseTable('a | b\n-|-|-\n1 | 2')
  assert.ok(t, 'separator variant "-|-|-" parsed')
  assert.deepEqual(t.header, ['a', 'b'], 'header cells')
})

test('分隔行变体：---（无管道符）', () => {
  const t = parseTable('a | b\n---\n1 | 2')
  assert.ok(t, 'separator variant "---" parsed')
  assert.deepEqual(t.header, ['a', 'b'], 'header cells')
})

test('对齐标记：:--- 左对齐、:---: 居中、---: 右对齐', () => {
  const t = parseTable('| a | b | c |\n|:---|:---:|---:|\n| 1 | 2 | 3 |')
  assert.ok(t, 'alignment table parsed')
  assert.deepEqual(t.aligns, ['left', 'center', 'right'], 'alignment markers')
})

test('对齐标记：无冒号默认左对齐', () => {
  const t = parseTable('a | b\n--- | ---\n1 | 2')
  assert.deepEqual(t.aligns, ['left', 'left'], 'no colon defaults to left')
})

test('非表格文本（无管道符）返回 null', () => {
  assert.equal(parseTable('这是一段普通文本'), null, 'plain text is not a table')
  assert.equal(parseTable('插件 版本\n--- ---\n1 2'), null, 'no pipes at all')
})

test('单列（| a |）返回 null', () => {
  assert.equal(parseTable('| a |\n| --- |'), null, 'single column is not a table')
  assert.equal(parseTable('a |\n--- |'), null, 'trailing pipe only is single column')
})

test('无分隔行返回 null', () => {
  assert.equal(parseTable('a | b\n1 | 2'), null, 'missing separator line')
  assert.equal(parseTable('| a | b |\n| 1 | 2 |'), null, 'no separator between rows')
})

test('空文本 / 单行返回 null', () => {
  assert.equal(parseTable(''), null, 'empty text')
  assert.equal(parseTable('a | b'), null, 'single line')
})

test('表格前有文本时解析成功且 prefix 保留', () => {
  const t = parseTable('以下是插件列表：\n插件 | 版本\n--- | ---\ndsh-file-activity | 0.4.2')
  assert.ok(t, 'table after leading text parsed')
  assert.equal(t.prefix, '以下是插件列表：', 'prefix text preserved')
  assert.deepEqual(t.header, ['插件', '版本'], 'header cells')
})

test('表格后跟文本时解析成功且 suffix 保留', () => {
  const t = parseTable('插件 | 版本\n--- | ---\ndsh-file-activity | 0.4.2\n以上是插件列表')
  assert.ok(t, 'table followed by text parsed')
  assert.equal(t.suffix, '以上是插件列表', 'suffix text preserved')
  assert.deepEqual(t.rows, [['dsh-file-activity', '0.4.2']], 'data rows stop at non-table line')
})

test('数据行含行内 markdown 时单元格文本保留', () => {
  const t = parseTable('插件 | 版本\n--- | ---\ndsh-file-activity | **0.4.2**')
  assert.ok(t, 'table with inline markdown parsed')
  assert.deepEqual(t.rows, [['dsh-file-activity', '**0.4.2**']], 'cell text kept verbatim')
})

test('只有表头与分隔行（无数据行）解析成功', () => {
  const t = parseTable('a | b\n--- | ---')
  assert.ok(t, 'header-only table parsed')
  assert.deepEqual(t.rows, [], 'no data rows')
})

test('isTableLine / isSeparatorLine / splitRow / parseAlign 基础行为', () => {
  assert.equal(isTableLine('a | b'), true, 'pipe line is a table line')
  assert.equal(isTableLine('| a | b |'), true, 'piped line is a table line')
  assert.equal(isTableLine('--- | ---'), false, 'separator is not a table line')
  assert.equal(isTableLine('plain text'), false, 'plain text is not a table line')
  assert.equal(isSeparatorLine('--- | ---'), true, 'separator variant')
  assert.equal(isSeparatorLine('-|-|-'), true, 'separator variant no spaces')
  assert.equal(isSeparatorLine('---'), true, 'bare separator')
  assert.equal(isSeparatorLine('a | b'), false, 'data line is not a separator')
  assert.deepEqual(splitRow('| a | b |'), ['a', 'b'], 'splitRow strips outer pipes')
  assert.deepEqual(splitRow('a | b'), ['a', 'b'], 'splitRow without outer pipes')
  assert.equal(parseAlign(':---'), 'left', 'left align')
  assert.equal(parseAlign(':---:'), 'center', 'center align')
  assert.equal(parseAlign('---:'), 'right', 'right align')
  assert.equal(parseAlign('---'), 'left', 'default left')
})

test('思考模式回归：标准表格（reasoning 块同款输入）解析不受影响', () => {
  // 与 dsh-think-zh-expand client-render.mjs 的表格用例同款输入
  const t = parseTable('| 插件 | 版本 |\n|:-----|:----:|\n| dsh-file-activity | **0.4.2** |\n| dsh-think-zh-expand | `0.2.0` |')
  assert.ok(t, 'standard table parsed')
  assert.deepEqual(t.aligns, ['left', 'center'], 'alignment from separator row')
  assert.equal(t.rows.length, 2, 'two data rows')
})
