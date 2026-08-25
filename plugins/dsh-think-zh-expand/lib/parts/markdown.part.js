/**
 * PART: 轻量 Markdown 渲染（行内 + 块级）。
 *
 * 由 scripts/build.mjs 拼入 lib/client.js 的 factory 作用域——本文件是纯
 * 函数声明文本（无 import/export），依赖 factory 内的 createElement 与
 * mdInline。行为与拆分前的单文件实现完全等价（key 生成、块消费顺序、
 * 表格回退逻辑均不变）。
 */

// ── 轻量行内 Markdown：行内代码 / 粗体 / 斜体 / 链接 ───────────────
// 行内代码按 CommonMark 语义：N 个反引号开闭配对（\1 回声闭合串），
// 内容允许含单个反引号（如 `` `agent/status` `` → <code>`agent/status`</code>）；
// 仅支持单反引号配对的实现会在双反引号输入上错位解析，把内容切成
// 裸文本。闭合串后不能紧跟反引号（(?!`)，避免把更长的 run 误当闭合。
function mdInline(text, key) {
  const out = []
  // content 首字符禁反引号（[^`\n]）："````"（4 连反引号）这类无内容的
  // 反引号串保持原样，不会被拆成 code"``"。
  const re = /(`+)([^`\n][^\n]*?)\1(?!`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\*[^*]+\*)/g
  // CommonMark：内容以空格开头且以空格结尾、且不只含空格时，去首尾各一个空格。
  const trimCode = (raw) => {
    if (raw.length > 1 && raw[0] === ' ' && raw[raw.length - 1] === ' ' && raw.trim() !== '') {
      return raw.slice(1, -1)
    }
    return raw
  }
  let last = 0
  let m
  let k = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
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
    } else {
      out.push(createElement('em', { key: kk }, m[5].slice(1, -1)))
    }
    k += 1
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// ── 轻量块级 Markdown：代码块 / 标题 / 列表 / 引用 / 表格 / 段落 ────
// 每个 tryXxx 尝试从 lines[i] 消费一类块：成功则把渲染元素 push 进 out
// （key 与拆分前一致：'b' + out.length，push 前求值）并返回下一行下标，
// 失败返回 0（不消费、不动 out）。主循环（MarkdownView）按原顺序调度。
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
  // Keep the fence language (```mermaid / ```dsh-ui / ```js ...) on the
  // <code> element and wrap the block in the host's `md-code-block`
  // container so third-party renderers that scan the stock DOM
  // structure (dsh-mermaid-render finds `div.md-code-block`,
  // dsh-genui matches the md-code-block surface) can detect it.
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

function tryParagraph(lines, i, out) {
  const para = [lines[i]]
  i += 1
  while (i < lines.length) {
    const nxt = lines[i]
    if (nxt.trim() === '' || /^(#{1,4})\s|^\s*[-*+]\s|^\s*\d+[.)]\s|^\s*>\s?|^```/.test(nxt)) break
    para.push(nxt)
    i += 1
  }
  out.push(createElement('p', { key: 'b' + out.length, className: 'tzx-p' },
    ...mdInline(para.join('\n'), 'p' + out.length)))
  return i
}

// 块级渲染顺序（与拆分前逐分支判断的顺序一致）。
const MD_RENDERERS = [tryFence, tryHeading, tryBullet, tryNumList, tryQuote, tryTable]

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
