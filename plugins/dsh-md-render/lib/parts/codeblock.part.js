// ── 代码块渲染（issue #80）：语言标签 + 复制按钮头部 + 行号 + 高亮 ──
// 结构：div.md-code-block > div.dsh-md-render-code-head（语言名 + 复制
// 按钮，同排）+ pre.tzx-pre > code.language-xxx（token 高亮 / 行号）。
// 行号用 CSS counter 伪元素渲染，不进入 code/pre 文本内容，mermaid 扫
// 描与复制按钮读取的原文本不受污染。语法高亮 tokenizer 见
// highlight.part.js。

// 渲染选项（行号开关，默认开）；apply(ctx) 从 ctx.config.lineNumbers
// 读取，测试可用 setRenderOptions 切换。模块级变量，MarkdownView 渲染
// 代码块时读取。
let renderOptions = { lineNumbers: true }
function setRenderOptions(next) {
  renderOptions = { ...renderOptions, ...(next || {}) }
}

// token 类型 → 高亮类名（其余类型渲染为纯文本）。
const TOKEN_CLASS = {
  keyword: 'dsh-md-render-tok-keyword',
  string: 'dsh-md-render-tok-string',
  comment: 'dsh-md-render-tok-comment',
  number: 'dsh-md-render-tok-number',
  function: 'dsh-md-render-tok-function',
}

function renderTokens(tokens) {
  const out = []
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]
    const cls = TOKEN_CLASS[t.type]
    out.push(cls ? createElement('span', { key: i, className: cls }, t.text) : t.text)
  }
  return out
}

function shouldHighlight(lang, lines) {
  return !!langConfig(lang) && lines.length <= MAX_CODE_LINES
}

/** 渲染代码块主体（code 内细胞）：按行输出 token / 行号 div。 */
function renderCodeCells(code, lang, lines, highlight, lineNumbers) {
  const tokens = highlight ? tokenize(code, lang) : null
  const nodes = []
  for (let i = 0; i < lines.length; i += 1) {
    const toks = tokens ? tokens[i] : [{ type: 'plain', text: lines[i] }]
    const cells = renderTokens(toks)
    if (!lineNumbers) {
      nodes.push(...cells)
    } else {
      nodes.push(createElement('div', { key: 'l' + i, className: 'dsh-md-render-code-line' }, ...cells))
    }
    if (i < lines.length - 1) nodes.push('\n')
  }
  return nodes
}

/** 渲染完整代码块：头部（语言名 + 复制按钮）+ pre > code（高亮/行号）。 */
function renderCodeBlock({ key, lang, code }) {
  const lines = String(code).split('\n')
  const highlight = shouldHighlight(lang, lines)
  const head = createElement(
    'div',
    { className: 'dsh-md-render-code-head' },
    createElement('span', { className: 'dsh-md-render-code-lang' }, langLabel(lang)),
    createElement(CopyButton, { kind: 'code' }),
  )
  const body = renderCodeCells(code, lang, lines, highlight, renderOptions.lineNumbers)
  return createElement(
    'div',
    { key, className: 'md-code-block' },
    head,
    createElement(
      'pre',
      { className: 'tzx-pre' },
      createElement('code', { className: lang ? 'language-' + lang : '' }, ...body),
    ),
  )
}

exports.setRenderOptions = setRenderOptions
