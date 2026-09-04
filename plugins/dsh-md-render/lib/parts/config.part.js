// ── 渲染配置（issue #84 配置化）：增强功能开关状态 ─────────────────
// 各增强功能独立开关（默认全部开启）：copyButton / syntaxHighlight /
// languageLabel / lineNumbers / taskList / strikethrough / image /
// nestedList / mathStructures / tableSort / tableFold。client apply 默认
// 全开，随后异步经 GET /md/api/config 拉取真实配置应用（client 端不能
// 访问 ctx.config——Cordis inject 限制）；设置页保存后 setRenderOptions
// 立即应用新开关，渲染管线（代码块 / 行内 / DOM 表格）读取模块级状态。
const DEFAULT_RENDER_OPTIONS = {
  copyButton: true,
  syntaxHighlight: true,
  languageLabel: true,
  lineNumbers: true,
  taskList: true,
  strikethrough: true,
  image: true,
  nestedList: true,
  mathStructures: true,
  tableSort: true,
  tableFold: true,
}

let renderOptions = { ...DEFAULT_RENDER_OPTIONS }
function setRenderOptions(next) {
  renderOptions = { ...renderOptions, ...(next || {}) }
}

/** 从应用层配置提取显式布尔开关（缺失/非法值保持默认，不覆盖）。 */
function pickRenderOptions(config) {
  const out = {}
  const cfg = config ?? {}
  for (const key of Object.keys(DEFAULT_RENDER_OPTIONS)) {
    if (typeof cfg[key] === 'boolean') out[key] = cfg[key]
  }
  return out
}

/**
 * 异步从 server 端拉取配置并应用（初始化真实开关）。
 *
 * client 端 apply 不能访问 ctx.config（Cordis inject 限制：未 inject 声明
 * 的 property 访问抛 "cannot get property ... without inject"，导致插件
 * client 端 failed to apply loader entry）——真实配置经 server 端
 * GET /md/api/config 获取（与设置页同一数据源）。拉取失败保持默认全开，
 * 不阻塞渲染能力。
 */
function initConfigFromServer() {
  if (typeof fetch !== 'function') return
  fetch('/md/api/config')
    .then((res) => res.json())
    .then((body) => {
      if (body === null || body.ok !== true || typeof body.value !== 'object' || body.value === null) return
      setRenderOptions(pickRenderOptions(body.value))
    })
    .catch(() => {
      // 服务不可用时保持默认（全部开启），不影响渲染。
    })
}

exports.setRenderOptions = setRenderOptions
exports.pickRenderOptions = pickRenderOptions
exports.initConfigFromServer = initConfigFromServer
