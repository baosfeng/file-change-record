import { test } from 'vitest'
/**
 * Table-interaction RENDER tests for dsh-md-render (issue #83).
 *
 * Loads the BUILT bundle lib/client.js (parts spliced by scripts/build.mjs)
 * against stubbed react + a fake DOM WITH event support
 * (addEventListener / dispatchEvent bubbling / classList), then exercises
 * renderTable() output and the click delegation bound on the scroll
 * container:
 *  - long tables (> 20 rows) render folded: rows beyond the limit carry the
 *    dsh-md-render-folded-row class, a 「展开全部 N 行」 button is rendered;
 *  - short tables render without a fold button;
 *  - clicking the fold button expands (all rows visible, button text 收起)
 *    and collapses again;
 *  - clicking a header th sorts the tbody rows (numeric column numerically,
 *    text column by localeCompare), toggling asc → desc on repeat clicks,
 *    and the sort arrow (↑/↓) follows the active column;
 *  - sorting while folded still orders the hidden rows (expand shows the
 *    fully sorted table).
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

// ── fake DOM with event support ───────────────────────────────────────────
function makeElement(tag, attrs = {}) {
  const el = {
    tagName: String(tag).toUpperCase(),
    nodeType: tag === 'fragment' ? 11 : 1,
    children: [],
    _text: '',
    className: attrs.className || '',
    style: {},
    dataset: {},
    parentNode: null,
    _listeners: {},
    addEventListener(type, fn) {
      ;(this._listeners[type] ||= []).push(fn)
    },
    removeEventListener(type, fn) {
      const arr = this._listeners[type] || []
      const i = arr.indexOf(fn)
      if (i >= 0) arr.splice(i, 1)
    },
    dispatchEvent(ev) {
      ev.target = ev.target || this
      let node = ev.target
      while (node) {
        for (const fn of node._listeners[ev.type] || []) fn.call(node, ev)
        node = node.parentNode
      }
      return true
    },
    appendChild(child) {
      // 真实 DOM 语义：已存在的子节点先移除再追加（移动）
      const i = this.children.indexOf(child)
      if (i >= 0) this.children.splice(i, 1)
      this.children.push(child)
      child.parentNode = this
      return child
    },
    removeChild(child) {
      const i = this.children.indexOf(child)
      if (i >= 0) this.children.splice(i, 1)
      child.parentNode = null
    },
    replaceWith(...nodes) {
      const parent = this.parentNode
      if (!parent) return
      const i = parent.children.indexOf(this)
      if (i < 0) return
      const flat = []
      for (const n of nodes) {
        if (n && n.nodeType === 11) flat.push(...n.children)
        else flat.push(n)
      }
      parent.children.splice(i, 1, ...flat)
      this.parentNode = null
      flat.forEach((n) => {
        n.parentNode = parent
      })
    },
    setAttribute(k, v) {
      this[k] = v
    },
    getAttribute(k) {
      return this[k]
    },
    removeAttribute(k) {
      delete this[k]
    },
    querySelector(sel) {
      const walk = (els) => {
        for (const e of els) {
          if (e.matchesSel && e.matchesSel(sel)) return e
          const found = walk(e.children || [])
          if (found) return found
        }
        return null
      }
      return walk(this.children)
    },
    querySelectorAll(sel) {
      const out = []
      const walk = (els) => {
        for (const e of els) {
          if (e.matchesSel && e.matchesSel(sel)) out.push(e)
          walk(e.children || [])
        }
      }
      walk(this.children)
      return out
    },
    matchesSel(sel) {
      const hasClass = (c) => this.className.split(/\s+/).includes(c)
      if (sel === 'table.dsh-md-render-table') return this.tagName === 'TABLE' && hasClass('dsh-md-render-table')
      if (sel === '.dsh-md-render-table-scroll') return this.tagName === 'DIV' && hasClass('dsh-md-render-table-scroll')
      if (sel === '.dsh-md-render-table-fold') return this.tagName === 'BUTTON' && hasClass('dsh-md-render-table-fold')
      if (sel === '.dsh-md-render-sort-arrow') return this.tagName === 'SPAN' && hasClass('dsh-md-render-sort-arrow')
      if (sel === 'th[data-sort-col]') return this.tagName === 'TH' && this['data-sort-col'] !== undefined
      if (/^[a-z]+$/.test(sel)) return this.tagName === sel.toUpperCase()
      return false
    },
    closest(sel) {
      let node = this
      while (node) {
        if (node.matchesSel && node.matchesSel(sel)) return node
        node = node.parentNode
      }
      return null
    },
  }
  Object.defineProperty(el, 'classList', {
    get() {
      return {
        add: (c) => {
          const s = new Set(el.className.split(/\s+/).filter(Boolean))
          s.add(c)
          el.className = [...s].join(' ')
        },
        remove: (c) => {
          const s = new Set(el.className.split(/\s+/).filter(Boolean))
          s.delete(c)
          el.className = [...s].join(' ')
        },
        contains: (c) => el.className.split(/\s+/).includes(c),
      }
    },
  })
  Object.defineProperty(el, 'textContent', {
    get() {
      if (this.children.length === 0) return this._text
      return this.children.map((c) => c.textContent).join('')
    },
    set(v) {
      this._text = v
      this.children = []
    },
  })
  return el
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
global.document = {
  createElement(tag) {
    return makeElement(tag)
  },
  createElementNS(_ns, tag) {
    return makeElement(tag)
  },
  createTextNode(text) {
    return { nodeType: 3, textContent: text }
  },
  createDocumentFragment() {
    return makeElement('fragment')
  },
}
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
const { renderTable } = exportsObj

/** 渲染表格并返回 { scroll, tbl, tbody, trs, ths, btn }。 */
function renderFixture(table) {
  const frag = renderTable(table)
  const scroll = frag.children[0]
  const tbl = scroll.querySelector('table.dsh-md-render-table')
  const tbody = tbl.querySelector('tbody')
  return {
    scroll,
    tbl,
    tbody,
    trs: tbody.querySelectorAll('tr'),
    ths: tbl.querySelectorAll('th'),
    btn: scroll.querySelector('.dsh-md-render-table-fold'),
  }
}

/** 构造 25 行表格：第 2 列数值为 1..25 的乱序排列（i*7 mod 25 + 1）。 */
function longTable() {
  const rows = []
  for (let i = 0; i < 25; i += 1) rows.push([`行${i}`, String(((i * 7) % 25) + 1)])
  return { header: ['名称', '数值'], aligns: ['left', 'right'], rows, prefix: '', suffix: '' }
}

// ── 折叠渲染 ──────────────────────────────────────────────────────────────
test('长表格（>20 行）默认折叠：前 20 行可见，其余带折叠 class', () => {
  const { trs, btn } = renderFixture(longTable())
  assert.equal(trs.length, 25, 'all rows in DOM')
  for (let i = 0; i < 20; i += 1) {
    assert.ok(!trs[i].classList.contains('dsh-md-render-folded-row'), `row ${i} visible`)
  }
  for (let i = 20; i < 25; i += 1) {
    assert.ok(trs[i].classList.contains('dsh-md-render-folded-row'), `row ${i} folded`)
  }
  assert.ok(btn, 'fold button rendered')
  assert.equal(btn.textContent, '展开全部 25 行', 'fold button label')
})

test('短表格（≤20 行）不渲染折叠按钮、无折叠行', () => {
  const table = { header: ['名称'], aligns: ['left'], rows: [['a'], ['b'], ['c']], prefix: '', suffix: '' }
  const { trs, btn } = renderFixture(table)
  assert.equal(trs.length, 3, 'all rows rendered')
  for (const tr of trs) assert.ok(!tr.classList.contains('dsh-md-render-folded-row'), 'no folded rows')
  assert.equal(btn, null, 'no fold button for short table')
})

test('表头 th 带排序列标记与箭头 span', () => {
  const { ths } = renderFixture(longTable())
  assert.equal(ths.length, 2, '2 header cells')
  assert.equal(ths[0].getAttribute('data-sort-col'), '0', 'col 0 marker')
  assert.equal(ths[1].getAttribute('data-sort-col'), '1', 'col 1 marker')
  for (const th of ths) {
    const arrow = th.querySelector('.dsh-md-render-sort-arrow')
    assert.ok(arrow, 'sort arrow span present')
    assert.equal(arrow.textContent, '', 'arrow empty before any sort')
  }
})

// ── 折叠交互 ──────────────────────────────────────────────────────────────
test('点击折叠按钮展开全部行，再点收起', () => {
  const { trs, btn } = renderFixture(longTable())
  btn.dispatchEvent({ type: 'click', target: btn })
  assert.equal(btn.textContent, '收起', 'button label after expand')
  for (const tr of trs) assert.ok(!tr.classList.contains('dsh-md-render-folded-row'), 'all rows visible after expand')
  btn.dispatchEvent({ type: 'click', target: btn })
  assert.equal(btn.textContent, '展开全部 25 行', 'button label after collapse')
  for (let i = 20; i < 25; i += 1) {
    assert.ok(trs[i].classList.contains('dsh-md-render-folded-row'), `row ${i} folded again`)
  }
})

// ── 排序交互 ───────────────────────────────────────────────────────────────
test('点击表头数值列升序，再点切换降序，箭头跟随', () => {
  const { tbody, ths } = renderFixture(longTable())
  const colText = (tr) => tr.querySelectorAll('td')[1].textContent
  ths[1].dispatchEvent({ type: 'click', target: ths[1] })
  let trs = tbody.querySelectorAll('tr')
  assert.equal(colText(trs[0]), '1', 'ascending: smallest first')
  assert.equal(colText(trs[24]), '25', 'ascending: largest last')
  assert.equal(ths[1].querySelector('.dsh-md-render-sort-arrow').textContent, '↑', 'asc arrow')
  assert.equal(ths[0].querySelector('.dsh-md-render-sort-arrow').textContent, '', 'other column arrow cleared')
  ths[1].dispatchEvent({ type: 'click', target: ths[1] })
  trs = tbody.querySelectorAll('tr')
  assert.equal(colText(trs[0]), '25', 'descending: largest first')
  assert.equal(colText(trs[24]), '1', 'descending: smallest last')
  assert.equal(ths[1].querySelector('.dsh-md-render-sort-arrow').textContent, '↓', 'desc arrow')
})

test('点击表头文本列按 localeCompare 排序', () => {
  const table = {
    header: ['名称'],
    aligns: ['left'],
    rows: [['banana'], ['apple'], ['cherry']],
    prefix: '',
    suffix: '',
  }
  const { tbody, ths } = renderFixture(table)
  ths[0].dispatchEvent({ type: 'click', target: ths[0] })
  let texts = tbody.querySelectorAll('tr').map((tr) => tr.querySelector('td').textContent)
  assert.deepEqual(texts, ['apple', 'banana', 'cherry'], 'ascending by localeCompare')
  ths[0].dispatchEvent({ type: 'click', target: ths[0] })
  texts = tbody.querySelectorAll('tr').map((tr) => tr.querySelector('td').textContent)
  assert.deepEqual(texts, ['cherry', 'banana', 'apple'], 'descending by localeCompare')
})

test('折叠状态下排序，展开后全部行按排序顺序', () => {
  const { tbody, ths, btn } = renderFixture(longTable())
  // 折叠状态（默认）下点击数值列表头排序
  ths[1].dispatchEvent({ type: 'click', target: ths[1] })
  let trs = tbody.querySelectorAll('tr')
  assert.equal(trs[0].querySelectorAll('td')[1].textContent, '1', 'visible rows sorted while folded')
  // 展开：全部 25 行按数值升序
  btn.dispatchEvent({ type: 'click', target: btn })
  trs = tbody.querySelectorAll('tr')
  const values = trs.map((tr) => Number(tr.querySelectorAll('td')[1].textContent))
  assert.deepEqual(
    values,
    Array.from({ length: 25 }, (_, i) => i + 1),
    'all rows sorted after expand',
  )
})

test('排序只影响当前表格 DOM（其他表格不受影响）', () => {
  const a = renderFixture(longTable())
  const b = renderFixture(longTable())
  a.ths[1].dispatchEvent({ type: 'click', target: a.ths[1] })
  const aTrs = a.tbody.querySelectorAll('tr')
  assert.equal(aTrs[0].querySelectorAll('td')[1].textContent, '1', 'table A sorted')
  assert.equal(b.trs[0].querySelectorAll('td')[1].textContent, '1', 'table B first row unchanged (original order)')
  assert.equal(b.trs[1].querySelectorAll('td')[1].textContent, '8', 'table B second row unchanged (original order)')
  assert.equal(a.scroll.dataset.sortCol, '1', 'sort state stored on table A scroll container')
  assert.equal(b.scroll.dataset.sortCol, undefined, 'table B has no sort state')
})

console.log('ALL TABLE-INTERACTION RENDER TESTS PASSED')
