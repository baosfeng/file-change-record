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
    if (text[i] !== '$') {
      i += 1
      continue
    }
    const skip = mathSkip(text, i)
    if (skip !== i) {
      i = skip
      continue
    }
    if (i > segStart) out.push(text.slice(segStart, i))
    let j = i + 1
    while (j < end && text[j] !== '$') j += 1
    if (j >= end) {
      out.push(
        createElement(
          'span',
          { key: key + '-e' + k, className: 'dsh-md-render-math-error', title: MATH_ERROR_TITLES.unclosed },
          icon.alert(12),
          text.slice(i, end),
        ),
      )
      return k + 1
    }
    out.push(
      createElement(
        'span',
        { key: key + '-e' + k, className: 'dsh-md-render-math-error', title: MATH_ERROR_TITLES.multiline },
        icon.alert(12),
        text.slice(i, j + 1),
      ),
    )
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
  let m,
    k = 0
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
        out.push(createElement('span', { key: kk, className: 'dsh-md-render-math' }, m[5].slice(1, -1)))
      } else if (isMathError(m)) {
        out.push(
          createElement(
            'span',
            { key: kk, className: 'dsh-md-render-math-error', title: MATH_ERROR_TITLES.malformed },
            icon.alert(12),
            m[5],
          ),
        )
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
// 复制按钮（CopyButton 见 copy.part.js，issue #74）：代码块/整段右下角。
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
  out.push(
    createElement(
      'div',
      { key: 'b' + out.length, className: 'md-code-block' },
      createElement(
        'pre',
        { className: 'tzx-pre' },
        createElement('code', { className: fence[1] ? 'language-' + fence[1] : '' }, buf.join('\n')),
      ),
      createElement(CopyButton, { kind: 'code' }),
    ),
  )
  return i
}

function tryHeading(lines, i, out) {
  const heading = lines[i].match(/^(#{1,4})\s+(.*)$/)
  if (!heading) return 0
  const level = heading[1].length
  out.push(
    createElement(
      'h' + level,
      { key: 'b' + out.length, className: 'tzx-h' },
      ...mdInline(heading[2], 'h' + out.length),
    ),
  )
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
  out.push(
    createElement(
      'ul',
      { key: 'b' + out.length, className: 'tzx-ul' },
      items.map((it, j) => createElement('li', { key: j }, ...mdInline(it, 'ul' + out.length + '-' + j))),
    ),
  )
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
  out.push(
    createElement(
      'ol',
      { key: 'b' + out.length, className: 'tzx-ol' },
      ...items.map((it, j) => createElement('li', { key: j }, ...mdInline(it, 'ol' + out.length + '-' + j))),
    ),
  )
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
  out.push(
    createElement(
      'blockquote',
      { key: 'b' + out.length, className: 'tzx-bq' },
      ...buf.map((l, j) => createElement('p', { key: j }, ...mdInline(l, 'bq' + out.length + '-' + j))),
    ),
  )
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
  const cellsOf = (row) =>
    row
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim())
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
  out.push(
    createElement(
      'table',
      { key: 'b' + out.length, className: 'tzx-table' },
      createElement(
        'thead',
        null,
        createElement(
          'tr',
          null,
          header.map((c, j) =>
            createElement('th', { key: j, style: cellStyle(j) }, ...mdInline(c, 'th' + out.length + '-' + j)),
          ),
        ),
      ),
      dataRows.length > 0
        ? createElement(
            'tbody',
            null,
            dataRows.map((row, ri) =>
              createElement(
                'tr',
                { key: ri },
                row.map((c, j) =>
                  createElement(
                    'td',
                    { key: j, style: cellStyle(j) },
                    ...mdInline(c, 'td' + out.length + '-' + ri + '-' + j),
                  ),
                ),
              ),
            ),
          )
        : null,
    ),
  )
  return i
}

// ── 块级公式：$$...$$ 单行或 $$ 开闭块；异常（未闭合/空）→ 错误标记 ──
// 错误标记带共享 alert 图标（issue #54 阶段 1：错误状态视觉统一）。
function mathErrorEl(out, title, content) {
  return createElement(
    'div',
    { key: 'b' + out.length, className: 'dsh-md-render-math-error', title },
    icon.alert(12),
    content,
  )
}

function tryMath(lines, i, out) {
  const single = lines[i].match(/^\$\$([^$]*)\$\$\s*$/)
  if (single) {
    const content = single[1].trim()
    out.push(
      content === ''
        ? mathErrorEl(out, MATH_ERROR_TITLES.empty, lines[i].trim())
        : createElement('div', { key: 'b' + out.length, className: 'dsh-md-render-math-block' }, content),
    )
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
  out.push(
    err
      ? mathErrorEl(out, err, !closed ? '$$\n' + buf.join('\n') : '$$\n$$')
      : createElement('div', { key: 'b' + out.length, className: 'dsh-md-render-math-block' }, content),
  )
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
  out.push(
    createElement('p', { key: 'b' + out.length, className: 'tzx-p' }, ...mdInline(para.join('\n'), 'p' + out.length)),
  )
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
  return createElement('div', { className: 'tzx-md' }, out, createElement(CopyButton, { kind: 'content' }))
}

exports.MarkdownView = MarkdownView
