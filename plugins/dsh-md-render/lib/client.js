/**
 * dsh-md-render — client half (browser).
 *
 * 非思考模式（模型只输出 text 块）下，dsh-think-zh-expand 替换内置
 * assistant-step 渲染器后，text 块走轻量 MarkdownView（`div.tzx-md`
 * 容器）。其 tryTable 检测严格（表头行必须首尾都有 `|`、分隔行必须含
 * `-`），模型输出的不标准表格（无首尾管道符、分隔行变体）检测失败后
 * 回退为纯文本段落（`p.tzx-p`），表格以原始 markdown 语法展示。
 *
 * 本插件在 DOM 层做渲染增强：
 *  - 扫描 `[data-conversation-scroll]` 内的 `div.tzx-md`（think-zh-expand
 *    的 MarkdownView 输出）与 `div.md-table-wide`（内置 MarkdownText 的
 *    宽表格容器）容器；
 *  - 对容器内以纯文本段落形式存在的表格（`p.tzx-p`），用增强检测规则
 *    （支持无首尾管道符、分隔行变体、对齐标记）识别并解析；
 *  - 将段落替换为 `<table>`（表头 thead / 数据 tbody / 对齐 style），
 *    外层 `div.dmr-table-scroll` 提供宽表格横向滚动；
 *  - 已渲染的表格（`table.tzx-table` 等）跳过，不重复处理；
 *  - MutationObserver 跟随流式渲染，流式中的容器等内容稳定后再处理。
 *
 * 样式走 DSH 语义 token（--dsw-alias-* / --dsw-font-*），随 activation
 * 注入、fiber teardown 卸载（HMR/禁用无残留）。
 *
 * BUILD NOTE: 本文件是源码模板（骨架）。scripts/build.mjs 把
 * lib/parts/*.part.js 片段注入到下方 /*__PART_*__* / 占位符处并写出
 * lib/client.js（DSH 实际提供的产物，单一 __ModuleLoader__ bundle，无相对
 * 路径 require）。产物必须提交（CI 只跑 node --check + 测试，不跑构建）；
 * 片段为纯函数声明文本（无 import/export），注入后处于本 factory 作用域。
 */
window.__ModuleLoader__.load({
  id: 'dsh-md-render',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    // ── 表格检测与解析（纯函数，导出供单测）──────────────────────
        // ── 表格检测与解析（纯函数，导出供单测）──────────────────────
    // 增强检测规则（相对 dsh-think-zh-expand 的 tryTable）：
    //  - 表头/数据行：含 `|` 且至少 2 列即可，允许无首尾管道符；
    //  - 分隔行：只含 `-` `:` `|` 与空白的变体（--- | ---、-|-|-、---）；
    //  - 对齐标记：`:---` 左、`:---:` 中、`---:` 右，无冒号默认左；
    //  - 表格可出现在段落中间（prefix/suffix 文本保留）。

    /** 分隔行：只含 - : | 与空白，且至少含一个 -。 */
    function isSeparatorLine(line) {
      if (typeof line !== 'string') return false
      if (!/^\s*\|?[\s:\-|]+\|?\s*$/.test(line)) return false
      return line.includes('-')
    }

    /** 按 | 分割一行（去首尾管道符，逐格 trim）。 */
    function splitRow(line) {
      return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
    }

    /** 表格行：含 |、至少 2 列、且不是分隔行。 */
    function isTableLine(line) {
      if (typeof line !== 'string') return false
      if (isSeparatorLine(line)) return false
      const t = line.trim()
      if (!t.includes('|')) return false
      return splitRow(t).length >= 2
    }

    /** 对齐标记解析：:--- 左、:---: 中、---: 右、其余左。 */
    function parseAlign(cell) {
      if (cell.startsWith(':') && cell.endsWith(':')) return 'center'
      if (cell.endsWith(':')) return 'right'
      return 'left'
    }

    /**
     * 解析表格文本 → { header, aligns, rows, prefix, suffix } 或 null。
     * 在段落内查找「表格行 + 分隔行」组合；prefix/suffix 为表格前后的
     * 非表格文本（渲染时保留）。
     */
    function parseTable(text) {
      const lines = String(text).split('\n')
      for (let start = 0; start < lines.length - 1; start += 1) {
        if (!isTableLine(lines[start])) continue
        if (!isSeparatorLine(lines[start + 1])) continue
        const header = splitRow(lines[start])
        const aligns = splitRow(lines[start + 1]).map(parseAlign)
        const rows = []
        let end = start + 2
        while (end < lines.length) {
          const line = lines[end]
          if (line.trim() === '') break
          if (!isTableLine(line)) break
          rows.push(splitRow(line))
          end += 1
        }
        return {
          header,
          aligns,
          rows,
          prefix: lines.slice(0, start).join('\n'),
          suffix: lines.slice(end).join('\n'),
        }
      }
      return null
    }

    exports.isSeparatorLine = isSeparatorLine
    exports.isTableLine = isTableLine
    exports.splitRow = splitRow
    exports.parseAlign = parseAlign
    exports.parseTable = parseTable


    // ── 行内渲染：单元格内的 code / strong / em / link ─────────────
        // ── 行内渲染：单元格内的 code / strong / em / link ─────────────
    // 与 dsh-think-zh-expand 的 mdInline 同规则（CommonMark 语义）：
    // N 个反引号开闭配对、**bold**、[link](url)、*em*。返回
    // DocumentFragment（无匹配时含单个文本节点）。
    function renderInline(text) {
      const frag = document.createDocumentFragment()
      const re = /(`+)([^`\n][^\n]*?)\1(?!`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\*[^*]+\*)/g
      let last = 0
      let m
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)))
        if (m[1] !== undefined) {
          const code = document.createElement('code')
          code.textContent = m[2]
          frag.appendChild(code)
        } else if (m[3] !== undefined) {
          const strong = document.createElement('strong')
          strong.textContent = m[3].slice(2, -2)
          frag.appendChild(strong)
        } else if (m[4] !== undefined) {
          const lm = m[4].match(/^\[([^\]]+)\]\(([^)]+)\)$/)
          if (lm) {
            const a = document.createElement('a')
            a.href = lm[2]
            a.target = '_blank'
            a.rel = 'noreferrer'
            a.textContent = lm[1]
            frag.appendChild(a)
          } else {
            frag.appendChild(document.createTextNode(m[4]))
          }
        } else {
          const em = document.createElement('em')
          em.textContent = m[5].slice(1, -1)
          frag.appendChild(em)
        }
        last = m.index + m[0].length
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
      return frag
    }


    // ── DOM 表格渲染：div.dmr-table-scroll > table.dmr-table ────────
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


    // ── 扫描器：MutationObserver 跟随流式渲染 ──────────────────────
        // ── 扫描器：MutationObserver 跟随流式渲染 ──────────────────────
    // 处理 tzx-md（think-zh-expand 的 MarkdownView 输出）与
    // md-table-wide（内置 MarkdownText 的宽表格容器）内的表格段落：
    //  - 流式中的容器（祖先带 [data-streaming]）跳过，等流式结束重扫；
    //  - 已渲染的表格（容器内已有 table）不重复处理；
    //  - 段落被替换为表格后记入 seen，避免重复处理。
    function scanContainer(seen, container) {
      if (container.closest && container.closest('[data-streaming]')) return
      const paragraphs = container.querySelectorAll('p.tzx-p')
      for (const p of paragraphs) {
        if (seen.has(p)) continue
        const table = parseTable(p.textContent)
        if (!table) continue
        const frag = renderTable(table)
        p.replaceWith(frag)
        seen.add(p)
      }
    }

    /** 扫描一个节点：自身是目标容器则处理，否则找其内部的目标容器。 */
    function scanNode(seen, node) {
      if (node && typeof node.matches === 'function' &&
          (node.matches('div.tzx-md') || node.matches('div.md-table-wide'))) {
        scanContainer(seen, node)
        return
      }
      if (node && typeof node.querySelectorAll === 'function') {
        for (const c of node.querySelectorAll('div.tzx-md, div.md-table-wide')) {
          scanContainer(seen, c)
        }
      }
    }

    /** 观察 body；返回观察器 disposer。 */
    function installScanner() {
      const seen = new Set()
      scanNode(seen, document.body)

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const added of mutation.addedNodes) {
            if (added.nodeType === 1) scanNode(seen, added)
          }
        }
        // 兜底重扫：流式结束后容器内容变化（新增段落 / 表格文本补全），
        // 对已知滚动容器重扫，保证流式中的表格最终被渲染。
        for (const sc of document.querySelectorAll('[data-conversation-scroll]')) {
          scanNode(seen, sc)
        }
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-streaming'] })
      return () => observer.disconnect()
    }


    // ── 样式（DSH 语义 token，随 activation 注入）──────────────────
        // ── 样式（DSH 语义 token，随 activation 注入）──────────────────
    // 表头/边框/对齐走 DSH token；滚动容器提供宽表格横向滚动
    // （overflow-x:auto，hover 时滚动条常显，避免遮挡内容）。
    const STYLES = `
.dmr-table-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;margin:0}
.dmr-table{border-collapse:collapse;width:max-content;max-width:max-content;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.dmr-table th,.dmr-table td{padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);max-width:min(30vw,320px);min-width:100px}
.dmr-table th{text-align:start;font-weight:600;border-bottom:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-table-head)}
.dmr-table td{font:var(--dsw-font-markdown-table)}
.dmr-table th:first-child,.dmr-table td:first-child{padding-left:0}
.dmr-table td:last-child{padding-right:0}
.dmr-table code{font-size:13px}
.dmr-prefix,.dmr-suffix{margin:0}
`


    // ── 插件入口：样式注入 + 扫描器装配 ───────────────────────────
        exports.inject = []

    exports.apply = function apply(ctx) {
      // Stylesheet first, unconditionally (see dsh-file-activity pitfall:
      // injecting styles behind a service early-return loses them on HMR).
      ctx.effect(() => {
        if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') return () => {}
        const style = document.createElement('style')
        style.setAttribute('data-dsh-md-render', 'styles')
        style.textContent = STYLES
        document.head.appendChild(style)
        return () => {
          if (style.parentNode) style.parentNode.removeChild(style)
        }
      }, 'dsh-md-render: styles')

      ctx.effect(() => installScanner(), 'dsh-md-render: scanner')
    }


    return module.exports
  },
})
