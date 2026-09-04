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
  title: () => (isZh() ? '记忆' : 'Memory'),
  globalSection: () => (isZh() ? '全局记忆' : 'Global memory'),
  projectSection: () => (isZh() ? '项目记忆' : 'Project memory'),
  projectHint: () =>
    isZh()
      ? '输入项目根路径以查看 / 编辑该项目记忆（存储于 $DSH_HOME/memory/projects/）'
      : 'Enter a project root to view/edit its project memory (stored under $DSH_HOME/memory/projects/)',
  loadProject: () => (isZh() ? '加载' : 'Load'),
  refresh: () => (isZh() ? '刷新' : 'Refresh'),
  retry: () => (isZh() ? '重试' : 'Retry'),
  loading: () => (isZh() ? '加载中…' : 'Loading…'),
  loadError: () => (isZh() ? '加载失败' : 'Load failed'),
  empty: () => (isZh() ? '暂无记忆' : 'No memories yet'),
  emptyHint: () => (isZh() ? '点击下方输入框添加第一条记忆' : 'Add your first memory below'),
  projectEmptyHint: () =>
    isZh()
      ? '当前无项目会话，请在上方输入项目根路径加载项目记忆'
      : 'No active project session; enter a project root above to load its memory',
  addPlaceholder: () =>
    isZh() ? '输入要记住的内容（如：回复使用中文）' : 'Type what to remember (e.g. reply in Chinese)',
  add: () => (isZh() ? '新增' : 'Add'),
  save: () => (isZh() ? '保存' : 'Save'),
  cancel: () => (isZh() ? '取消' : 'Cancel'),
  edit: () => (isZh() ? '编辑' : 'Edit'),
  delete: () => (isZh() ? '删除' : 'Delete'),
  confirmAdd: () => (isZh() ? '确认新增这条记忆？' : 'Add this memory?'),
  confirmUpdate: () => (isZh() ? '确认保存这条记忆的修改？' : 'Save this memory change?'),
  confirmDelete: () => (isZh() ? '确定删除这条记忆？此操作不可撤销。' : 'Delete this memory? This cannot be undone.'),
  confirmSave: () => (isZh() ? '确认保存' : 'Confirm save'),
  confirmDeleteBtn: () => (isZh() ? '确认删除' : 'Confirm delete'),
  saved: () => (isZh() ? '已保存' : 'Saved'),
  saveFailed: () => (isZh() ? '操作失败' : 'Operation failed'),
  projectRoot: () => (isZh() ? '项目根：' : 'Project root: '),
  globalNote: () =>
    isZh()
      ? '全局记忆在会话开始时注入系统提示词（agent 始终携带）；存于 $DSH_HOME/memory.json'
      : 'Global memories are injected into the system prompt at session start; stored in $DSH_HOME/memory.json',
  projectNote: () =>
    isZh()
      ? '项目记忆按项目隔离，仅该项目会话可见；存于 $DSH_HOME/memory/projects/（按项目根路径哈希分文件）'
      : 'Project memories are scoped to this project only; stored under $DSH_HOME/memory/projects/ (one file per project-root hash)',
  confirmHint: () =>
    isZh() ? '所有新增 / 修改 / 删除都需要你确认' : 'Every add / edit / delete needs your confirmation',
  updatedAt: (ts) => (isZh() ? `更新于 ${new Date(ts).toLocaleString()}` : `Updated ${new Date(ts).toLocaleString()}`),
  // ── issue #110 视觉重设计：徽标分类/数量、相对时间、排序、截断展开 ──
  globalScope: () => (isZh() ? '全局' : 'Global'),
  projectScope: () => (isZh() ? '项目' : 'Project'),
  countBadge: (label, n) => (isZh() ? `${label} · ${n} 条` : `${label} · ${n}`),
  projectBadge: (root, n) => (isZh() ? `项目根：${root} · ${n} 条` : `Project root: ${root} · ${n}`),
  justNow: () => (isZh() ? '刚刚' : 'just now'),
  minutesAgo: (n) => (isZh() ? `${n} 分钟前` : `${n} min ago`),
  hoursAgo: (n) => (isZh() ? `${n} 小时前` : `${n} hr ago`),
  daysAgo: (n) => (isZh() ? `${n} 天前` : `${n} d ago`),
  sortLabel: () => (isZh() ? '按更新时间排序' : 'Sort by updated'),
  sortNewest: () => (isZh() ? '最新优先' : 'Newest first'),
  sortOldest: () => (isZh() ? '最旧优先' : 'Oldest first'),
  expand: () => (isZh() ? '展开' : 'Expand'),
  collapse: () => (isZh() ? '收起' : 'Collapse'),
}
