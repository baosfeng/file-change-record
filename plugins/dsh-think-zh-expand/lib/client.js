/**
 * dsh-think-zh-expand — client half (browser).
 *
 * 功能 2：思考（reasoning）内容默认展开显示。
 *
 * 内置的 assistant-step 渲染器把 reasoning 块折叠成单行（ReasoningRow，
 * `useState(false)`，只显示第一行摘要）。本插件替换 `conversation.chat.node`
 * 的 `assistant-step` 渲染器：
 *  - reasoning 块 → 默认展开的「思考」块（完整内容直接显示，点击标题行可
 *    收起，流式生成中强制保持展开）；
 *  - text 块 → 复用 dsh-md-render 的统一 MarkdownView 渲染（issue #31
 *    渲染职责迁移：表格 / 公式 / 代码块容器由 dsh-md-render 提供，本插件
 *    经 `dsh.client.external` 跨插件 require 其 MarkdownView 组件）；
 *  - image 块 → 复用 owner 的 renderMessageImages（内置图片渲染）；
 *  - tool-call 块与内置一致跳过（tool-call 有独立节点渲染）。
 *
 * 功能 3：界面标签中文化。
 *
 * 官方 UI（dsh-client-ui-conversation / dsh-client-ui-trajectory）的 zh 字典
 * 本身未翻译完（如 `toolbar.duration: "Duration"`），且存在硬编码英文
 * （"Thinking"、"Tool Call"、"ASSISTANT" 等）；`locale.register` 对已注册的
 * 同 ns+locale 字典重复注册会抛错，无法经 locale 服务补译。因此本插件在
 * DOM 层做精准文本替换：只匹配「完全等于」词表的叶子文本节点（排除
 * pre/code/输入区，避免误伤代码块与消息正文），MutationObserver 跟随
 * React 重渲染持续生效。
 *
 * 样式走 DSH 语义 token（--dsw-alias-* / --dsw-font-*），随 activation 注入、
 * fiber teardown 卸载（HMR/禁用无残留）。图标走共享图标系统（issue #54
 * 阶段 0：plugins/dsh-shared/client-parts/icons.part.js，构建时拼接）。
 * MarkdownView 的渲染样式（.tzx-md 系列）随 dsh-md-render 注入（issue #31
 * 迁移）。
 *
 * BUILD NOTE: 本文件是源码模板（骨架）。scripts/build.mjs 把
 * lib/parts/*.part.js 片段注入到下方 /*__PART_*__* / 占位符处并写出
 * lib/client.js（DSH 实际提供的产物，单一 __ModuleLoader__ bundle，无相对
 * 路径 require）。产物必须提交（CI 只跑 node --check + 测试，不跑构建）；
 * 片段为纯函数声明文本（无 import/export），注入后处于本 factory 作用域。
 */
window.__ModuleLoader__.load({
  id: 'dsh-think-zh-expand',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    // useState 由 assistant.part.js 片段（ThinkBlock）使用；模板静态分析
    // 看不到片段内容（根 eslint 配置对 src+parts 已关闭 no-unused-vars）。
    const { createElement, useState } = require('react')
    // 统一 MarkdownView 由 dsh-md-render 提供（issue #31 渲染职责迁移；
    // 依赖声明见 package.json 的 dsh.client.external）。
    const MarkdownView = require('dsh-md-render').MarkdownView

    // ── 共享图标（issue #54 阶段 0：dsh-shared/client-parts）──────────
    // ── shared icons (inline, stroke=currentColor, matching better-sidebar) ──
// Single source of truth for the plugin UI icon set (issue #54 阶段 0).
// Extracted from dsh-file-activity's lib/parts/icons.part.js; every plugin's
// scripts/build.mjs splices this file via the `shared: true` piece marker.
// Keep the stroke=currentColor outline style — it inherits the surrounding
// text color and reads on both light and dark themes.
const ICON_STROKE = 1.8
const iconSvg = (children, size) =>
  createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: ICON_STROKE,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    children.map((child, i) =>
      child === null || child === undefined || typeof child === 'boolean'
        ? child
        : createElement(child.type, { key: i, ...child.props }),
    ),
  )

const icon = {
  clock: (size = 16) =>
    iconSvg([createElement('circle', { cx: 12, cy: 12, r: 9 }), createElement('path', { d: 'M12 7v5l3 2' })], size),
  refresh: (size = 16) =>
    iconSvg(
      [
        createElement('path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }),
        createElement('polyline', { points: '21 3 21 9 15 9' }),
      ],
      size,
    ),
  trash: (size = 16) =>
    iconSvg(
      [
        createElement('path', { d: 'M3 6h18' }),
        createElement('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }),
        createElement('path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
      ],
      size,
    ),
  chevronRight: (size = 14) => iconSvg([createElement('polyline', { points: '9 6 15 12 9 18' })], size),
  chevronDown: (size = 14) => iconSvg([createElement('polyline', { points: '6 9 12 15 18 9' })], size),
  file: (size = 16) =>
    iconSvg(
      [
        createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        createElement('path', { d: 'M14 2v6h6' }),
      ],
      size,
    ),
  folder: (size = 16) =>
    iconSvg(
      [
        createElement('path', {
          d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
        }),
      ],
      size,
    ),
  external: (size = 15) =>
    iconSvg(
      [
        createElement('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
        createElement('polyline', { points: '15 3 21 3 21 9' }),
        createElement('line', { x1: 10, y1: 14, x2: 21, y2: 3 }),
      ],
      size,
    ),
  close: (size = 15) =>
    iconSvg(
      [
        createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
        createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 }),
      ],
      size,
    ),
  help: (size = 16) =>
    iconSvg(
      [
        createElement('circle', { cx: 12, cy: 12, r: 9 }),
        createElement('path', { d: 'M9.1 9.2a3 3 0 0 1 5.8 1.2c0 1.8-2.7 2.4-2.7 3.6' }),
        createElement('line', { x1: 12, y1: 17.2, x2: 12.01, y2: 17.2 }),
      ],
      size,
    ),
  // ── generic action icons (issue #54 阶段 0) ─────────────────────────────
  // Added for the upcoming plugin UI refresh: save/confirm (check), add/
  // install (plus), market search (search), settings entry (settings).
  check: (size = 16) => iconSvg([createElement('polyline', { points: '20 6 9 17 4 12' })], size),
  plus: (size = 16) =>
    iconSvg(
      [
        createElement('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
        createElement('line', { x1: 5, y1: 12, x2: 19, y2: 12 }),
      ],
      size,
    ),
  pencil: (size = 15) =>
    iconSvg([createElement('path', { d: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' })], size),
  search: (size = 16) =>
    iconSvg(
      [
        createElement('circle', { cx: 11, cy: 11, r: 8 }),
        createElement('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }),
      ],
      size,
    ),
  settings: (size = 16) =>
    iconSvg(
      [
        createElement('circle', { cx: 12, cy: 12, r: 3 }),
        createElement('path', {
          d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
        }),
      ],
      size,
    ),
  // 警告（issue #54 阶段 1 新增）：安全护栏告警类型图标（投毒/提示注入），
  // 三角警示 + 感叹号，stroke=currentColor 风格与其余图标一致。
  alert: (size = 16) =>
    iconSvg(
      [
        createElement('path', {
          d: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
        }),
        createElement('line', { x1: 12, y1: 9, x2: 12, y2: 13 }),
        createElement('line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }),
      ],
      size,
    ),
  // 代码（issue #54 阶段 1 新增）：尖括号 `</>`，预览/代码切换的代码视图
  // 图标（dsh-mermaid-render 卡片），stroke=currentColor 风格与其余图标一致。
  code: (size = 16) =>
    iconSvg(
      [
        createElement('polyline', { points: '16 18 22 12 16 6' }),
        createElement('polyline', { points: '8 6 2 12 8 18' }),
      ],
      size,
    ),
}

// Common-language / file-type badges (issue #24): brand fill + contrast
// ink, reading on both light and dark themes. Unmapped extensions keep the
// neutral currentColor file icon above. [bg, fg ink, short mark]
const FILE_BADGES = {
  // JavaScript / TypeScript
  js: ['#F7DF1E', '#323330', 'JS'],
  mjs: ['#F7DF1E', '#323330', 'JS'],
  cjs: ['#F7DF1E', '#323330', 'JS'],
  ts: ['#3178C6', '#ffffff', 'TS'],
  mts: ['#3178C6', '#ffffff', 'TS'],
  cts: ['#3178C6', '#ffffff', 'TS'],
  tsx: ['#3178C6', '#ffffff', 'TSX'],
  jsx: ['#3178C6', '#ffffff', 'JSX'],
  // 后端语言
  java: ['#007396', '#ffffff', 'JAVA'],
  c: ['#A8B9CC', '#111111', 'C'],
  cpp: ['#00599C', '#ffffff', 'C++'],
  cxx: ['#00599C', '#ffffff', 'C++'],
  cc: ['#00599C', '#ffffff', 'C++'],
  hpp: ['#00599C', '#ffffff', 'C++'],
  h: ['#A8B9CC', '#111111', 'H'],
  hh: ['#A8B9CC', '#111111', 'H'],
  cs: ['#68217A', '#ffffff', 'C#'],
  csharp: ['#68217A', '#ffffff', 'C#'],
  go: ['#00ADD8', '#ffffff', 'GO'],
  rs: ['#CE422B', '#ffffff', 'RS'],
  rb: ['#B51624', '#ffffff', 'RB'],
  php: ['#777BB4', '#ffffff', 'PHP'],
  py: ['#3776AB', '#ffffff', 'PY'],
  swift: ['#F05138', '#ffffff', 'SWIFT'],
  kt: ['#7F52FF', '#ffffff', 'KT'],
  kotlin: ['#7F52FF', '#ffffff', 'KT'],
  dart: ['#0175C2', '#ffffff', 'DART'],
  scala: ['#DC322F', '#ffffff', 'SCALA'],
  lua: ['#2C2C7C', '#ffffff', 'LUA'],
  pl: ['#0298C3', '#ffffff', 'PERL'],
  r: ['#336DC3', '#ffffff', 'R'],
  m: ['#C1272D', '#ffffff', 'MAT'],
  mm: ['#C1272D', '#ffffff', 'MAT'],
  // Web / 前端
  html: ['#E34F26', '#ffffff', '</>'],
  htm: ['#E34F26', '#ffffff', '</>'],
  css: ['#663399', '#ffffff', 'CSS'],
  scss: ['#CD6799', '#ffffff', 'SCSS'],
  sass: ['#CD6799', '#ffffff', 'SCSS'],
  vue: ['#42B883', '#ffffff', 'VUE'],
  svelte: ['#FF3E00', '#ffffff', 'SVELTE'],
  // 数据 / 结构化
  json: ['#F7DF1E', '#323330', '{}'],
  sql: ['#00758F', '#ffffff', 'SQL'],
  csv: ['#2E7D32', '#ffffff', 'CSV'],
  db: ['#0F62FE', '#ffffff', 'DB'],
  sqlite: ['#0F62FE', '#ffffff', 'DB'],
  sqlite3: ['#0F62FE', '#ffffff', 'DB'],
  xml: ['#FF6F00', '#ffffff', 'XML'],
  svg: ['#FF6F00', '#ffffff', 'SVG'],
  // 文档
  md: ['#42A5F5', '#ffffff', 'M↓'],
  markdown: ['#42A5F5', '#ffffff', 'M↓'],
  txt: ['#90A4AE', '#ffffff', 'TXT'],
  text: ['#90A4AE', '#ffffff', 'TXT'],
  log: ['#90A4AE', '#ffffff', 'TXT'],
  pdf: ['#E5202B', '#ffffff', 'PDF'],
  doc: ['#2B579A', '#ffffff', 'DOC'],
  docx: ['#2B579A', '#ffffff', 'DOC'],
  xls: ['#217346', '#ffffff', 'XLS'],
  xlsx: ['#217346', '#ffffff', 'XLS'],
  ppt: ['#D24726', '#ffffff', 'PPT'],
  pptx: ['#D24726', '#ffffff', 'PPT'],
  // 配置 / 构建
  yml: ['#CB171E', '#ffffff', 'YML'],
  yaml: ['#CB171E', '#ffffff', 'YML'],
  toml: ['#8D6E63', '#ffffff', 'TOML'],
  ini: ['#546E7A', '#ffffff', 'CFG'],
  cfg: ['#546E7A', '#ffffff', 'CFG'],
  config: ['#546E7A', '#ffffff', 'CFG'],
  env: ['#F9A825', '#323330', 'ENV'],
  properties: ['#7B1FA2', '#ffffff', 'PROP'],
  lock: ['#37474F', '#ffffff', 'LOCK'],
  dockerfile: ['#2496ED', '#ffffff', 'DOCK'],
  docker: ['#2496ED', '#ffffff', 'DOCK'],
  makefile: ['#607D8B', '#ffffff', 'MAKE'],
  gradle: ['#02303A', '#ffffff', 'GRADLE'],
  cmake: ['#265774', '#ffffff', 'CMAKE'],
  ipynb: ['#F37726', '#ffffff', 'JNB'],
  // 脚本 / Shell
  sh: ['#89E051', '#111111', '>_'],
  bash: ['#89E051', '#111111', '>_'],
  zsh: ['#89E051', '#111111', '>_'],
  ps1: ['#012456', '#ffffff', 'PS1'],
  bat: ['#546E7A', '#ffffff', 'CMD'],
  cmd: ['#546E7A', '#ffffff', 'CMD'],
  // 打包 / 二进制
  zip: ['#FFA726', '#323330', 'ZIP'],
  tar: ['#FFA726', '#323330', 'ZIP'],
  gz: ['#FFA726', '#323330', 'ZIP'],
  '7z': ['#FFA726', '#323330', 'ZIP'],
  rar: ['#FFA726', '#323330', 'ZIP'],
  exe: ['#0078D4', '#ffffff', 'EXE'],
  msi: ['#0078D4', '#ffffff', 'EXE'],
  wasm: ['#654FF0', '#ffffff', 'WASM'],
  // 图片 / 媒体
  png: ['#8E44AD', '#ffffff', 'IMG'],
  jpg: ['#8E44AD', '#ffffff', 'IMG'],
  jpeg: ['#8E44AD', '#ffffff', 'IMG'],
  gif: ['#8E44AD', '#ffffff', 'IMG'],
  webp: ['#8E44AD', '#ffffff', 'IMG'],
  ico: ['#8E44AD', '#ffffff', 'IMG'],
  bmp: ['#8E44AD', '#ffffff', 'IMG'],
  // 版本控制
  gitignore: ['#F05032', '#ffffff', 'GIT'],
  gitattributes: ['#F05032', '#ffffff', 'GIT'],
}

/** One self-colored badge svg: rounded brand rect + short contrast mark.
 *  Mark font scales by length so 5-6 char marks (JAVA/SCALA/SWIFT) stay
 *  inside the 24×24 viewBox. */
const badgeIcon = ([bg, fg, mark], size) =>
  createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      'aria-hidden': 'true',
    },
    createElement('rect', { x: 1, y: 1, width: 22, height: 22, rx: 5, fill: bg }),
    createElement(
      'text',
      {
        x: 12,
        y: 16,
        textAnchor: 'middle',
        fontSize: mark.length <= 2 ? 9 : mark.length <= 4 ? 7 : 5.5,
        fontWeight: 700,
        fill: fg,
      },
      mark,
    ),
  )

/** File-type icon dispatcher: branded badge for known extensions, the
 *  neutral file icon for everything else (case-insensitive, tolerates a
 *  leading dot like ".md"). */
const fileIconByExt = (ext, size = 14) => {
  const spec =
    FILE_BADGES[
      String(ext ?? '')
        .toLowerCase()
        .replace(/^\./, '')
    ]
  return spec === undefined ? icon.file(size) : badgeIcon(spec, size)
}


    // ── 视图：思考块 + assistant-step 渲染器 ────────────────────────
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


    // ── 界面中文化：词表（纯数据）───────────────────────────────────
    /**
 * PART: 界面中文化词表（纯数据）。
 *
 * 由 scripts/build.mjs 拼入 lib/client.js 的 factory 作用域（纯数据声明，
 * 无 import/export）。内容与拆分前完全一致：zh-localize 片段与纯函数导出
 * （zhToolName / zhToolDesc / zhCardTitle / zhCardSummary）依赖这些表。
 */

// ── 界面标签中文化：词表 + 精准文本节点替换 ────────────────────────
// 只替换「完全等于」词表 key 的叶子文本节点；排除代码块/输入区/脚本区，
// 避免误伤消息正文与代码内容。词条来自官方 UI 的 zh 字典缺译与硬编码英文
// （dsh-client-ui-trajectory 的 Thinking/Tool Call/ASSISTANT 等、
// dsh-client-ui-conversation 的 context.tools/stats.toolCall 等）。
const ZH_TABLE = {
  Thinking: '思考',
  'Tool Call': '工具调用',
  'Tool calls': '工具调用',
  'Tool call': '工具调用',
  'Tool call only': '仅工具调用',
  Tools: '工具',
  'No content': '无内容',
  'Tools Updated': '工具已更新',
  Duration: '用时',
  'Use actual duration': '使用实际耗时',
  'Use equal-width operations': '使用等宽操作',
  Turns: '轮次',
  'Expand turns': '展开轮次',
  'Collapse turns': '收起轮次',
  Calls: '调用',
  'Expand calls': '展开调用',
  'Collapse calls': '收起调用',
  'Load earlier history': '加载更早历史',
  'Loading earlier history…': '正在加载更早历史…',
  'Loading earlier history': '正在加载更早历史',
  ASSISTANT: '助手',
  TOOL: '工具',
  USER: '用户',
  'Session log': '会话日志',
  'Cordis Plugin': 'Cordis 插件',
  'System prompt': '系统提示',
  Messages: '消息',
  Files: '文件',
  'Full access': '完全访问',
  'Enable Full access': '启用完全访问',
  Cancel: '取消',
}

// 动态格式（保持原始数字/单位，只翻译标签词）
const ZH_PATTERNS = [
  [/^Turn (\d+)$/, '第 $1 轮'],
  [/^Tool call (.+)$/, '工具调用 $1'],
  [/^Input ([\d.]+) tok · Output ([\d.]+) tok$/, '输入 $1 tok · 输出 $2 tok'],
  [/^LLM (.+)$/, '模型调用 $1'],
]

/** 这些标签内部的文本一律不动（代码、输入、脚本）。 */
const ZH_SKIP_TAGS = new Set(['PRE', 'CODE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'KBD', 'SAMP'])

// ── 工具卡片标题中文化 ─────────────────────────────────────────────
// 官方 dsh-client-ui-tool 的工具卡片标题是硬编码英文（VARIANT_TITLES /
// TOOL_TITLES，源码注释 "design literals, not translatable copy"，无 i18n
// 路径）：web_search 卡片显示 "Search"、bash 显示 "Bash"、read 显示
// "Read"、cordis 工具显示 "Inspect" / "Run Cordis Plugin" 等。
// 这些词只允许在「工具调用卡片行」内替换（行根带 data-chat-call-id），
// 不参与全局词表，避免误伤消息正文。
const CARD_TITLE_ZH = {
  Search: '搜索',
  Read: '读取',
  Bash: '命令行',
  Write: '写入',
  Edit: '编辑',
  Code: '代码',
  Inspect: '检查',
  'Run Cordis Plugin': '运行 Cordis 插件',
  'Stop Cordis Plugin': '停止 Cordis 插件',
  'Remove Cordis Plugin': '移除 Cordis 插件',
}

// ── 工具名中文化（轨迹视图 Tool Catalog 的 tool.name）───────────────
// Tool Catalog 直接渲染工具的英文 id（web_search / bash / read …）。
// 工具名是动态数据，静态词表覆盖不了，必须按「工具名 → 中文名」映射。
// 未覆盖的工具保留英文原名。
const TOOL_NAME_ZH = {
  // 基础工具
  web_search: '网络搜索',
  bash: '命令行',
  read: '读取文件',
  write: '写入文件',
  edit: '编辑文件',
  glob: '搜索文件',
  grep: '搜索内容',
  read_image: '读取图片',
  skill: '技能',
  workflow: '工作流',
  subagent: '子代理',
  subagent_fork: '子代理（继承）',
  todo_write: '任务清单',
  ask_user_question: '询问用户',
  exit_plan_mode: '退出计划模式',
  // 目标与任务
  create_goal: '创建目标',
  get_goal: '查看目标',
  update_goal: '更新目标',
  job_list: '任务列表',
  job_output: '任务输出',
  job_kill: '终止任务',
  // 代理
  list_agents: '代理列表',
  send_message: '发送消息',
  interrupt_agent: '中断代理',
  // Cordis 插件
  cordis_define: '定义插件',
  cordis_run: '运行插件',
  cordis_stop: '停止插件',
  cordis_undefine: '删除插件',
  cordis_inspect_list: '查看提供者',
  cordis_inspect_query: '查询提供者',
  cordis_inspect_self: '查看自身',
  // 代码库记忆（codebase-memory）
  'mcp__codebase-memory__check_index_coverage': '检查索引覆盖',
  'mcp__codebase-memory__delete_project': '删除项目',
  'mcp__codebase-memory__detect_changes': '变更影响分析',
  'mcp__codebase-memory__get_architecture': '架构总览',
  'mcp__codebase-memory__get_code_snippet': '代码片段',
  'mcp__codebase-memory__get_graph_schema': '图结构',
  'mcp__codebase-memory__index_repository': '索引仓库',
  'mcp__codebase-memory__index_status': '索引状态',
  'mcp__codebase-memory__ingest_traces': '导入运行时轨迹',
  'mcp__codebase-memory__list_projects': '项目列表',
  'mcp__codebase-memory__manage_adr': '架构决策记录',
  'mcp__codebase-memory__query_graph': '图查询',
  'mcp__codebase-memory__search_code': '代码搜索',
  'mcp__codebase-memory__search_graph': '图搜索',
  'mcp__codebase-memory__trace_path': '调用路径追踪',
  // AgentTeams
  agent_teams_add_member: '添加成员',
  agent_teams_claim_task: '认领任务',
  agent_teams_create: '创建团队',
  agent_teams_create_task: '创建任务',
  agent_teams_delete: '删除团队',
  agent_teams_reassign_task: '重新指派任务',
  agent_teams_remove_member: '移除成员',
  agent_teams_send_message: '团队消息',
  agent_teams_status: '团队状态',
  agent_teams_update_task: '更新任务',
  vision_toolkit_activate: '激活视觉工具',
}

// ── 工具描述中文化（Tool Catalog 的 tool.description）───────────────
// 按「工具名 → 中文描述」索引，不匹配英文原文：DSH 升级导致描述文案
// 变化时映射不失效。未覆盖的工具保留英文描述。
const TOOL_DESC_ZH = {
  web_search: '搜索网络获取最新信息。',
  bash: '执行命令并返回输出（可设置工作目录、超时）。',
  read: '读取 UTF-8 文本文件并返回带行号的内容。',
  write: '创建或完整替换一个 UTF-8 文本文件。',
  edit: '对现有文本文件做精确的局部替换修改。',
  glob: '按路径模式查找文件，包含隐藏与忽略文件。',
  grep: '用正则搜索文件内容并返回匹配行。',
  read_image: '读取图片文件并返回图片本身。',
  skill: '加载指定技能（skill）的完整指令。',
  workflow: '编写脚本编排多个子代理，并行扇出执行。',
  subagent: '把独立任务委托给后台子代理。',
  subagent_fork: '把任务委托给继承当前对话上下文的子代理。',
  todo_write: '记录并更新当前工作的结构化任务清单。',
  ask_user_question: '需要确认、选择或补充信息时向用户提问。',
  exit_plan_mode: '呈现完整计划并退出计划模式。',
  create_goal: '创建持久化的同会话完成目标。',
  get_goal: '读取当前目标的准确 id 与状态。',
  update_goal: '更新目标的执行状态、暂停或恢复。',
  job_list: '列出当前启动的后台任务。',
  job_output: '读取后台任务的输出。',
  job_kill: '请求终止运行中的后台任务。',
  list_agents: '按持久 id 列出可续接的后台子代理。',
  send_message: '向后台子代理发送消息，继续其同一对话。',
  interrupt_agent: '请求中断后台代理的当前轮次。',
  cordis_define: '定义新的不可变 Cordis 插件包（不运行）。',
  cordis_run: '启动或更新 Cordis 插件包。',
  cordis_stop: '停止当前 Cordis 插件并保留定义。',
  cordis_undefine: '永久删除 Cordis 插件及其所有包。',
  cordis_inspect_list: '列出当前已知的检查提供者。',
  cordis_inspect_query: '执行检查提供者的只读查询。',
  cordis_inspect_self: '查看当前会话的插件、包与诊断。',
  'mcp__codebase-memory__check_index_coverage': '检查文件的索引覆盖情况。',
  'mcp__codebase-memory__delete_project': '把项目从索引中删除。',
  'mcp__codebase-memory__detect_changes': '把 git 变更映射为影响半径。',
  'mcp__codebase-memory__get_architecture': '获取项目高层架构总览。',
  'mcp__codebase-memory__get_code_snippet': '读取函数或类的源码。',
  'mcp__codebase-memory__get_graph_schema': '获取知识图谱的节点与边类型。',
  'mcp__codebase-memory__index_repository': '把仓库索引进知识图谱。',
  'mcp__codebase-memory__index_status': '查看项目索引状态与覆盖报告。',
  'mcp__codebase-memory__ingest_traces': '导入运行时调用轨迹。',
  'mcp__codebase-memory__list_projects': '列出已索引的项目。',
  'mcp__codebase-memory__manage_adr': '创建或更新架构决策记录。',
  'mcp__codebase-memory__query_graph': '执行 Cypher 图查询。',
  'mcp__codebase-memory__search_code': '图增强的代码搜索。',
  'mcp__codebase-memory__search_graph': '按关键词、正则或语义搜索代码图谱。',
  'mcp__codebase-memory__trace_path': '追踪调用链、数据流与跨服务路径。',
  agent_teams_add_member: '向团队添加可续命的成员。',
  agent_teams_claim_task: '为团队成员认领一个就绪任务。',
  agent_teams_create: '创建多代理团队，你成为队长。',
  agent_teams_create_task: '在团队创建任务并关联依赖。',
  agent_teams_delete: '删除团队：中断成员并移除状态。',
  agent_teams_reassign_task: '重试、重新指派任务或由队长接管。',
  agent_teams_remove_member: '安全移除成员并回收任务。',
  agent_teams_send_message: '给队长或团队成员发送消息。',
  agent_teams_status: '查看团队快照：成员与任务状态。',
  agent_teams_update_task: '更新任务状态或产出摘要。',
  vision_toolkit_activate: '激活视觉工具集。',
}


    // ── 界面中文化：DOM 精准替换逻辑 + 纯函数导出 ──────────────────
    /**
 * PART: 界面中文化 DOM 精准替换逻辑 + 纯函数导出。
 *
 * 由 scripts/build.mjs 拼入 lib/client.js 的 factory 作用域（纯函数声明
 * 文本，无 import/export）。依赖 factory 内的 ZH_TABLE / ZH_PATTERNS /
 * ZH_SKIP_TAGS / CARD_TITLE_ZH / TOOL_NAME_ZH / TOOL_DESC_ZH 词表与
 * document / MutationObserver。行为与拆分前等价：只替换「完全等于」词表
 * key 的叶子文本节点，排除代码块/输入区/脚本区，MutationObserver 跟随
 * React 重渲染持续生效，fiber teardown 时断开观察器。
 */

/** 祖先链上是否命中「内容一律不动」的标签（代码、输入、脚本）。 */
function inSkipped(element) {
  let node = element
  while (node && node.nodeType === 1) {
    if (ZH_SKIP_TAGS.has(node.nodeName)) return true
    node = node.parentElement
  }
  return false
}

/** 工具调用卡片行（对话 / 轨迹均带 data-chat-call-id 行根）。 */
function inToolCallRow(element) {
  let node = element
  while (node && node.nodeType === 1) {
    if (node.hasAttribute && node.hasAttribute('data-chat-call-id')) return true
    node = node.parentElement
  }
  return false
}

/** 轨迹视图 Tool Catalog 容器内。 */
function inToolCatalog(element) {
  let node = element
  while (node && node.nodeType === 1) {
    const cls = node.className
    if (typeof cls === 'string' && cls.indexOf('toolCatalog') !== -1) return true
    node = node.parentElement
  }
  return false
}

/** 最近的 Tool Catalog 条目（details.toolCatalogItem）。 */
function catalogItemOf(element) {
  let node = element
  while (node && node.nodeType === 1) {
    const cls = node.className
    if (typeof cls === 'string' && cls.indexOf('toolCatalogItem') !== -1) return node
    node = node.parentElement
  }
  return null
}

/** 把 Tool Catalog 条目的描述元素替换为中文描述。 */
function localizeCatalogDesc(item, zhDesc) {
  const descEls = item.querySelectorAll('[class*="toolCatalogDescription"], [class*="toolCatalogFullDescription"]')
  for (const el of descEls) {
    if (el.firstChild && el.firstChild.nodeType === 3) {
      el.firstChild.nodeValue = zhDesc
    }
  }
}

/** 把 `${工具名} parameters JSON` 标签 → `${中文名} 参数 JSON`。 */
function localizeParamsJsonLabel(item) {
  const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT)
  let t
  while ((t = walker.nextNode()) !== null) {
    const v = String(t.nodeValue)
    if (v.indexOf(' parameters JSON') !== -1) {
      t.nodeValue = v.replace(' parameters JSON', ' 参数 JSON')
    }
  }
}

/**
 * 整体中文化一个 Tool Catalog 条目：工具名（toolCatalogName）、描述
 * （toolCatalogDescription / toolCatalogFullDescription）、参数 JSON 标签
 * （`${tool.name} parameters JSON`）。描述按工具名索引，不依赖英文原文。
 * localizedItems 为「已整体处理过的条目」集合（React 重建后新元素不在
 * 集合内，会重新处理）。
 */
function localizeCatalogItem(item, localizedItems) {
  if (localizedItems.has(item)) return
  localizedItems.add(item)
  const nameEl = item.querySelector('[class*="toolCatalogName"]')
  if (!nameEl || !nameEl.firstChild || nameEl.firstChild.nodeType !== 3) return
  const nameNode = nameEl.firstChild
  const en = String(nameNode.nodeValue).trim()
  const zhName = TOOL_NAME_ZH[en]
  if (zhName === undefined) return
  nameNode.nodeValue = String(nameNode.nodeValue).replace(en, zhName)
  const zhDesc = TOOL_DESC_ZH[en]
  if (zhDesc !== undefined) localizeCatalogDesc(item, zhDesc)
  localizeParamsJsonLabel(item)
}

/** 工具卡片变体标题（CARD_TITLE_ZH 精确匹配）；命中则替换并返回 true。 */
function tryCardTitle(textNode, trimmed) {
  const cardTitle = CARD_TITLE_ZH[trimmed]
  if (cardTitle === undefined) return false
  textNode.nodeValue = textNode.nodeValue.replace(trimmed, cardTitle)
  return true
}

/** others 变体摘要 `工具名 · …` 的工具名前缀替换；未映射时返回 false。 */
function trySummaryPrefix(textNode, trimmed) {
  const m = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_]*) · /)
  if (!m || TOOL_NAME_ZH[m[1]] === undefined) return false
  textNode.nodeValue = textNode.nodeValue.replace(m[1], TOOL_NAME_ZH[m[1]])
  return true
}

/** 全局词表精确匹配（ZH_TABLE）；命中则替换并返回 true。 */
function tryExactText(textNode, trimmed) {
  const exact = ZH_TABLE[trimmed]
  if (exact === undefined) return false
  textNode.nodeValue = textNode.nodeValue.replace(trimmed, exact)
  return true
}

/** 动态格式匹配（ZH_PATTERNS，保持原始数字/单位）；命中则替换并返回 true。 */
function tryPatternText(textNode, trimmed) {
  for (const [pattern, replacement] of ZH_PATTERNS) {
    if (pattern.test(trimmed)) {
      textNode.nodeValue = textNode.nodeValue.replace(pattern, replacement)
      return true
    }
  }
  return false
}

/** 工具调用卡片行内的翻译（变体标题优先，其次 others 摘要工具名前缀）。 */
function translateToolCallText(textNode, trimmed) {
  if (tryCardTitle(textNode, trimmed)) return true
  return trySummaryPrefix(textNode, trimmed)
}

/** 翻译单个文本节点（词表/动态格式/卡片/条目），不匹配则不动。 */
function translateTextNode(textNode, localizedItems) {
  const raw = textNode.nodeValue
  if (typeof raw !== 'string' || raw === '') return
  const trimmed = raw.trim()
  if (trimmed === '') return
  if (inSkipped(textNode.parentElement)) return
  if (inToolCallRow(textNode.parentElement)) {
    translateToolCallText(textNode, trimmed)
    return
  }
  if (inToolCatalog(textNode.parentElement)) {
    const item = catalogItemOf(textNode.parentElement)
    if (item) {
      localizeCatalogItem(item, localizedItems)
      return
    }
  }
  if (tryExactText(textNode, trimmed)) return
  tryPatternText(textNode, trimmed)
}

/**
 * 安装界面中文化：扫描现有文本节点 + MutationObserver 跟随 React 重渲染。
 * 返回 disposer（断开观察器）。
 */
function installUiLocalize() {
  if (typeof document === 'undefined' || document === null || typeof MutationObserver === 'undefined') return () => {}

  /** 已整体处理过的 Tool Catalog 条目（React 重建后新元素不在集合内，会重新处理）。 */
  const localizedItems = new WeakSet()

  const scan = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const hits = []
    let node
    while ((node = walker.nextNode()) !== null) hits.push(node)
    for (const hit of hits) translateTextNode(hit, localizedItems)
  }

  scan(document.body)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData' && mutation.target.nodeType === 3) {
        translateTextNode(mutation.target, localizedItems)
      } else if (mutation.type === 'childList') {
        for (const added of mutation.addedNodes) {
          if (added.nodeType === 1) scan(added)
          else if (added.nodeType === 3) translateTextNode(added, localizedItems)
        }
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  return () => observer.disconnect()
}

// ── 纯函数导出（供纯 Node 测试断言映射，不依赖 DOM）─────────────────
exports.zhToolName = (name) => TOOL_NAME_ZH[name] ?? null
exports.zhToolDesc = (name) => TOOL_DESC_ZH[name] ?? null
exports.zhCardTitle = (title) => CARD_TITLE_ZH[title] ?? null
/** others 卡片摘要 `工具名 · …` 的工具名前缀替换；不匹配时返回 null。 */
exports.zhCardSummary = (text) => {
  const m = String(text).match(/^([a-zA-Z][a-zA-Z0-9_]*) · /)
  if (m && TOOL_NAME_ZH[m[1]] !== undefined) return String(text).replace(m[1], TOOL_NAME_ZH[m[1]])
  return null
}


    // ── 插件入口：样式注入 + 渲染器替换 + UI 中文化 ────────────────
    /**
 * PART: 插件入口（样式常量 + slots 注册 + UI 中文化装配）。
 *
 * 由 scripts/build.mjs 拼入 lib/client.js 的 factory 作用域（纯函数声明
 * 文本，无 import/export）。依赖 factory 内的 createElement、
 * AssistantStepView 与 installUiLocalize。行为与拆分前等价：样式随
 * activation 注入、fiber teardown 卸载；assistant-step 渲染器以 priority
 * -1 替换内置（0）；UI 中文化随 fiber 卸载断开观察器。
 */

// ── 样式（DSH 语义 token，随 activation 注入）───────────────────
// 仅保留本插件职责相关样式（assistant 容器 / 思考块 / 已停止标记）；
// MarkdownView 的渲染样式（.tzx-md 系列）已随 issue #31 迁移至
// dsh-md-render（其 styles.part.js 注入）。
// issue #54 UI 翻新：类名统一 dsh-think-zh-expand- 前缀；思考块卡片化
// （圆角/边框/背景走语义 token），标题行折叠箭头 chevronRight 旋转过渡、
// 思考图标 clock 品牌色、流式「生成中」徽章脉冲动画、行入场动画。
// issue #57 思考/回复一眼可辨：思考内容（MarkdownView 的 .tzx-md）覆盖为
// 浅灰 tertiary + 斜体 + 略小字号，与正式回复（主色正体）明显区分；给思考
// 块加左侧 accent 强调线增强辨识度。代码块/引用保留正体与语义色以保可读。
const STYLES = `
.dsh-think-zh-expand-assistant{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary);font-size:16px;line-height:28px}
.dsh-think-zh-expand-assistant-body{display:flex;flex-direction:column;gap:16px}
.dsh-think-zh-expand-think{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;animation:dsh-think-zh-expand-row-in 150ms var(--ds-ease-in-out)}
/* #57 思考块左侧 brand 强调线：与正式回复（无卡片/无竖线）一眼区分。 */
.dsh-think-zh-expand-think{border-left:3px solid color-mix(in srgb,var(--dsw-alias-accent) 45%,var(--dsw-alias-border-l1))}
.dsh-think-zh-expand-think[data-state='running']{border-color:color-mix(in srgb,var(--dsw-alias-accent) 35%,var(--dsw-alias-border-l1))}
.dsh-think-zh-expand-think-head{display:flex;align-items:center;gap:6px;min-width:0;cursor:pointer;user-select:none;padding:6px 10px;border-radius:8px;transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-think-zh-expand-think-head:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-think-zh-expand-think-head:active{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-think-zh-expand-think-head:focus-visible{outline:2px solid var(--dsw-alias-accent);outline-offset:-2px}
.dsh-think-zh-expand-think-chevron{flex:none;display:flex;align-items:center;color:var(--dsw-alias-label-tertiary);transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-think-zh-expand-think-chevron-open{transform:rotate(90deg)}
.dsh-think-zh-expand-think-icon{flex:none;display:flex;align-items:center;color:var(--dsw-alias-accent)}
.dsh-think-zh-expand-think-title{flex:none;font:var(--dsw-font-s-strong-14);color:var(--dsw-alias-label-secondary)}
.dsh-think-zh-expand-think-badge{flex:none;display:inline-flex;align-items:center;gap:4px;height:17px;padding:0 6px;border-radius:4px;font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-accent);background:color-mix(in srgb,var(--dsw-alias-accent) 12%,transparent)}
.dsh-think-zh-expand-think-badge::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;animation:dsh-think-zh-expand-pulse 1.2s var(--ds-ease-in-out) infinite}
.dsh-think-zh-expand-think-summary{min-width:0;flex:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary)}
.dsh-think-zh-expand-think-body{min-width:0;padding:2px 10px 10px;font-size:14px;line-height:24px;color:var(--dsw-alias-label-tertiary)}
/* #57 思考与回复一眼可辨：MarkdownView 的 .tzx-md 在容器内直接声明
   color:var(--dsw-alias-label-primary)（正文主色），元素自身声明优先于祖先
   继承值，会覆盖上面 think-body 的浅灰，导致思考/回复文字颜色几乎一致。
   按更高优先级重设思考内容的颜色/斜体/略小字号，与正式回复（主色正体）
   区分；代码块与引用保留正体与语义色，保证思考内的 Markdown 仍可读。 */
.dsh-think-zh-expand-think-body .tzx-md{font-size:13px;font-style:italic;color:var(--dsw-alias-label-tertiary)}
.dsh-think-zh-expand-think-body .tzx-md .tzx-pre,
.dsh-think-zh-expand-think-body .tzx-md .tzx-bq{font-style:normal;color:var(--dsw-alias-label-secondary)}
.dsh-think-zh-expand-stopped{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);border-radius:6px;align-self:flex-start;padding:0 6px;font:var(--dsw-font-xxxs-11);line-height:18px}
@keyframes dsh-think-zh-expand-row-in{from{opacity:0;transform:translateY(1px)}to{opacity:1;transform:none}}
@keyframes dsh-think-zh-expand-pulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
    `

exports.inject = ['slots']

// ── 插件入口：样式注入 + 渲染器替换 + UI 中文化 ────────────────
exports.apply = function apply(ctx) {
  // Inject the shared stylesheet once (torn down with the fiber).
  ctx.effect(() => {
    if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') return () => {}
    const style = document.createElement('style')
    style.setAttribute('data-dsh-think-zh-expand', 'styles')
    style.textContent = STYLES
    document.head.appendChild(style)
    return () => {
      if (style.parentNode) style.parentNode.removeChild(style)
    }
  }, 'dsh-think-zh-expand: styles')

  // Replace the built-in assistant-step renderer: register with a lower
  // priority than the shipped occupant (0) so this entry wins the keyed
  // dispatch, exactly like dsh-better-sidebar shadows built-in seats.
  ctx.effect(
    () =>
      ctx.slots.inject('conversation.chat.node', () =>
        ctx.slots.register(
          {
            name: 'conversation.chat.node',
            key: 'assistant-step',
            priority: -1,
            registrant: 'dsh-think-zh-expand',
          },
          (props) => createElement(AssistantStepView, props),
        ),
      ),
    'dsh-think-zh-expand: assistant-step renderer',
  )

  // UI 标签中文化（词表替换，随 fiber 卸载断开观察器）。
  ctx.effect(() => installUiLocalize(), 'dsh-think-zh-expand: ui localization')
}


    return module.exports
  },
})
