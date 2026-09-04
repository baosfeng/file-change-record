// ── 渲染配置（issue #84 配置化）：增强功能开关状态 ─────────────────
// 各增强功能独立开关（默认全部开启）：copyButton / syntaxHighlight /
// languageLabel / lineNumbers / taskList / strikethrough / image /
// nestedList / mathStructures / tableSort / tableFold。apply(ctx) 从
// ctx.config 读取（setRenderOptions 编程式切换），渲染管线（代码块 /
// 行内 / DOM 表格）在渲染时读取本模块级状态，配置变更即生效。
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

exports.setRenderOptions = setRenderOptions
exports.pickRenderOptions = pickRenderOptions
