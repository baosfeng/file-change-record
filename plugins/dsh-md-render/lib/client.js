/**
 * dsh-md-render — client half (browser).
 *
 * 统一 Markdown 渲染插件（issue #31 渲染职责迁移）：
 *  - 提供统一 MarkdownView 组件（表格 / 公式 / 代码块容器），供
 *    dsh-think-zh-expand 的 assistant-step 渲染器调用（跨插件
 *    require，见其 package.json 的 dsh.client.external 声明）；
 *  - 代码块容器 `div.md-code-block` 由本插件产出（结构保持，
 *    dsh-mermaid-render 无需改动即可扫描）；
 *  - DOM 层表格增强：扫描 `[data-conversation-scroll]` 内的
 *    `div.tzx-md`（MarkdownView 输出）与 `div.md-table-wide`（内置
 *    MarkdownText 的宽表格容器）容器，对容器内以纯文本段落形式存在
 *    的表格（`p.tzx-p`），用增强检测规则（支持无首尾管道符、分隔行
 *    变体、对齐标记）识别并解析，将段落替换为 `<table>`（表头 thead /
 *    数据 tbody / 对齐 style），外层 `div.dmr-table-scroll` 提供宽表格
 *    横向滚动；已渲染的表格（`table.tzx-table` 等）跳过，不重复处理；
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
    // MarkdownView（markdown.part.js 片段）使用 createElement。
    const { createElement } = require('react')

    // ── 统一 MarkdownView：行内 + 块级渲染（导出供 think-zh-expand）──
        // ── 统一 MarkdownView：行内 + 块级渲染（issue #31 从
    //    dsh-think-zh-expand 迁移，行为等价 + 新增公式渲染）────────────
    // 由 scripts/build.mjs 拼入 lib/client.js 的 factory 作用域（纯函数
    // 声明文本，依赖 factory 内 createElement）；输出结构保持迁移前约定
    // （div.tzx-md / p.tzx-p / table.tzx-table / div.md-code-block）。

    // ── 轻量行内 Markdown：行内代码 / 粗体 / 斜体 / 链接 / 公式 ──────
    // 行内代码按 CommonMark 语义：N 个反引号开闭配对（\1 回声闭合串），
    // 内容允许含单个反引号（`` `agent/status` `` → <code>`agent/status`</code>）；
    // 闭合串后不能紧跟反引号（(?!`)。行内公式 $...$：内容非空且不以空白开头/结尾，开 $ 前与闭 $ 后不得是字母数字或 $（货币/变量/块级保护）。
    function trimCode(raw) {
      if (raw.length > 1 && raw[0] === ' ' && raw[raw.length - 1] === ' ' && raw.trim() !== '') {
        return raw.slice(1, -1)
      }
      return raw
    }

    /** 行内公式候选验证（货币/变量/块级保护），通过才渲染为公式。 */
    function isMathSpan(text, m) {
      const content = m[5].slice(1, -1)
      if (content === '' || content.trim() !== content) return false
      const before = text[m.index - 1]
      const after = text[m.index + m[0].length]
      if (before !== undefined && /[\w$]/.test(before)) return false
      if (after !== undefined && /[\w$]/.test(after)) return false
      return true
    }

    // 公式错误提示（issue #32）：异常公式 → 错误标记（原文保留 + 错误样式，
    // 参考内置 katex-error 语义）；货币/变量/块级 `$$` 保护不误报。
    const MATH_ERROR_TITLES = {
      malformed: '公式内容异常',
      unclosed: '未闭合的公式',
      multiline: '公式内容含换行',
      empty: '公式内容为空',
    }

    function isMathError(m) {
      const content = m[5].slice(1, -1)
      return content[0] === ' ' || content[0] === '\t'
    }

    function mathSkip(text, i) {
      const before = text[i - 1]
      const after = text[i + 1]
      if (before !== undefined && /[\w$]/.test(before)) return i + 1
      if (after === '$') return i + 2
      if (after !== undefined && /\d/.test(after)) return i + 1
      return i
    }

    /** 在正则未匹配区间 [start, end) 中扫描疑似公式的 `$`（未闭合/跨行 → 错误标记）。 */
    function scanMathErrors(text, start, end, key, k, out) {
      let i = start
      let segStart = start
      while (i < end) {
        if (text[i] !== '$') { i += 1; continue }
        const skip = mathSkip(text, i)
        if (skip !== i) { i = skip; continue }
        if (i > segStart) out.push(text.slice(segStart, i))
        let j = i + 1
        while (j < end && text[j] !== '$') j += 1
        if (j >= end) {
          out.push(createElement('span', { key: key + '-e' + k, className: 'dmr-math-error', title: MATH_ERROR_TITLES.unclosed }, text.slice(i, end)))
          return k + 1
        }
        out.push(createElement('span', { key: key + '-e' + k, className: 'dmr-math-error', title: MATH_ERROR_TITLES.multiline }, text.slice(i, j + 1)))
        k += 1
        i = j + 1
        segStart = i
      }
      if (end > segStart) out.push(text.slice(segStart, end))
      return k
    }

    function mdInline(text, key) {
      const out = []
      const re = /(`+)([^`\n][^\n]*?)\1(?!`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\$[^$\n]+?\$)|(\*[^*]+\*)/g
      let last = 0
      let m, k = 0
      while ((m = re.exec(text)) !== null) {
        k = scanMathErrors(text, last, m.index, key, k, out)
        const kk = key + '-i' + k
        if (m[1] !== undefined) {
          out.push(createElement('code', { key: kk }, trimCode(m[2])))
        } else if (m[3] !== undefined) {
          out.push(createElement('strong', { key: kk }, m[3].slice(2, -2)))
        } else if (m[4] !== undefined) {
          const lm = m[4].match(/^\[([^\]]+)\]\(([^)]+)\)$/)
          if (lm) {
            out.push(createElement('a', { key: kk, href: lm[2], target: '_blank', rel: 'noreferrer' }, lm[1]))
          } else {
            out.push(m[4])
          }
        } else if (m[5] !== undefined) {
          if (isMathSpan(text, m)) {
            out.push(createElement('span', { key: kk, className: 'dmr-math' }, m[5].slice(1, -1)))
          } else if (isMathError(m)) {
            out.push(createElement('span', { key: kk, className: 'dmr-math-error', title: MATH_ERROR_TITLES.malformed }, m[5]))
          } else {
            out.push(m[5])
          }
        } else {
          out.push(createElement('em', { key: kk }, m[6].slice(1, -1)))
        }
        k += 1
        last = m.index + m[0].length
      }
      scanMathErrors(text, last, text.length, key, k, out)
      return out
    }

    // ── 轻量块级 Markdown：代码块 / 标题 / 列表 / 引用 / 表格 / 公式 ──
    // 每个 tryXxx 尝试从 lines[i] 消费一类块：成功则 push 元素（key 与迁移
    // 前一致：'b' + out.length）并返回下一行下标，失败返回 0（不消费）。
    function tryFence(lines, i, out) {
      const fence = lines[i].match(/^```(\w*)\s*$/)
      if (!fence) return 0
      const buf = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i])
        i += 1
      }
      i += 1
      // Keep the fence language on <code> and wrap in the host's `md-code-block` container.
      out.push(createElement('div', { key: 'b' + out.length, className: 'md-code-block' },
        createElement('pre', { className: 'tzx-pre' },
          createElement('code', { className: fence[1] ? 'language-' + fence[1] : '' }, buf.join('\n')))))
      return i
    }

    function tryHeading(lines, i, out) {
      const heading = lines[i].match(/^(#{1,4})\s+(.*)$/)
      if (!heading) return 0
      const level = heading[1].length
      out.push(createElement('h' + level, { key: 'b' + out.length, className: 'tzx-h' },
        ...mdInline(heading[2], 'h' + out.length)))
      return i + 1
    }

    function tryBullet(lines, i, out) {
      const bullet = lines[i].match(/^\s*[-*+]\s+(.*)$/)
      if (!bullet) return 0
      const items = [bullet[1]]
      i += 1
      while (i < lines.length) {
        const b2 = lines[i].match(/^\s*[-*+]\s+(.*)$/)
        if (!b2) break
        items.push(b2[1])
        i += 1
      }
      out.push(createElement('ul', { key: 'b' + out.length, className: 'tzx-ul' },
        items.map((it, j) => createElement('li', { key: j },
          ...mdInline(it, 'ul' + out.length + '-' + j)))))
      return i
    }

    function tryNumList(lines, i, out) {
      const num = lines[i].match(/^\s*\d+[.)]\s+(.*)$/)
      if (!num) return 0
      const items = [num[1]]
      i += 1
      while (i < lines.length) {
        const n2 = lines[i].match(/^\s*\d+[.)]\s+(.*)$/)
        if (!n2) break
        items.push(n2[1])
        i += 1
      }
      out.push(createElement('ol', { key: 'b' + out.length, className: 'tzx-ol' },
        ...items.map((it, j) => createElement('li', { key: j },
          ...mdInline(it, 'ol' + out.length + '-' + j)))))
      return i
    }

    function tryQuote(lines, i, out) {
      const quote = lines[i].match(/^\s*>\s?(.*)$/)
      if (!quote) return 0
      const buf = [quote[1]]
      i += 1
      while (i < lines.length) {
        const q2 = lines[i].match(/^\s*>\s?(.*)$/)
        if (!q2) break
        buf.push(q2[1])
        i += 1
      }
      out.push(createElement('blockquote', { key: 'b' + out.length, className: 'tzx-bq' },
        ...buf.map((l, j) => createElement('p', { key: j }, ...mdInline(l, 'bq' + out.length + '-' + j)))))
      return i
    }

    function tryTable(lines, i, out) {
      const line = lines[i]
      const tableHead = line.match(/^\s*\|.*\|\s*$/)
      if (!tableHead) return 0
      const sep = lines[i + 1]
      const isSep = typeof sep === 'string' && /^\s*\|?[\s:\-|]+\|?\s*$/.test(sep) && sep.includes('-')
      if (!isSep) return 0
      // 无分隔行（不是标准表格）时返回 0：由段落逻辑接管，表格头行按普通行处理。
      const cellsOf = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const aligns = cellsOf(sep).map((a) => {
        if (a.startsWith(':') && a.endsWith(':')) return 'center'
        if (a.endsWith(':')) return 'right'
        return 'left'
      })
      const header = cellsOf(line)
      const dataRows = []
      i += 2
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        dataRows.push(cellsOf(lines[i]))
        i += 1
      }
      const cellStyle = (j) => ({ textAlign: aligns[j] ?? 'left' })
      out.push(createElement('table', { key: 'b' + out.length, className: 'tzx-table' },
        createElement('thead', null,
          createElement('tr', null, header.map((c, j) =>
            createElement('th', { key: j, style: cellStyle(j) },
              ...mdInline(c, 'th' + out.length + '-' + j))))),
        dataRows.length > 0
          ? createElement('tbody', null,
              dataRows.map((row, ri) => createElement('tr', { key: ri },
                row.map((c, j) => createElement('td', { key: j, style: cellStyle(j) },
                  ...mdInline(c, 'td' + out.length + '-' + ri + '-' + j))))))
          : null))
      return i
    }

    // ── 块级公式：$$...$$ 单行或 $$ 开闭块；异常（未闭合/空）→ 错误标记 ──
    function mathErrorEl(out, title, content) {
      return createElement('div', { key: 'b' + out.length, className: 'dmr-math-error', title }, content)
    }

    function tryMath(lines, i, out) {
      const single = lines[i].match(/^\$\$([^$]*)\$\$\s*$/)
      if (single) {
        const content = single[1].trim()
        out.push(content === ''
          ? mathErrorEl(out, MATH_ERROR_TITLES.empty, lines[i].trim())
          : createElement('div', { key: 'b' + out.length, className: 'dmr-math-block' }, content))
        return i + 1
      }
      if (!/^\$\$\s*$/.test(lines[i])) return 0
      const buf = []
      i += 1
      while (i < lines.length && !/^\$\$\s*$/.test(lines[i])) {
        buf.push(lines[i])
        i += 1
      }
      const closed = i < lines.length
      i += 1
      const content = buf.join('\n').trim()
      const err = !closed ? MATH_ERROR_TITLES.unclosed : content === '' ? MATH_ERROR_TITLES.empty : null
      out.push(err
        ? mathErrorEl(out, err, !closed ? '$$\n' + buf.join('\n') : '$$\n$$')
        : createElement('div', { key: 'b' + out.length, className: 'dmr-math-block' }, content))
      return i
    }

    function tryParagraph(lines, i, out) {
      const para = [lines[i]]
      i += 1
      while (i < lines.length) {
        const nxt = lines[i]
        if (nxt.trim() === '' || /^(#{1,4})\s|^\s*[-*+]\s|^\s*\d+[.)]\s|^\s*>\s?|^```|^\$\$/.test(nxt)) break
        para.push(nxt)
        i += 1
      }
      out.push(createElement('p', { key: 'b' + out.length, className: 'tzx-p' },
        ...mdInline(para.join('\n'), 'p' + out.length)))
      return i
    }

    // 块级渲染顺序（与迁移前逐分支判断的顺序一致，公式块追加在末尾）。
    const MD_RENDERERS = [tryFence, tryHeading, tryBullet, tryNumList, tryQuote, tryTable, tryMath]

    function MarkdownView({ text }) {
      const lines = String(text).split('\n')
      const out = []
      let i = 0
      while (i < lines.length) {
        let handled = false
        for (const render of MD_RENDERERS) {
          const next = render(lines, i, out)
          if (next) {
            i = next
            handled = true
            break
          }
        }
        if (handled) continue
        if (lines[i].trim() === '') {
          i += 1
          continue
        }
        i = tryParagraph(lines, i, out)
      }
      return createElement('div', { className: 'tzx-md' }, out)
    }

    exports.MarkdownView = MarkdownView


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
    // .tzx-md 系列为统一 MarkdownView 的输出样式（issue #31 从
    // dsh-think-zh-expand 迁移）；.dmr-math 为公式渲染样式。
    const STYLES = `
.tzx-md{display:flex;flex-direction:column;gap:8px;min-width:0}
.tzx-md .tzx-p{margin:0}
.tzx-md h1,.tzx-md h2,.tzx-md h3,.tzx-md h4{margin:0;font-weight:600;line-height:1.35}
.tzx-md ul,.tzx-md ol{margin:0;padding-left:26px}
.tzx-md li{margin:2px 0}
.tzx-md .tzx-pre{margin:0;background:var(--dsw-alias-markdown-code-block);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px 16px;overflow:auto;font:var(--dsw-font-markdown-code-block-small)}
.tzx-md code{background:var(--dsw-alias-markdown-code-block);border-radius:4px;padding:0 4px;font:var(--dsw-font-markdown-code-block-small)}
.tzx-md .tzx-pre code{background:none;padding:0}
.tzx-md .tzx-bq{margin:0;padding-left:12px;border-left:3px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
.tzx-md .tzx-bq p{margin:0}
.tzx-md .tzx-table{border-collapse:collapse;margin:0;font-size:14px;line-height:22px}
.tzx-md .tzx-table th,.tzx-md .tzx-table td{border:1px solid var(--dsw-alias-border-l1);padding:4px 10px}
.tzx-md .tzx-table th{background:var(--dsw-alias-markdown-code-block);font-weight:600}
.tzx-md a{color:var(--dsw-alias-accent-primary)}
.dmr-math{font:var(--dsw-font-markdown-code-block-small);font-style:italic;color:var(--dsw-alias-label-primary)}
.dmr-math-block{margin:0;text-align:center;font:var(--dsw-font-markdown-code-block-small);font-style:italic;color:var(--dsw-alias-label-primary);padding:4px 0}
.dmr-math-error{font:var(--dsw-font-markdown-code-block-small);font-style:italic;color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);border-radius:4px;padding:0 4px}
div.dmr-math-error{margin:0;text-align:center;padding:4px 8px}
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
