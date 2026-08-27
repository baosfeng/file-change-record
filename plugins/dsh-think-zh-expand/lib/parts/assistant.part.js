/**
 * PART: 思考块 + assistant-step 节点渲染器。
 *
 * 由 scripts/build.mjs 拼入 lib/client.js 的 factory 作用域（纯函数声明
 * 文本，无 import/export）。依赖 factory 内的 createElement、useState 与
 * MarkdownView（issue #31 迁移后 MarkdownView 由 dsh-md-render 提供，
 * factory 经 `require('dsh-md-render')` 取得）。行为与迁移前等价：
 * reasoning 块默认展开、流式中强制展开、图片块相邻分组渲染。
 */

// ── 思考块：默认展开，可点击收起，流式中强制展开 ───────────────────
function ThinkBlock({ text, running }) {
  const [expanded, setExpanded] = useState(true)
  const open = expanded || running
  const firstLine = (t) => {
    const nl = t.indexOf('\n')
    return nl === -1 ? t : t.slice(0, nl)
  }
  return createElement('div', { className: 'tzx-think', 'data-variant': 'think', 'data-state': running ? 'running' : 'ok' },
    createElement('div', {
      className: 'tzx-think-row',
      role: 'button',
      tabIndex: 0,
      'aria-expanded': open,
      onClick: () => setExpanded((v) => !v),
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setExpanded((v) => !v)
        }
      },
    },
      createElement('span', { className: 'tzx-think-chevron' }, open ? '▾' : '▸'),
      createElement('span', { className: 'tzx-think-title' }, '思考'),
      !open && createElement('span', { className: 'tzx-think-summary' }, firstLine(text)),
    ),
    // 思考内容也走统一 Markdown 渲染（dsh-md-render 的 MarkdownView：
    // 代码块 / mermaid / 表格 / 列表 / 标题 / 公式等），否则思考里出现
    // 的 markdown 会以原始语法文本显示。
    open && createElement('div', { className: 'tzx-think-body' },
      createElement(MarkdownView, { text })),
  )
}

// ── 图片块：把相邻 image 块收集为一组，返回组内最后一个 image 的下标 ──
function imageGroupEnd(blocks, i) {
  let end = i
  while (end + 1 < blocks.length) {
    const next = blocks[end + 1]
    if (!next || next.kind !== 'image') break
    end += 1
  }
  return end
}

/** 渲染单个 block；不认识的块（tool-call 等）返回 null（由独立节点渲染）。 */
function renderBlock(blocks, i, streaming, last, renderMessageImages) {
  const block = blocks[i]
  if (block.kind === 'text' && typeof block.text === 'string') {
    return createElement(MarkdownView, { key: 't' + i, text: block.text })
  }
  if (block.kind === 'reasoning' && typeof block.text === 'string') {
    return createElement(ThinkBlock, {
      key: 'r' + i,
      text: block.text,
      running: streaming && i === last,
    })
  }
  if (block.kind === 'image' && typeof renderMessageImages === 'function') {
    const end = imageGroupEnd(blocks, i)
    const images = blocks.slice(i, end + 1).map((b) => ({ attachment: b.attachment }))
    return createElement('div', { key: 'img' + i },
      renderMessageImages({ images, align: 'start' }))
  }
  return null
}

/** 渲染 blocks 全列表：返回元素数组；图片组只渲染一次（消费整组）。 */
function renderBlocks(blocks, streaming, renderMessageImages) {
  const last = blocks.length - 1
  const rendered = []
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (!block) continue
    const el = renderBlock(blocks, i, streaming, last, renderMessageImages)
    if (!el) continue
    if (block.kind === 'image') i = imageGroupEnd(blocks, i)
    rendered.push(el)
  }
  return rendered
}

// ── assistant-step 节点渲染器：替换内置单行折叠版 ──────────────────
function AssistantStepView({ node, renderMessageImages }) {
  const data = node && node.data ? node.data : null
  if (!data || !Array.isArray(data.blocks)) return null
  const streaming = data.status === 'running'
  const interrupted = data.status === 'interrupted'
  const rendered = renderBlocks(data.blocks, streaming, renderMessageImages)
  if (interrupted) {
    rendered.push(createElement('span', { key: 'stopped', className: 'tzx-stopped' }, '已停止'))
  }
  return createElement('div', { className: 'tzx-assistant', 'data-streaming': streaming || undefined },
    createElement('div', { className: 'tzx-assistant-body' }, rendered))
}
