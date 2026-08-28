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
