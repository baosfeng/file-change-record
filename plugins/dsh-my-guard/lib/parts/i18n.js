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
  tabTitle: () => (isZh() ? '安全护栏' : 'Guard'),
  alertsTitle: () => (isZh() ? '告警记录' : 'Alerts'),
  scanTitle: () => (isZh() ? '投毒扫描' : 'Poison scan'),
  promptTitle: () => (isZh() ? '提示注入检测' : 'Injection check'),
  emptyAlerts: () =>
    isZh()
      ? '暂无告警——破坏性命令、投毒内容与提示注入命中会出现在这里'
      : 'No alerts yet — destructive commands, poisoned packages and injection hits will appear here',
  emptyAlertsHint: () =>
    isZh()
      ? '执行危险命令、安装可疑包或输入注入文本时，护栏会在这里生成告警'
      : 'Run a dangerous command, install a suspicious package or paste injection text to see alerts here',
  loadError: () => (isZh() ? '加载失败' : 'Load failed'),
  loading: () => (isZh() ? '加载中…' : 'Loading…'),
  refresh: () => (isZh() ? '刷新' : 'Refresh'),
  retry: () => (isZh() ? '重试' : 'Retry'),
  scanning: () => (isZh() ? '扫描中…' : 'Scanning…'),
  checking: () => (isZh() ? '检测中…' : 'Checking…'),
  typeDestructive: () => (isZh() ? '破坏性命令' : 'Destructive'),
  typePoison: () => (isZh() ? '投毒扫描' : 'Poison'),
  typeInjection: () => (isZh() ? '提示注入' : 'Injection'),
  sevHigh: () => (isZh() ? '高' : 'high'),
  sevMedium: () => (isZh() ? '中' : 'medium'),
  sevLow: () => (isZh() ? '低' : 'low'),
  confirmed: () => (isZh() ? '已确认' : 'confirmed'),
  confirm: () => (isZh() ? '确认' : 'Confirm'),
  confirmAria: () => (isZh() ? '确认此告警' : 'Confirm this alert'),
  scanPlaceholder: () => (isZh() ? '包名或本地路径，如 dsh-my-guard' : 'package name or path, e.g. dsh-my-guard'),
  scan: () => (isZh() ? '扫描' : 'Scan'),
  scanResult: () => (isZh() ? '扫描结果' : 'Scan result'),
  scanClean: () => (isZh() ? '未发现可疑内容' : 'No suspicious content found'),
  scanError: () => (isZh() ? '扫描失败' : 'Scan failed'),
  findings: (count) => (isZh() ? `${count} 个发现项` : `${count} finding(s)`),
  promptPlaceholder: () => (isZh() ? '输入要检测的文本…' : 'text to check…'),
  check: () => (isZh() ? '检测' : 'Check'),
  checkResult: () => (isZh() ? '检测结果' : 'Result'),
  checkClean: () => (isZh() ? '未命中注入规则' : 'No injection rules hit'),
  checkHits: (count) => (isZh() ? `命中 ${count} 条规则` : `${count} rule(s) hit`),
  file: () => (isZh() ? '文件' : 'file'),
  rule: () => (isZh() ? '规则' : 'rule'),
  noTarget: () => (isZh() ? '请输入包名或路径' : 'Enter a package name or path'),
  noText: () => (isZh() ? '请输入要检测的文本' : 'Enter text to check'),
  modeLabel: () => (isZh() ? '护栏模式' : 'Guard mode'),
  modeObserve: () => (isZh() ? '观察（只告警）' : 'Observe'),
  modeAsk: () => (isZh() ? '确认（审批）' : 'Ask'),
  modeDeny: () => (isZh() ? '拦截' : 'Deny'),
}
