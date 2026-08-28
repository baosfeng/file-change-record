/**
 * dsh-my-observability — client half (browser). SOURCE TEMPLATE.
 *
 * 提供两个侧边栏页签：
 *  - 轨迹回放（dsh-my-observability:replay）：按时间轴查看 agent 行为
 *    （agent 状态 / 模型流 / 工具调用与结果），支持会话切换与类型过滤，
 *    数据来自 server 端事件审计（/observability/api/events）；
 *  - Git 工具 + 增量 diff 审查（dsh-my-observability:git）：仓库状态与
 *    差异查看、类型化提交（Conventional Commits）、提交前规则引擎 +
 *    可选 AI 审查（/observability/api/git/* 与 /observability/api/review）。
 *
 * 面板可见（visible）时轮询（REPLAY_POLL_MS），隐藏时暂停（省请求）。
 * 样式走 DSH 语义 token（--dsw-alias-* / --dsw-font-*），随 activation
 * 注入、fiber teardown 卸载（HMR/禁用无残留）。
 *
 * BUILD NOTE: 本文件是模板源码，不是 DSH 实际服务的文件。scripts/build.mjs
 * 将片段文件（lib/parts/i18n.js / replay.js / git.js / styles.js，均为
 * 无 import/export 的纯函数声明文本；图标片段来自 dsh-shared 共享
 * client-parts，见 docs/UI规范.md）经下方 __PART_*__ 占位符（函数式
 * replaceAll，避免 $&/$1 特殊解释）拼接进 factory 作用域，写出
 * lib/client.js —— 即 DSH 实际服务的产物。产物必须提交；CI 只对产物执行
 * node --check（见 scripts/test-all.sh / .github/workflows/ci.yml）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-my-observability',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useEffect, useState } = require('react')

    // ── parts（scripts/build.mjs 拼接；顺序固定）───────────────────────
    // ── i18n（浏览器语言判定）──────────────────────────────────────────
function isZh() {
  try {
    const lang = (navigator.language || 'en').toLowerCase()
    return lang.startsWith('zh')
  } catch {
    return false
  }
}

const strings = {
  replayTitle: () => (isZh() ? '轨迹回放' : 'Trajectory'),
  gitTitle: () => (isZh() ? 'Git 工具' : 'Git Tools'),
  allSessions: () => (isZh() ? '全部会话' : 'All sessions'),
  filterAll: () => (isZh() ? '全部' : 'All'),
  filterStatus: () => (isZh() ? '状态' : 'Status'),
  filterLlm: () => (isZh() ? '模型流' : 'LLM'),
  filterTools: () => (isZh() ? '工具' : 'Tools'),
  emptyEvents: () => (isZh() ? '暂无审计事件' : 'No audit events yet'),
  emptyEventsHint: () =>
    isZh()
      ? '开始一段对话后，agent 的状态、模型流与工具调用会按时间记录在这里'
      : 'Start a conversation — agent status, LLM streams and tool calls are recorded here in time order',
  refresh: () => (isZh() ? '刷新' : 'Refresh'),
  retry: () => (isZh() ? '重试' : 'Retry'),
  loadError: () => (isZh() ? '加载失败' : 'Load failed'),
  typeAgentStatus: () => (isZh() ? 'agent 状态' : 'agent status'),
  typeLlmStream: () => (isZh() ? '模型流' : 'LLM stream'),
  typeToolCall: () => (isZh() ? '工具调用' : 'tool call'),
  typeToolResult: () => (isZh() ? '工具结果' : 'tool result'),
  phaseStart: () => (isZh() ? '开始' : 'start'),
  phaseEnd: () => (isZh() ? '结束' : 'end'),
  phaseError: () => (isZh() ? '错误' : 'error'),
  agentTop: () => (isZh() ? '顶层' : 'top'),
  agentSub: () => (isZh() ? '子代理' : 'subagent'),
  agentUnknown: () => (isZh() ? '未知' : 'unknown'),
  toolOk: () => (isZh() ? '成功' : 'ok'),
  toolFail: () => (isZh() ? '失败' : 'failed'),
  // Git 面板
  repoLabel: () => (isZh() ? '仓库路径' : 'Repo path'),
  repoPlaceholder: () => (isZh() ? '如 /path/to/project' : 'e.g. /path/to/project'),
  loadRepo: () => (isZh() ? '加载' : 'Load'),
  branch: () => (isZh() ? '分支' : 'Branch'),
  staged: () => (isZh() ? '已暂存' : 'staged'),
  unstaged: () => (isZh() ? '未暂存' : 'unstaged'),
  clean: () => (isZh() ? '工作区干净' : 'Working tree clean'),
  diffTitle: () => (isZh() ? '差异' : 'Diff'),
  showDiff: () => (isZh() ? '查看差异' : 'Show diff'),
  showStagedDiff: () => (isZh() ? '查看暂存差异' : 'Staged diff'),
  noChanges: () => (isZh() ? '没有变更' : 'No changes'),
  review: () => (isZh() ? '提交前审查' : 'Review'),
  reviewAi: () => (isZh() ? 'AI 审查' : 'AI review'),
  reviewResult: () => (isZh() ? '审查结果' : 'Review result'),
  reviewPass: () => (isZh() ? '未发现问题' : 'No issues found'),
  issues: (count) => (isZh() ? `${count} 个问题` : `${count} issue(s)`),
  commitTitle: () => (isZh() ? '类型化提交' : 'Typed commit'),
  commitType: () => (isZh() ? '类型' : 'Type'),
  commitScope: () => (isZh() ? '范围（可选）' : 'Scope (optional)'),
  commitDesc: () => (isZh() ? '描述' : 'Description'),
  commitBody: () => (isZh() ? '正文（可选）' : 'Body (optional)'),
  commit: () => (isZh() ? '提交' : 'Commit'),
  committed: () => (isZh() ? '已提交' : 'Committed'),
  commitError: () => (isZh() ? '提交失败' : 'Commit failed'),
  severityError: () => (isZh() ? '错误' : 'Error'),
  severityWarning: () => (isZh() ? '警告' : 'Warning'),
  severityInfo: () => (isZh() ? '提示' : 'Info'),
  aiVerdictApprove: () => (isZh() ? 'AI 结论：可以提交' : 'AI verdict: approve'),
  aiVerdictChanges: () => (isZh() ? 'AI 结论：建议修改' : 'AI verdict: changes'),
  aiFailed: () => (isZh() ? 'AI 审查不可用' : 'AI review unavailable'),
  loading: () => (isZh() ? '加载中…' : 'Loading…'),
  emptyDiff: () => (isZh() ? '（空）' : '(empty)'),
  noRepo: () => (isZh() ? '请输入仓库路径' : 'Enter a repo path'),
}

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

    // ── 轨迹回放面板（时间轴）──────────────────────────────────────────
const REPLAY_POLL_MS = 5000

/** 请求插件 API（非 2xx 抛错；返回响应 JSON 的 value 字段）。 */
function apiJson(path, options) {
  return fetch(path, options).then(async (res) => {
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`)
    return data.value
  })
}

/** 事件类型 → 中文标签。 */
function typeLabel(event) {
  switch (event.type) {
    case 'agent_status':
      return strings.typeAgentStatus()
    case 'llm_stream':
      return strings.typeLlmStream()
    case 'tool_call':
      return strings.typeToolCall()
    case 'tool_result':
      return strings.typeToolResult()
    default:
      return event.type
  }
}

/** 事件类型 → 视觉类别（徽标/图标/节点共用，颜色语义一致）：
 *  status=info / llm=warn / call=accent / result=success / fail=danger。 */
function typeKind(event) {
  if (event.type === 'agent_status') return 'status'
  if (event.type === 'llm_stream') return 'llm'
  if (event.type === 'tool_call') return 'call'
  return event.data?.ok === false ? 'fail' : 'result'
}

/** 事件类型 → 类型图标（共享线性图标集，stroke=currentColor）。 */
function typeIcon(event) {
  const kind = typeKind(event)
  if (kind === 'status') return icon.clock(15)
  if (kind === 'llm') return icon.file(15)
  if (kind === 'call') return icon.external(15)
  if (kind === 'fail') return icon.close(15)
  return icon.check(15)
}

/** 时间戳 → HH:MM:SS。 */
function timeText(time) {
  try {
    const date = new Date(time)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  } catch {
    return ''
  }
}

/** agent 类型标记 → 中文。 */
function agentTypeText(agentType) {
  if (agentType === 'top') return strings.agentTop()
  if (agentType === 'subagent') return strings.agentSub()
  return strings.agentUnknown()
}

/** 模型流阶段 → 中文。 */
function phaseText(phase) {
  if (phase === 'start') return strings.phaseStart()
  if (phase === 'end') return strings.phaseEnd()
  if (phase === 'error') return strings.phaseError()
  return phase
}

/** agent 状态事件摘要。 */
function agentMeta(data) {
  return `状态 ${data.status} · ${agentTypeText(data.agentType)}`
}

/** 模型流事件摘要（开始/结束/错误 + 统计）。 */
function llmMeta(data) {
  const stats = data.phase === 'start' ? '' : ` · ${data.chunks} chunks / ${data.chars} chars / ${data.ms}ms`
  const error = data.message !== undefined ? `：${data.message}` : ''
  return `${phaseText(data.phase)}${stats}${error}`
}

/** 工具调用事件摘要（名称 + 参数摘要）。 */
function toolCallMeta(data) {
  const args = data.args && data.args.summary !== undefined ? ` — ${data.args.summary}` : ''
  return `${data.name}${args}`
}

/** 工具结果事件摘要（名称 + 成败 + 耗时）。 */
function toolResultMeta(data) {
  const result = data.ok === false ? strings.toolFail() : strings.toolOk()
  return `${data.name} · ${result} · ${data.ms}ms`
}

/** 事件 → 摘要文本（单行，尽力而为）。 */
function eventMeta(event) {
  const data = event.data || {}
  if (event.type === 'agent_status') return agentMeta(data)
  if (event.type === 'llm_stream') return llmMeta(data)
  if (event.type === 'tool_call') return toolCallMeta(data)
  if (event.type === 'tool_result') return toolResultMeta(data)
  return ''
}

/** 单条事件行：节点圆点 + 类型图标 + 徽标/时间 + 摘要（hover/active 反馈）。 */
function EventRow({ event }) {
  const meta = eventMeta(event)
  const kind = typeKind(event)
  return createElement(
    'button',
    { className: 'dsh-my-observability-event', type: 'button' },
    createElement('span', { className: `dsh-my-observability-node dsh-my-observability-node-${kind}` }),
    createElement(
      'span',
      { className: `dsh-my-observability-event-icon dsh-my-observability-icon-${kind}` },
      typeIcon(event),
    ),
    createElement(
      'span',
      { className: 'dsh-my-observability-event-body' },
      createElement(
        'span',
        { className: 'dsh-my-observability-event-head' },
        createElement(
          'span',
          { className: `dsh-my-observability-badge dsh-my-observability-badge-${kind}` },
          typeLabel(event),
        ),
        createElement('span', { className: 'dsh-my-observability-time' }, timeText(event.time)),
      ),
      meta !== '' ? createElement('span', { className: 'dsh-my-observability-event-meta' }, meta) : null,
    ),
  )
}

/** 类型过滤按钮组（aria-pressed 选中态）。 */
function TypeFilter({ filter, onFilter }) {
  const options = [
    ['', strings.filterAll()],
    ['agent_status', strings.filterStatus()],
    ['llm_stream', strings.filterLlm()],
    ['tool', strings.filterTools()],
  ]
  return createElement(
    'div',
    { className: 'dsh-my-observability-filters' },
    options.map(([value, label]) =>
      createElement(
        'button',
        {
          key: value,
          type: 'button',
          className: `dsh-my-observability-chip${filter === value ? ' dsh-my-observability-chip-active' : ''}`,
          'aria-pressed': filter === value,
          onClick: () => onFilter(value),
        },
        label,
      ),
    ),
  )
}

/** 按过滤条件筛选事件（tool = tool_call + tool_result）。 */
function filterEvents(events, filter) {
  if (filter === '') return events
  return events.filter((event) =>
    filter === 'tool' ? event.type === 'tool_call' || event.type === 'tool_result' : event.type === filter,
  )
}

/** 拉取会话列表与事件（选中为空时自动选当前/首个会话）。 */
async function loadReplayData(selected, currentSession, setters) {
  try {
    const list = await apiJson('/observability/api/sessions')
    setters.setSessions(list)
    if (selected === '' && list.length > 0) {
      const preferred = list.some((s) => s.sessionId === currentSession) ? currentSession : list[0].sessionId
      setters.setSelected(preferred)
      return
    }
    const query =
      selected !== ''
        ? `/observability/api/events?sessionId=${encodeURIComponent(selected)}&limit=300`
        : '/observability/api/events?limit=0'
    setters.setEvents(await apiJson(query))
    setters.setError('')
  } catch (err) {
    setters.setError(err instanceof Error ? err.message : String(err))
  } finally {
    setters.setLoading(false)
  }
}

/** 工具栏：会话选择 + 手动刷新 + 类型过滤。 */
function ReplayToolbar({ sessions, selected, onSelect, filter, onFilter, onRefresh }) {
  return createElement(
    'div',
    { className: 'dsh-my-observability-toolbar' },
    createElement(
      'div',
      { className: 'dsh-my-observability-toolbar-row' },
      createElement(
        'select',
        {
          className: 'dsh-my-observability-select',
          value: selected,
          disabled: sessions.length === 0,
          onChange: (e) => onSelect(e.target.value),
        },
        sessions.length === 0
          ? createElement('option', { value: '' }, strings.allSessions())
          : sessions.map((s) => createElement('option', { key: s.sessionId, value: s.sessionId }, s.sessionId)),
      ),
      createElement(
        'button',
        {
          type: 'button',
          className: 'dsh-my-observability-iconbtn',
          'aria-label': strings.refresh(),
          title: strings.refresh(),
          onClick: onRefresh,
        },
        icon.refresh(15),
      ),
    ),
    createElement(TypeFilter, { filter, onFilter }),
  )
}

/** 加载中状态（旋转刷新图标 + 次级色文案，不阻塞布局）。 */
function LoadingState() {
  return createElement(
    'div',
    { className: 'dsh-my-observability-state' },
    icon.refresh(14),
    createElement('span', null, strings.loading()),
  )
}

/** 空状态（图标 + 主文案 + hint 两行结构）。 */
function EmptyState() {
  return createElement(
    'div',
    { className: 'dsh-my-observability-empty' },
    createElement('span', { className: 'dsh-my-observability-empty-icon' }, icon.clock(20)),
    createElement('span', null, strings.emptyEvents()),
    createElement('span', { className: 'dsh-my-observability-empty-hint' }, strings.emptyEventsHint()),
  )
}

/** 错误状态（错误色文案 + 重试按钮）。 */
function ErrorState({ message, onRetry }) {
  return createElement(
    'div',
    { className: 'dsh-my-observability-error' },
    createElement('span', { className: 'dsh-my-observability-error-text' }, `${strings.loadError()}：${message}`),
    createElement(
      'button',
      {
        type: 'button',
        className: 'dsh-my-observability-iconbtn',
        'aria-label': strings.retry(),
        title: strings.retry(),
        onClick: onRetry,
      },
      icon.refresh(15),
    ),
  )
}

/** 轨迹回放主面板：会话选择 + 类型过滤 + 时间轴（可见时轮询）。 */
function ReplayPanel(props) {
  const currentSession = props.scope?.sessionId || ''
  const visible = props.visible !== false
  const [sessions, setSessions] = useState([])
  const [selected, setSelected] = useState('')
  const [filter, setFilter] = useState('')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    if (!visible) return undefined
    let alive = true
    const setters = { setSessions, setSelected, setEvents, setError, setLoading }
    const tick = () => {
      if (alive) void loadReplayData(selected, currentSession, setters)
    }
    tick()
    const timer = setInterval(tick, REPLAY_POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [visible, selected, currentSession, reloadTick])

  const retry = () => {
    setError('')
    setLoading(true)
    setReloadTick((tick) => tick + 1)
  }

  const filtered = filterEvents(events, filter)
  const rows = filtered.map((event, index) => createElement(EventRow, { key: event.id ?? index, event }))

  return createElement(
    'div',
    { className: 'dsh-my-observability-panel' },
    createElement(ReplayToolbar, {
      sessions,
      selected,
      onSelect: setSelected,
      filter,
      onFilter: setFilter,
      onRefresh: retry,
    }),
    error !== '' ? createElement(ErrorState, { message: error, onRetry: retry }) : null,
    loading && error === '' ? createElement(LoadingState, null) : null,
    !loading && error === '' && filtered.length === 0 ? createElement(EmptyState, null) : null,
    createElement('div', { className: 'dsh-my-observability-timeline' }, rows),
  )
}

    // ── Git 工具 + 增量 diff 审查面板 ──────────────────────────────────
const REPO_KEY = 'dsh-my-observability:repo'
const COMMIT_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore']

function loadRepoKey() {
  try {
    const value = window.localStorage.getItem(REPO_KEY)
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

function saveRepoKey(repo) {
  try {
    window.localStorage.setItem(REPO_KEY, repo)
  } catch {
    // storage is best-effort
  }
}

/** 状态条：分支 + 变更计数。 */
function StatusBar({ status }) {
  if (status === null) return null
  const parts = [`${strings.branch()} ${status.branch}`]
  if (status.clean) parts.push(strings.clean())
  else {
    if (status.stagedCount > 0) parts.push(`${status.stagedCount} ${strings.staged()}`)
    if (status.unstagedCount > 0) parts.push(`${status.unstagedCount} ${strings.unstaged()}`)
  }
  return createElement('div', { className: 'dsh-my-observability-status' }, parts.join(' · '))
}

/** 差异文本预览。 */
function DiffView({ diff }) {
  return createElement(
    'div',
    { className: 'dsh-my-observability-section' },
    createElement('div', { className: 'dsh-my-observability-section-title' }, strings.diffTitle()),
    createElement('pre', { className: 'dsh-my-observability-diff' }, diff !== '' ? diff : strings.emptyDiff()),
  )
}

/** 严重级别 → 中文。 */
function severityText(severity) {
  if (severity === 'error') return strings.severityError()
  if (severity === 'warning') return strings.severityWarning()
  return strings.severityInfo()
}

/** AI 结论文本（未启用/失败/成功三态，尽力而为）。 */
function aiTextOf(ai) {
  if (ai === undefined || ai === null || !ai.enabled) return ''
  if (ai.failed) return `${strings.aiFailed()}（${ai.note ?? ''}）`
  return ai.verdict === 'approve' ? strings.aiVerdictApprove() : strings.aiVerdictChanges()
}

/** 审查报告：问题列表 + AI 结论。 */
function ReviewReport({ report }) {
  if (report === null) return null
  const issues = report.issues || []
  const rows = issues.map((issue, index) =>
    createElement(
      'div',
      {
        key: index,
        className: `dsh-my-observability-issue dsh-my-observability-issue-${issue.severity}`,
      },
      createElement('span', { className: 'dsh-my-observability-issue-sev' }, severityText(issue.severity)),
      createElement(
        'span',
        { className: 'dsh-my-observability-issue-rule' },
        `${issue.rule}${issue.file !== '' ? ` ${issue.file}:${issue.line}` : ''}`,
      ),
      createElement('span', { className: 'dsh-my-observability-issue-msg' }, issue.message),
    ),
  )
  const aiText = aiTextOf(report.ai)
  return createElement(
    'div',
    { className: 'dsh-my-observability-section' },
    createElement('div', { className: 'dsh-my-observability-section-title' }, strings.reviewResult()),
    issues.length === 0
      ? createElement('div', { className: 'dsh-my-observability-review-ok' }, strings.reviewPass())
      : null,
    rows,
    aiText !== '' ? createElement('div', { className: 'dsh-my-observability-ai' }, aiText) : null,
  )
}

/** 提交表单字段（type/scope/description/body + 提交按钮）。 */
function CommitFields({ form, update, busy, submit }) {
  return createElement(
    'div',
    { className: 'dsh-my-observability-form' },
    createElement(
      'select',
      {
        className: 'dsh-my-observability-select dsh-my-observability-type',
        value: form.type,
        onChange: update('type'),
      },
      COMMIT_TYPES.map((type) => createElement('option', { key: type, value: type }, type)),
    ),
    createElement('input', {
      className: 'dsh-my-observability-input',
      placeholder: strings.commitScope(),
      value: form.scope,
      onChange: update('scope'),
    }),
    createElement('input', {
      className: 'dsh-my-observability-input',
      placeholder: strings.commitDesc(),
      value: form.description,
      onChange: update('description'),
    }),
    createElement('textarea', {
      className: 'dsh-my-observability-input dsh-my-observability-textarea',
      placeholder: strings.commitBody(),
      value: form.body,
      onChange: update('body'),
    }),
    createElement(
      'div',
      { className: 'dsh-my-observability-actions' },
      createElement(
        'button',
        {
          className: 'dsh-my-observability-btn dsh-my-observability-btn-primary',
          disabled: busy,
          onClick: submit,
        },
        strings.commit(),
      ),
    ),
  )
}

/** 类型化提交表单：type/scope/description/body → POST /git/commit。 */
function CommitForm({ repo, onCommitted }) {
  const [form, setForm] = useState({ type: 'feat', scope: '', description: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackKind, setFeedbackKind] = useState('ok')
  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const submit = async () => {
    if (form.description.trim() === '') {
      setFeedback(strings.commitError())
      setFeedbackKind('error')
      return
    }
    setBusy(true)
    try {
      const value = await apiJson('/observability/api/git/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repoPath: repo, ...form }),
      })
      setFeedback(`${strings.committed()}：${value.hash} ${value.message}`)
      setFeedbackKind('ok')
      setForm({ ...form, scope: '', description: '', body: '' })
      onCommitted()
    } catch (err) {
      setFeedback(`${strings.commitError()}：${err instanceof Error ? err.message : String(err)}`)
      setFeedbackKind('error')
    } finally {
      setBusy(false)
    }
  }
  return createElement(
    'div',
    { className: 'dsh-my-observability-section' },
    createElement('div', { className: 'dsh-my-observability-section-title' }, strings.commitTitle()),
    createElement(CommitFields, { form, update, busy, submit }),
    feedback !== ''
      ? createElement(
          'div',
          { className: `dsh-my-observability-feedback dsh-my-observability-feedback-${feedbackKind}` },
          feedback,
        )
      : null,
  )
}

/** 仓库路径行：输入 + 加载按钮。 */
function RepoRow({ repo, onRepoChange, onLoad }) {
  return createElement(
    'div',
    { className: 'dsh-my-observability-repo-row' },
    createElement('input', {
      className: 'dsh-my-observability-input dsh-my-observability-repo-input',
      placeholder: strings.repoPlaceholder(),
      value: repo,
      onChange: (e) => onRepoChange(e.target.value),
    }),
    createElement('button', { className: 'dsh-my-observability-btn', onClick: onLoad }, strings.loadRepo()),
  )
}

/** 操作按钮组：diff / staged diff / 审查。 */
function GitActions({ onDiff, onReview }) {
  return createElement(
    'div',
    { className: 'dsh-my-observability-actions' },
    createElement(
      'button',
      { className: 'dsh-my-observability-btn', onClick: () => onDiff(false) },
      strings.showDiff(),
    ),
    createElement(
      'button',
      { className: 'dsh-my-observability-btn', onClick: () => onDiff(true) },
      strings.showStagedDiff(),
    ),
    createElement(
      'button',
      { className: 'dsh-my-observability-btn dsh-my-observability-btn-primary', onClick: onReview },
      strings.review(),
    ),
  )
}

/** 拉取仓库状态（错误写入 setError）。 */
async function fetchStatus(path, setStatus, setError) {
  if (path === '') return
  try {
    setStatus(await apiJson(`/observability/api/git/status?repo=${encodeURIComponent(path)}`))
    setError('')
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err))
  }
}

/** 拉取差异文本（staged 切换；错误写入 setError）。 */
async function fetchDiff(path, staged, setDiff, setError) {
  if (path === '') return
  try {
    const value = await apiJson(`/observability/api/git/diff?repo=${encodeURIComponent(path)}&staged=${staged ? 1 : 0}`)
    setDiff(value.text)
    setError('')
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err))
  }
}

/** 运行提交前审查（错误写入 setError）。 */
async function runReview(path, setReport, setError) {
  if (path === '') return
  try {
    setReport(
      await apiJson('/observability/api/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repoPath: path }),
      }),
    )
    setError('')
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err))
  }
}

/** Git 面板主组件：仓库状态 / diff / 审查 / 类型化提交。 */
function GitPanel() {
  const [repo, setRepo] = useState(loadRepoKey)
  const [status, setStatus] = useState(null)
  const [diff, setDiff] = useState('')
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  const onCommitted = async () => {
    setDiff('')
    setReport(null)
    await fetchStatus(repo, setStatus, setError)
  }

  return createElement(
    'div',
    { className: 'dsh-my-observability-panel' },
    createElement(RepoRow, {
      repo,
      onRepoChange: (value) => {
        setRepo(value)
        saveRepoKey(value)
      },
      onLoad: () => fetchStatus(repo, setStatus, setError),
    }),
    error !== '' ? createElement('div', { className: 'dsh-my-observability-empty' }, error) : null,
    createElement(StatusBar, { status }),
    createElement(GitActions, {
      onDiff: (staged) => fetchDiff(repo, staged, setDiff, setError),
      onReview: () => runReview(repo, setReport, setError),
    }),
    createElement(DiffView, { diff }),
    createElement(ReviewReport, { report }),
    createElement(CommitForm, { repo, onCommitted }),
  )
}

    // ── 样式（DSH 语义 token，随 activation 注入 / teardown 卸载）──────
// 前缀 dsh-my-observability-（issue #54：与 dsh-my-guard 前缀分离，消除跨插件类名冲突）。
const STYLES = `
.dsh-my-observability-panel{display:flex;flex-direction:column;gap:10px;padding:2px 6px 8px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14)}
.dsh-my-observability-toolbar{display:flex;flex-direction:column;gap:8px}
.dsh-my-observability-toolbar-row{display:flex;align-items:center;gap:6px}
.dsh-my-observability-select{flex:1;min-width:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 8px}
.dsh-my-observability-select:disabled{opacity:.4;cursor:default}
.dsh-my-observability-input{flex:1;min-width:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 8px}
.dsh-my-observability-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.dsh-my-observability-repo-row{display:flex;gap:8px;align-items:center}
.dsh-my-observability-repo-input{flex:1}
.dsh-my-observability-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;
  border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none;
  transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-my-observability-iconbtn svg{display:block}
.dsh-my-observability-iconbtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-my-observability-iconbtn:disabled{opacity:.4;cursor:default}
.dsh-my-observability-filters{display:flex;gap:6px;flex-wrap:wrap}
.dsh-my-observability-chip{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);background:transparent;
  border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 10px;cursor:pointer;
  transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out), border-color var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-my-observability-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-my-observability-chip-active{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-interactive-primary);
  background:color-mix(in srgb, var(--dsw-alias-interactive-primary) 12%, transparent)}
/* ── 时间轴：左侧竖线 + 类型色节点圆点 + 类型图标行 ── */
.dsh-my-observability-timeline{display:flex;flex-direction:column;gap:2px;max-height:calc(100vh - 240px);overflow-y:auto;
  padding-left:14px;position:relative}
.dsh-my-observability-timeline::before{content:'';position:absolute;left:5px;top:8px;bottom:8px;width:2px;border-radius:1px;
  background:var(--dsw-alias-border-l2)}
.dsh-my-observability-event{position:relative;display:flex;align-items:flex-start;gap:8px;box-sizing:border-box;width:100%;
  margin:0;padding:5px 8px 5px 0;border:none;background:transparent;border-radius:8px;cursor:pointer;text-align:left;
  font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);
  animation:dsh-my-observability-row-in 150ms var(--ds-ease-in-out);
  transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-my-observability-event:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-my-observability-event:active{background:color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 55%, transparent)}
.dsh-my-observability-node{position:absolute;left:-14px;top:50%;transform:translateY(-50%);width:12px;height:12px;flex:none;
  box-sizing:border-box;border-radius:50%;background:var(--dsw-alias-bg-layer-2);border:2px solid var(--dsw-alias-label-tertiary)}
.dsh-my-observability-node-status{border-color:var(--dsw-alias-state-info-primary)}
.dsh-my-observability-node-llm{border-color:var(--dsw-alias-state-warn-primary)}
.dsh-my-observability-node-call{border-color:var(--dsw-alias-accent)}
.dsh-my-observability-node-result{border-color:var(--dsw-alias-state-success-primary)}
.dsh-my-observability-node-fail{border-color:var(--dsw-alias-state-danger-primary)}
.dsh-my-observability-event-icon{flex:none;display:flex;align-items:center;margin-top:1px}
.dsh-my-observability-icon-status{color:var(--dsw-alias-state-info-primary)}
.dsh-my-observability-icon-llm{color:var(--dsw-alias-state-warn-primary)}
.dsh-my-observability-icon-call{color:var(--dsw-alias-accent)}
.dsh-my-observability-icon-result{color:var(--dsw-alias-state-success-primary)}
.dsh-my-observability-icon-fail{color:var(--dsw-alias-state-danger-primary)}
.dsh-my-observability-event-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.dsh-my-observability-event-head{display:flex;align-items:center;gap:8px;justify-content:space-between}
.dsh-my-observability-badge{flex:none;font:var(--dsw-font-xxxs-strong-11);border-radius:4px;padding:1px 6px}
.dsh-my-observability-badge-status{color:var(--dsw-alias-state-info-primary);background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 14%, transparent)}
.dsh-my-observability-badge-llm{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent)}
.dsh-my-observability-badge-call{color:var(--dsw-alias-accent);background:color-mix(in srgb, var(--dsw-alias-accent) 12%, transparent)}
.dsh-my-observability-badge-result{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent)}
.dsh-my-observability-badge-fail{color:var(--dsw-alias-state-danger-primary);background:color-mix(in srgb, var(--dsw-alias-state-danger-primary) 14%, transparent)}
.dsh-my-observability-time{flex:none;font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dsh-my-observability-event-meta{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);line-height:1.6;word-break:break-word}
/* ── 状态区：loading / 空 / 错误 ── */
.dsh-my-observability-state{display:flex;align-items:center;gap:6px;padding:8px 6px;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary)}
.dsh-my-observability-state svg{flex:none;animation:dsh-my-observability-spin 1s linear infinite}
.dsh-my-observability-empty{display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 8px;text-align:center;
  font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);line-height:1.7}
.dsh-my-observability-empty-icon{display:flex;color:var(--dsw-alias-label-tertiary)}
.dsh-my-observability-empty-hint{display:block;color:var(--dsw-alias-label-dimmed);font:var(--dsw-font-xxxs-11)}
.dsh-my-observability-error{display:flex;align-items:center;gap:6px;padding:8px 6px;font:var(--dsw-font-xxs-12);
  color:var(--dsw-alias-state-error-primary);white-space:pre-wrap;word-break:break-all;line-height:1.7}
.dsh-my-observability-error-text{flex:1;min-width:0}
@keyframes dsh-my-observability-row-in{from{opacity:0;transform:translateY(1px)}to{opacity:1;transform:none}}
@keyframes dsh-my-observability-spin{to{transform:rotate(360deg)}}
/* ── Git 面板 ── */
.dsh-my-observability-status{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-secondary)}
.dsh-my-observability-actions{display:flex;gap:8px;flex-wrap:wrap}
.dsh-my-observability-btn{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);
  border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 12px;cursor:pointer;
  transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out), border-color var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-my-observability-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-my-observability-btn:disabled{opacity:.5;cursor:default}
.dsh-my-observability-btn-primary{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-interactive-primary);
  background:color-mix(in srgb, var(--dsw-alias-interactive-primary) 16%, transparent)}
.dsh-my-observability-section{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:8px}
.dsh-my-observability-section-title{font:var(--dsw-font-xs-strong-13);color:var(--dsw-alias-label-primary)}
.dsh-my-observability-diff{max-height:240px;overflow:auto;font:var(--dsw-font-mono-xxs);font-size:11px;line-height:1.5;
  color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);
  border-radius:6px;padding:8px;white-space:pre-wrap;word-break:break-all}
.dsh-my-observability-form{display:flex;flex-direction:column;gap:6px}
.dsh-my-observability-type{flex:none;width:96px}
.dsh-my-observability-textarea{min-height:52px;resize:vertical;font:var(--dsw-font-xxs-12)}
.dsh-my-observability-feedback{font:var(--dsw-font-xxs-12);word-break:break-all;line-height:1.5}
.dsh-my-observability-feedback-ok{color:var(--dsw-alias-state-success-primary)}
.dsh-my-observability-feedback-error{color:var(--dsw-alias-state-error-primary)}
.dsh-my-observability-issue{display:flex;flex-direction:column;gap:2px;border-radius:6px;padding:6px 8px;font:var(--dsw-font-xxs-12)}
.dsh-my-observability-issue-error{background:color-mix(in srgb, var(--dsw-alias-state-danger-primary) 12%, transparent)}
.dsh-my-observability-issue-warning{background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent)}
.dsh-my-observability-issue-info{background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 10%, transparent)}
.dsh-my-observability-issue-sev{font:var(--dsw-font-xxxs-strong-11);text-transform:uppercase}
.dsh-my-observability-issue-error .dsh-my-observability-issue-sev{color:var(--dsw-alias-state-danger-primary)}
.dsh-my-observability-issue-warning .dsh-my-observability-issue-sev{color:var(--dsw-alias-state-warn-primary)}
.dsh-my-observability-issue-info .dsh-my-observability-issue-sev{color:var(--dsw-alias-state-info-primary)}
.dsh-my-observability-issue-rule{font:var(--dsw-font-mono-xxs);font-size:11px;color:var(--dsw-alias-label-secondary)}
.dsh-my-observability-issue-msg{color:var(--dsw-alias-label-primary);line-height:1.5}
.dsh-my-observability-review-ok{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-state-success-primary)}
.dsh-my-observability-ai{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);line-height:1.5;
  border:1px dashed var(--dsw-alias-border-l2);border-radius:6px;padding:6px 8px}
`

function injectStyles() {
  if (typeof document === 'undefined' || typeof document.head === 'undefined') return () => {}
  const style = document.createElement('style')
  style.setAttribute('data-dsh-my-observability', 'styles')
  style.textContent = STYLES
  document.head.appendChild(style)
  return () => {
    if (style.parentNode !== null) style.parentNode.removeChild(style)
  }
}


    // ── 插件体：样式注入 + 两个页签注册 ────────────────────────────────
    exports.inject = ['betterSidebar']

    exports.apply = function apply(ctx) {
      ctx.effect(() => injectStyles(), 'dsh-my-observability: styles')
      const service = ctx.betterSidebar
      if (service === undefined) return
      ctx.effect(
        () =>
          service.registerTab({
            id: 'dsh-my-observability:replay',
            title: () => strings.replayTitle(),
            order: 40,
            single: true,
            component: (props) => createElement(ReplayPanel, props),
          }),
        'dsh-my-observability: replay tab registration',
      )
      ctx.effect(
        () =>
          service.registerTab({
            id: 'dsh-my-observability:git',
            title: () => strings.gitTitle(),
            order: 41,
            single: true,
            component: (props) => createElement(GitPanel, props),
          }),
        'dsh-my-observability: git tab registration',
      )
    }

    return module.exports
  },
})
