/**
 * PART: 思考块 + assistant-step 节点渲染器。
 *
 * 由 scripts/build.mjs 拼入 lib/client.js 的 factory 作用域（纯函数声明
 * 文本，无 import/export）。依赖 factory 内的 createElement、useState、
 * icon（共享图标，issue #54 阶段 0）与 MarkdownView（issue #31 迁移后
 * MarkdownView 由 dsh-md-render 提供，factory 经 `require('dsh-md-render')`
 * 取得）。行为与迁移前等价：reasoning 块默认展开、流式中强制展开、
 * 图片块相邻分组渲染。
 *
 * issue #54 UI 翻新：样式类名统一为 dsh-think-zh-expand- 前缀（tzx- 前缀
 * 仅保留给 dsh-md-render 的 MarkdownView 输出契约：div.tzx-md / p.tzx-p /
 * table.tzx-table 等，本片段不产出这些类名）；标题行折叠箭头用共享
 * chevronRight 图标 + 旋转过渡，思考图标用共享 clock 图标，流式生成中
 * 显示「生成中」徽章（脉冲动画）。
 */

// ── 思考块：默认展开，可点击收起，流式中强制展开 ───────────────────
function ThinkBlock({ text, running }) {
  const [expanded, setExpanded] = useState(true)
  const open = expanded || running
  const firstLine = (t) => {
    const nl = t.indexOf('\n')
    return nl === -1 ? t : t.slice(0, nl)
  }
  return createElement(
    'div',
    { className: 'dsh-think-zh-expand-think', 'data-variant': 'think', 'data-state': running ? 'running' : 'ok' },
    createElement(
      'div',
      {
        className: 'dsh-think-zh-expand-think-head',
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
      // 折叠箭头：chevronRight 收起指向右，展开时旋转 90° 指向下
      // （transition 见 styles.part.js 的 -chevron-open 规则）。
      createElement(
        'span',
        { className: 'dsh-think-zh-expand-think-chevron' + (open ? ' dsh-think-zh-expand-think-chevron-open' : '') },
        icon.chevronRight(14),
      ),
      createElement('span', { className: 'dsh-think-zh-expand-think-icon' }, icon.clock(14)),
      createElement('span', { className: 'dsh-think-zh-expand-think-title' }, '思考'),
      running && createElement('span', { className: 'dsh-think-zh-expand-think-badge' }, '生成中'),
      !open && createElement('span', { className: 'dsh-think-zh-expand-think-summary' }, firstLine(text)),
    ),
    // 思考内容也走统一 Markdown 渲染（dsh-md-render 的 MarkdownView：
    // 代码块 / mermaid / 表格 / 列表 / 标题 / 公式等），否则思考里出现
    // 的 markdown 会以原始语法文本显示。
    open &&
      createElement('div', { className: 'dsh-think-zh-expand-think-body' }, createElement(MarkdownView, { text })),
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
    return createElement('div', { key: 'img' + i }, renderMessageImages({ images, align: 'start' }))
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
    rendered.push(createElement('span', { key: 'stopped', className: 'dsh-think-zh-expand-stopped' }, '已停止'))
  }
  return createElement(
    'div',
    { className: 'dsh-think-zh-expand-assistant', 'data-streaming': streaming || undefined },
    createElement('div', { className: 'dsh-think-zh-expand-assistant-body' }, rendered),
  )
}
