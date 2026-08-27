    // ── DOM 表格渲染：div.dmr-table-scroll > table.dmr-table ────────
    // 表头 thead / 数据 tbody / 每列对齐 style；prefix/suffix 文本保留
    // 为段落；外层滚动容器提供宽表格横向滚动。返回 DocumentFragment。

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

    /** 渲染完整表格（含 prefix/suffix 段落与滚动容器）。 */
    function renderTable(table) {
      const frag = document.createDocumentFragment()
      if (table.prefix) {
        const p = document.createElement('p')
        p.className = 'dmr-prefix'
        p.textContent = table.prefix
        frag.appendChild(p)
      }
      const scroll = document.createElement('div')
      scroll.className = 'dmr-table-scroll'
      const tbl = document.createElement('table')
      tbl.className = 'dmr-table'
      tbl.appendChild(renderHead(table))
      if (table.rows.length > 0) tbl.appendChild(renderBody(table))
      scroll.appendChild(tbl)
      frag.appendChild(scroll)
      if (table.suffix) {
        const p = document.createElement('p')
        p.className = 'dmr-suffix'
        p.textContent = table.suffix
        frag.appendChild(p)
      }
      return frag
    }
