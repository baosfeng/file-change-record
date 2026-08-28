// ── DOM 表格渲染：div.dsh-md-render-table-scroll > table.dsh-md-render-table ──
// 表头 thead / 数据 tbody / 每列对齐 style；prefix/suffix 文本保留
// 为段落；外层滚动容器提供宽表格横向滚动，容器下方带滚动提示条
// （chevronRight 图标 + 文案，issue #54 阶段 1 视觉统一）。返回
// DocumentFragment。

/** 构建 thead（表头行 + 每列对齐）。 */
function renderHead(table) {
  const thead = document.createElement('thead')
  const headTr = document.createElement('tr')
  table.header.forEach((cell, j) => {
    const th = document.createElement('th')
    th.style.textAlign = table.aligns[j] || 'left'
    th.appendChild(renderInline(cell))
    headTr.appendChild(th)
  })
  thead.appendChild(headTr)
  return thead
}

/** 构建 tbody（数据行 + 每列对齐）。 */
function renderBody(table) {
  const tbody = document.createElement('tbody')
  table.rows.forEach((row) => {
    const tr = document.createElement('tr')
    row.forEach((cell, j) => {
      const td = document.createElement('td')
      td.style.textAlign = table.aligns[j] || 'left'
      td.appendChild(renderInline(cell))
      tr.appendChild(td)
    })
    tbody.appendChild(tr)
  })
  return tbody
}

/** 共享图标风格的 chevronRight（DOM 侧手写 SVG，stroke=currentColor，
 *  与 dsh-shared/client-parts/icons.part.js 的线性图标风格一致）。 */
function chevronIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.8')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
  polyline.setAttribute('points', '9 6 15 12 9 18')
  svg.appendChild(polyline)
  return svg
}

/** 滚动提示条：指示宽表格可横向滚动（弱化样式，见 styles.part.js）。 */
function renderScrollHint() {
  const hint = document.createElement('div')
  hint.className = 'dsh-md-render-scroll-hint'
  hint.appendChild(chevronIcon())
  hint.appendChild(document.createTextNode('横向滚动'))
  return hint
}

/** 渲染完整表格（含 prefix/suffix 段落、滚动容器与滚动提示条）。 */
function renderTable(table) {
  const frag = document.createDocumentFragment()
  if (table.prefix) {
    const p = document.createElement('p')
    p.className = 'dsh-md-render-prefix'
    p.textContent = table.prefix
    frag.appendChild(p)
  }
  const scroll = document.createElement('div')
  scroll.className = 'dsh-md-render-table-scroll'
  const tbl = document.createElement('table')
  tbl.className = 'dsh-md-render-table'
  tbl.appendChild(renderHead(table))
  if (table.rows.length > 0) tbl.appendChild(renderBody(table))
  scroll.appendChild(tbl)
  frag.appendChild(scroll)
  frag.appendChild(renderScrollHint())
  if (table.suffix) {
    const p = document.createElement('p')
    p.className = 'dsh-md-render-suffix'
    p.textContent = table.suffix
    frag.appendChild(p)
  }
  return frag
}
