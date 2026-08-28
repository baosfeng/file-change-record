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
  kindEnd: () => (isZh() ? '会话已结束' : 'Session finished'),
  kindAsk: () => (isZh() ? '需要你回答' : 'Needs your answer'),
  kindApproval: () => (isZh() ? '等待你的批准' : 'Approval needed'),
  kindRemote: () => (isZh() ? '提示' : 'Notice'),
  untitled: (short) =>
    isZh() ? (short !== '' ? `会话 ${short}` : '会话') : short !== '' ? `Session ${short}` : 'Session',
  openSession: () => (isZh() ? '打开会话' : 'Open session'),
  closeToast: () => (isZh() ? '关闭通知' : 'Dismiss notification'),
  // 设置页（issue #27 配置可视化）
  settingsTitle: () => (isZh() ? '通知提醒' : 'Notifications'),
  settingsTriggers: () => (isZh() ? '触发开关' : 'Triggers'),
  settingsEnd: () => (isZh() ? '会话结束提醒' : 'Session end'),
  settingsEndHint: () => (isZh() ? '本轮对话结束后弹通知' : 'Notify when a session finishes'),
  settingsAsk: () => (isZh() ? '询问提醒' : 'Ask'),
  settingsAskHint: () => (isZh() ? 'agent 询问问题时弹通知' : 'Notify when the agent asks you'),
  settingsApproval: () => (isZh() ? '审批提醒' : 'Approval'),
  settingsApprovalHint: () => (isZh() ? '等待批准时弹通知' : 'Notify when approval is needed'),
  settingsSubagentEnd: () => (isZh() ? '子代理完成提醒' : 'Subagent end'),
  settingsSubagentEndHint: () =>
    isZh() ? '子代理完成时也弹通知（默认关闭）' : 'Also notify when a subagent finishes (off by default)',
  settingsAdvanced: () => (isZh() ? '高级' : 'Advanced'),
  settingsApiToken: () => (isZh() ? '远程触发 Token' : 'Remote trigger token'),
  settingsApiTokenHint: () =>
    isZh() ? '配置后远程 hook 需携带 x-notify-token 头' : 'Remote hooks must send x-notify-token when set',
  settingsDedupeMs: () => (isZh() ? '去重窗口（毫秒）' : 'Dedupe window (ms)'),
  settingsDedupeMsHint: () => (isZh() ? '同类通知在窗口内只推一次' : 'Same-kind notices are deduped within the window'),
  save: () => (isZh() ? '保存' : 'Save'),
  saved: () => (isZh() ? '已保存' : 'Saved'),
  saveFailed: () => (isZh() ? '保存失败' : 'Save failed'),
  loading: () => (isZh() ? '加载中…' : 'Loading…'),
  loadError: () => (isZh() ? '加载失败' : 'Load failed'),
}

// ── 本地开关（localStorage 覆盖，默认全开）──────────────────────────
const LS = { notify: 'dsh-notify:notify', sound: 'dsh-notify:sound', toast: 'dsh-notify:toast' }

function prefOn(key, def) {
  try {
    const v = window.localStorage.getItem(key)
    if (v === null) return def
    return v === '1'
  } catch {
    return def
  }
}
