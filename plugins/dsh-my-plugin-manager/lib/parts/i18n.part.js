// ── i18n ──────────────────────────────────────────────────────────────
function isZh() {
  try {
    const lang = (navigator.language || 'en').toLowerCase()
    return lang.startsWith('zh')
  } catch {
    return false
  }
}

const strings = {
  title: () => (isZh() ? '插件管理' : 'Plugin Manager'),
  installed: () => (isZh() ? '已安装' : 'Installed'),
  market: () => (isZh() ? '市场' : 'Market'),
  searchPlaceholder: () =>
    isZh() ? '搜索 npm 插件（如 dsh-file-activity）…' : 'Search npm plugins (e.g. dsh-file-activity)…',
  search: () => (isZh() ? '搜索' : 'Search'),
  install: () => (isZh() ? '安装' : 'Install'),
  uninstall: () => (isZh() ? '卸载' : 'Uninstall'),
  checkUpdates: () => (isZh() ? '检查更新' : 'Check updates'),
  noUpdates: () => (isZh() ? '全部为最新版本' : 'All up to date'),
  updatesAvailable: (n) => (isZh() ? `${n} 个插件可更新` : `${n} update(s) available`),
  loading: () => (isZh() ? '加载中…' : 'Loading…'),
  loadError: () => (isZh() ? '加载失败' : 'Load failed'),
  emptyInstalled: () => (isZh() ? '暂无已安装插件' : 'No plugins installed'),
  emptySearch: () => (isZh() ? '输入关键词搜索 npm 插件市场' : 'Type a query to search the npm plugin market'),
  noResults: () => (isZh() ? '没有匹配的插件' : 'No matching plugins'),
  running: () => (isZh() ? '运行中' : 'running'),
  disabled: () => (isZh() ? '已禁用' : 'disabled'),
  version: () => (isZh() ? '版本' : 'version'),
  installHint: () =>
    isZh()
      ? '安装/卸载通过 `dsh plugin` 写入 profile（npm 包或 link 路径）；新插件在下次重启 DSH 后加载。'
      : 'Install/uninstall writes through `dsh plugin` (npm package or link: path); new plugins load on the next DSH restart.',
  installDone: () => (isZh() ? '安装完成（重启后加载）' : 'Installed (loads on restart)'),
  uninstallDone: () => (isZh() ? '已卸载（重启后移除）' : 'Uninstalled (removed on restart)'),
  actionFailed: () => (isZh() ? '操作失败' : 'Action failed'),
  noVersion: () => (isZh() ? '—' : '—'),
}
