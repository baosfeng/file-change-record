import { test } from 'vitest'
/**
 * Table-interaction unit tests for dsh-md-render (issue #83).
 *
 * Loads the BUILT bundle lib/client.js (parts spliced by scripts/build.mjs)
 * against a stubbed react, then exercises the exported pure functions
 * (compareCells / sortRows / foldRows) directly:
 *  - compareCells: numeric cells compared numerically, text cells by
 *    localeCompare, mixed/empty cells fall back to text comparison;
 *  - sortRows: ascending/descending by column, returns a NEW array
 *    (original rows untouched — sort is view-layer only);
 *  - foldRows: rows beyond the limit are folded (visible prefix + hidden
 *    count), rows within the limit are not folded.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'

// ── stubbed react (self-contained: no react install needed) ───────────────
const stubbed = {
  createElement: (type, props, ...children) => ({
    type,
    props: { ...(props || {}), children: children.flat() },
  }),
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

const { compareCells, sortRows, foldRows } = exportsObj

// ── compareCells ───────────────────────────────────────────────────────────
test('compareCells 数值单元格按数值比较', () => {
  assert.ok(compareCells('10', '2') > 0, '10 > 2 numerically')
  assert.ok(compareCells('2', '10') < 0, '2 < 10 numerically')
  assert.equal(compareCells('5', '5'), 0, 'equal numbers')
  assert.ok(compareCells('1.5', '1.25') > 0, 'decimal numbers compared numerically')
})

test('compareCells 文本单元格按 localeCompare 比较', () => {
  assert.ok(compareCells('apple', 'banana') < 0, 'apple < banana')
  assert.ok(compareCells('banana', 'apple') > 0, 'banana > apple')
  assert.equal(compareCells('same', 'same'), 0, 'equal text')
})

test('compareCells 混合/空单元格回退文本比较', () => {
  // 一个数值一个文本 → 文本比较（与 localeCompare 一致）
  assert.equal(compareCells('10', 'abc'), '10'.localeCompare('abc'), 'mixed falls back to text')
  // 空单元格 → 文本比较
  assert.equal(compareCells('', 'abc'), ''.localeCompare('abc'), 'empty falls back to text')
  assert.equal(compareCells('abc', ''), 'abc'.localeCompare(''), 'empty falls back to text')
})

// ── sortRows ───────────────────────────────────────────────────────────────
test('sortRows 数值列升序（且不修改原数组）', () => {
  const rows = [
    ['b', '2'],
    ['a', '10'],
    ['c', '1'],
  ]
  const sorted = sortRows(rows, 1, 'asc')
  assert.deepEqual(
    sorted,
    [
      ['c', '1'],
      ['b', '2'],
      ['a', '10'],
    ],
    'ascending by numeric column',
  )
  assert.deepEqual(
    rows,
    [
      ['b', '2'],
      ['a', '10'],
      ['c', '1'],
    ],
    'original rows untouched (view-layer only)',
  )
})

test('sortRows 文本列降序', () => {
  const rows = [['b'], ['a'], ['c']]
  const sorted = sortRows(rows, 0, 'desc')
  assert.deepEqual(sorted, [['c'], ['b'], ['a']], 'descending by text column')
})

test('sortRows 数值列降序', () => {
  const rows = [
    ['x', '3'],
    ['y', '1'],
    ['z', '2'],
  ]
  const sorted = sortRows(rows, 1, 'desc')
  assert.deepEqual(
    sorted,
    [
      ['x', '3'],
      ['z', '2'],
      ['y', '1'],
    ],
    'descending by numeric column',
  )
})

test('sortRows 文本列升序（localeCompare 语义）', () => {
  const rows = [['banana'], ['apple'], ['cherry']]
  const sorted = sortRows(rows, 0, 'asc')
  assert.deepEqual(sorted, [['apple'], ['banana'], ['cherry']], 'ascending by text column')
})

// ── foldRows ───────────────────────────────────────────────────────────────
test('foldRows 行数不超过限制时不折叠', () => {
  const rows = [['1'], ['2']]
  const r = foldRows(rows, 20)
  assert.equal(r.hidden, 0, 'no hidden rows')
  assert.equal(r.visible.length, 2, 'all rows visible')
  assert.equal(r.visible, rows, 'same array reference when not folded')
})

test('foldRows 行数超过限制时折叠为前 N 行', () => {
  const rows = Array.from({ length: 25 }, (_, i) => [String(i)])
  const r = foldRows(rows, 20)
  assert.equal(r.hidden, 5, '5 hidden rows')
  assert.equal(r.visible.length, 20, '20 visible rows')
  assert.equal(r.visible[0][0], '0', 'first visible row is the first row')
  assert.equal(r.visible[19][0], '19', 'last visible row is the 20th row')
})

test('foldRows 边界：行数恰好等于限制时不折叠', () => {
  const rows = Array.from({ length: 20 }, (_, i) => [String(i)])
  const r = foldRows(rows, 20)
  assert.equal(r.hidden, 0, 'exactly at limit: no folding')
  assert.equal(r.visible.length, 20, 'all rows visible')
})
