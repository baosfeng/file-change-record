/**
 * PART: 思考块 + assistant-step 节点渲染器。
 *
 * 由 scripts/build.mjs 拼入 lib/client.js 的 factory 作用域（纯函数声明
 * 文本，无 import/export）。依赖 factory 内的 createElement、useState 与
 * MarkdownView（issue #31 迁移后 MarkdownView 由 dsh-md-render 提供，
 * factory 经 `require('dsh-md-render')` 取得）。行为与迁移前等价：
 * reasoning 块默认展开、流式中强制展开、图片块相邻分组渲染。
 *
 * 视觉基线（issue #73 用户要求）：与 DSH 官方 ReasoningRow 完全一致——
 * 头部为 DisclosureRow 结构（leading 图标区 + 标题 + separator + 摘要），
 * 正文 thinkBody 样式（tertiary 色、22px 缩进、14px/24px）；issue #54 的
 * clock 图标与「生成中」徽章已按用户要求回退移除（类名保留
 * dsh-think-zh-expand- 前缀，避免与 dsh-md-render 的 tzx-md 输出契约混淆）。
 * 官方收起态 leading 显示 Think 图标（IconThinkOutline14）、hover 时淡出并
 * 淡入 chevron；展开态只显示 chevron（IconChevronDownOutline14）。官方图标
 * 为 14×14 fill 风格，共享图标系统（dsh-shared，stroke 风格）无对应图标，
 * 此处内联官方 path。
 */

// ── 官方图标（issue #73 对齐官方 ReasoningRow）────────────────────
// 官方 IconChevronDownOutline14（14×14，fill=currentColor）：折叠箭头，
// 展开/收起态均为向下（官方 DisclosureRow 行为）。
const chevronDownIcon = ({ size = 14, className }) =>
  createElement(
    'svg',
    { width: size, height: size, className, viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': 'true' },
    createElement('path', {
      d: 'M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z',
      fill: 'currentColor',
    }),
  )

// 官方 IconThinkOutline14（14×14，fill=currentColor）：收起态思考图标。
const thinkIcon = ({ size = 14, className }) =>
  createElement(
    'svg',
    { width: size, height: size, className, viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': 'true' },
    createElement('path', {
      d: 'M7.06431 5.93342C7.68763 5.93342 8.19307 6.43904 8.19322 7.06233C8.19322 7.68573 7.68772 8.19123 7.06431 8.19123C6.44099 8.19113 5.9354 7.68567 5.9354 7.06233C5.93555 6.43911 6.44108 5.93353 7.06431 5.93342Z',
      fill: 'currentColor',
    }),
    createElement('path', {
      fillRule: 'evenodd',
      clipRule: 'evenodd',
      d: 'M8.6815 0.963693C10.1169 0.447019 11.6266 0.374829 12.5633 1.31135C13.5 2.24805 13.4277 3.75776 12.911 5.19319C12.7126 5.74431 12.4386 6.31796 12.0965 6.89729C12.4969 7.54638 12.8141 8.19018 13.036 8.80647C13.5527 10.2419 13.6251 11.7516 12.6883 12.6883C11.7516 13.625 10.242 13.5527 8.8065 13.036C8.19022 12.8141 7.54641 12.4969 6.89732 12.0965C6.31797 12.4386 5.74435 12.7125 5.19322 12.911C3.75777 13.4276 2.2481 13.5 1.31138 12.5633C0.374859 11.6266 0.447049 10.1168 0.963724 8.68147C1.17185 8.10338 1.46321 7.50063 1.82896 6.8924C1.52182 6.35711 1.27235 5.82825 1.08872 5.31819C0.572068 3.88278 0.499714 2.37306 1.43638 1.43635C2.37308 0.499655 3.8828 0.572044 5.31822 1.08869C5.82828 1.27232 6.35715 1.5218 6.89243 1.82893C7.50066 1.46318 8.10341 1.17181 8.6815 0.963693ZM11.3573 8.01154C10.9083 8.62253 10.3901 9.22873 9.80943 9.8094C9.22877 10.3901 8.62255 10.9083 8.01158 11.3572C8.4257 11.5841 8.8287 11.7688 9.21275 11.9071C10.5456 12.3868 11.4246 12.2547 11.8397 11.8397C12.2548 11.4246 12.3869 10.5456 11.9071 9.21272C11.7688 8.82866 11.5841 8.42568 11.3573 8.01154ZM2.56529 8.02912C2.37344 8.39322 2.21495 8.74796 2.09263 9.08772C1.61291 10.4204 1.74512 11.2995 2.16001 11.7147C2.57505 12.1297 3.45415 12.2618 4.78697 11.7821C5.11057 11.6656 5.44786 11.5164 5.7938 11.3367C5.249 10.9223 4.70922 10.4533 4.19029 9.9344C3.57578 9.31987 3.03169 8.67633 2.56529 8.02912ZM6.90708 3.2469C6.24065 3.70479 5.5646 4.26321 4.91392 4.91389C4.26325 5.56456 3.70482 6.24063 3.24693 6.90705C3.72674 7.63325 4.32777 8.37459 5.03892 9.08576C5.64943 9.69627 6.28183 10.2265 6.90806 10.6678C7.59368 10.2025 8.2908 9.63076 8.96079 8.96076C9.6308 8.29075 10.2025 7.59366 10.6678 6.90803C10.2265 6.2818 9.69631 5.6494 9.08579 5.03889C8.37462 4.32773 7.63328 3.72672 6.90708 3.2469ZM11.7147 2.15998C11.2996 1.74509 10.4204 1.61288 9.08775 2.0926C8.74835 2.21479 8.39382 2.37271 8.03013 2.56428C8.67728 3.03065 9.31995 3.5758 9.93443 4.19026C10.4534 4.7092 10.9223 5.24896 11.3368 5.79377C11.5164 5.44785 11.6656 5.11052 11.7821 4.78694C12.2618 3.45416 12.1297 2.57502 11.7147 2.15998ZM4.91197 2.2176C3.57922 1.73788 2.70004 1.86995 2.28501 2.28498C1.87001 2.70003 1.73791 3.5792 2.21763 4.91194C2.31709 5.18822 2.44112 5.47427 2.58677 5.7674C3.01931 5.1887 3.51474 4.6158 4.06529 4.06526C4.61584 3.5147 5.18872 3.01928 5.76743 2.58674C5.47431 2.4411 5.18824 2.31706 4.91197 2.2176Z',
      fill: 'currentColor',
    }),
  )

// ── 控制标签剥离（issue #1xx：思考/回答中的 xml 风格标签原样显示）─────
// 模型输出里会出现 xml 风格的控制/分段标签（`<review>`/`</review>`、
// `<think>`/`</think>`、`<answer>`/`</answer>`）：它们不属于 markdown，
// MarkdownView 会原样渲染成裸文本，看起来像"无效标签"。渲染前剥离
// 标签本身、保留内部内容（不丢模型生成的内容）。
const CONTROL_TAG_RE = /<\s*\/?\s*(?:think|review|answer)\s*>/gi

function stripControlTags(text) {
  if (typeof text !== 'string' || text === '') return text
  return text.replace(CONTROL_TAG_RE, '')
}

// ── 思考块：默认展开，可点击收起，流式中强制展开 ───────────────────
// 结构对齐官方 ReasoningRow（DisclosureRow）：leading（展开态 chevron /
// 收起态 Think 图标 + chevron）+ 标题 + separator + 摘要 + thinkBody。
function ThinkBlock({ text, running }) {
  const cleanText = stripControlTags(text)
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
      // leading：展开态只显示 chevron（官方展开态）；收起态显示 Think 图标 +
      // chevron（官方收起态：chevron 默认隐藏、hover 淡入，Think 图标 hover 淡出）。
      createElement(
        'span',
        { className: 'dsh-think-zh-expand-think-leading' },
        open
          ? createElement(
              'span',
              { className: 'dsh-think-zh-expand-think-chevron' },
              createElement(chevronDownIcon, { size: 14 }),
            )
          : [
              createElement(
                'span',
                { className: 'dsh-think-zh-expand-think-icon' },
                createElement(thinkIcon, { size: 14 }),
              ),
              createElement(
                'span',
                { className: 'dsh-think-zh-expand-think-chevron dsh-think-zh-expand-think-chevron-hover' },
                createElement(chevronDownIcon, { size: 14 }),
              ),
            ],
      ),
      createElement('span', { className: 'dsh-think-zh-expand-think-title' }, '思考'),
      !open && [
        createElement('span', { className: 'dsh-think-zh-expand-think-separator', 'aria-hidden': 'true' }),
        createElement('span', { className: 'dsh-think-zh-expand-think-summary' }, firstLine(cleanText)),
      ],
    ),
    // 思考内容也走统一 Markdown 渲染（dsh-md-render 的 MarkdownView：
    // 代码块 / mermaid / 表格 / 列表 / 标题 / 公式等），否则思考里出现
    // 的 markdown 会以原始语法文本显示。渲染前剥离 thinking/review 等
    // 模型控制标签（否则 `<review>`、`</review>` 以裸文本出现）。
    open &&
      createElement(
        'div',
        { className: 'dsh-think-zh-expand-think-body' },
        createElement(MarkdownView, { text: cleanText }),
      ),
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
    return createElement(MarkdownView, { key: 't' + i, text: stripControlTags(block.text) })
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
