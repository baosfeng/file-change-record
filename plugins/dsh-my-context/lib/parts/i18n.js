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
  tabTitle: () => (isZh() ? '上下文透镜' : 'Context'),
  allSessions: () => (isZh() ? '全部会话' : 'All sessions'),
  noSessions: () =>
    isZh()
      ? '暂无会话统计——开始一段对话后，上下文占用会出现在这里'
      : 'No session stats yet — context usage will appear here after a conversation',
  loadError: () => (isZh() ? '加载失败' : 'Load failed'),
  loading: () => (isZh() ? '加载中…' : 'Loading…'),
  overview: () => (isZh() ? '概览' : 'Overview'),
  totalTokens: () => (isZh() ? '累计 token' : 'Total tokens'),
  inputTokens: () => (isZh() ? '输入' : 'Input'),
  outputTokens: () => (isZh() ? '输出' : 'Output'),
  cacheRead: () => (isZh() ? '缓存命中' : 'Cache read'),
  cacheWrite: () => (isZh() ? '缓存写入' : 'Cache write'),
  cacheHitRate: () => (isZh() ? 'KV 缓存命中率' : 'KV cache hit rate'),
  contextWindow: () => (isZh() ? '上下文窗口' : 'Context window'),
  model: () => (isZh() ? '模型' : 'Model'),
  composition: () => (isZh() ? '上下文构成' : 'Composition'),
  catSystem: () => (isZh() ? '系统提示' : 'System'),
  catTools: () => (isZh() ? '工具' : 'Tools'),
  catUser: () => (isZh() ? '用户' : 'User'),
  catInject: () => (isZh() ? '注入' : 'Injected'),
  catAssistant: () => (isZh() ? '助手' : 'Assistant'),
  catTool: () => (isZh() ? '工具结果' : 'Tool results'),
  requests: () => (isZh() ? '请求记录' : 'Requests'),
  noRequests: () => (isZh() ? '暂无请求记录' : 'No requests yet'),
  turnStep: (turn, step) => (isZh() ? `轮 ${turn} · 步 ${step}` : `turn ${turn} · step ${step}`),
  prompt: () => (isZh() ? '提示' : 'Prompt'),
  output: () => (isZh() ? '输出' : 'Output'),
  budget: () => (isZh() ? '预算' : 'Budget'),
  budgetPerTurn: () => (isZh() ? '每轮上限' : 'Per-turn limit'),
  budgetPerSession: () => (isZh() ? '每会话上限' : 'Per-session limit'),
  budgetOff: () => (isZh() ? '不限制' : 'Unlimited'),
  modeWarn: () => (isZh() ? '提醒' : 'Warn'),
  modeDeny: () => (isZh() ? '拦截' : 'Deny'),
  save: () => (isZh() ? '保存' : 'Save'),
  saved: () => (isZh() ? '已保存' : 'Saved'),
  saveError: () => (isZh() ? '保存失败' : 'Save failed'),
  alerts: () => (isZh() ? '预算告警' : 'Budget alerts'),
  noAlerts: () => (isZh() ? '暂无预算告警' : 'No budget alerts'),
  alertTurn: () => (isZh() ? '每轮超限' : 'Turn limit exceeded'),
  alertSession: () => (isZh() ? '每会话超限' : 'Session limit exceeded'),
  alertBlocked: () => (isZh() ? '已拦截' : 'Blocked'),
  alertWarned: () => (isZh() ? '已提醒' : 'Warned'),
  tokens: (n) => (isZh() ? `${n.toLocaleString()} tokens` : `${n.toLocaleString()} tokens`),
  percent: (n) => `${(n * 100).toFixed(1)}%`,
  empty: () => (isZh() ? '（空）' : '(empty)'),
}
