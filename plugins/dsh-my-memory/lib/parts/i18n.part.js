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
    isZh()
      ? '输入要记住的内容（建议 1-2 句话概括，如：回复使用中文）'
      : 'Type what to remember (keep it to 1-2 sentences, e.g. reply in Chinese)',
  // ── issue #105 记忆内容精简：超长提示 / 概要预览 ──
  entryTooLongHint: (current, limit) =>
    isZh()
      ? `内容过长（${current} 字，建议 ≤ ${limit} 字），建议精简为 1-2 句`
      : `Entry too long (${current} chars, suggested ≤ ${limit}); keep it to 1-2 sentences`,
  summaryPreview: () =>
    isZh() ? '将保存完整内容；列表与注入显示概要：' : 'Full content is saved; list & injection show the summary: ',
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
  // ── issue #78 渐进式索引记忆：待确认候选 + 元数据展示 ──
  candidatesSection: () => (isZh() ? '自动学习候选（待确认）' : 'Auto-learned candidates (pending)'),
  candidatesNote: () =>
    isZh()
      ? '会话结束后自动从对话提取的记忆候选（autoLearn 开启时）。确认后写入记忆（同主题自动提升置信度），拒绝则丢弃——记忆绝不静默变更'
      : 'Memory candidates auto-extracted from conversations (when autoLearn is on). Confirm to store them (same themes gain confidence), dismiss to drop — memories never change silently',
  candidatesEmpty: () => (isZh() ? '暂无待确认候选' : 'No pending candidates'),
  confirmCandidate: () => (isZh() ? '确认写入' : 'Confirm'),
  dismissCandidate: () => (isZh() ? '拒弃' : 'Dismiss'),
  candidateSource: (sessionId) =>
    isZh()
      ? `来源会话：${sessionId === '' ? '(无)' : sessionId}`
      : `Source session: ${sessionId === '' ? '(none)' : sessionId}`,
  candidateScopeBadge: (scope) =>
    isZh() ? (scope === 'project' ? '项目候选' : '全局候选') : scope === 'project' ? 'Project' : 'Global',
  categoryLabel: (category) =>
    ({
      preference: isZh() ? '偏好' : 'Preference',
      fact: isZh() ? '事实' : 'Fact',
      project: isZh() ? '项目' : 'Project',
      stack: isZh() ? '技术栈' : 'Stack',
      workflow: isZh() ? '工作流' : 'Workflow',
    })[category] ?? (isZh() ? '事实' : 'Fact'),
  confidenceLabel: (n) => (isZh() ? `置信度 ${n}` : `Confidence ${n}`),
  statusConflict: () => (isZh() ? '待处理矛盾' : 'Conflict'),
  historyLabel: () => (isZh() ? '演进历史' : 'History'),
  historyEntry: (action) =>
    isZh()
      ? action === 'reinforce'
        ? '多次出现，置信度提升'
        : action === 'conflict'
          ? '内容更新（可能矛盾）'
          : '新增'
      : action,
  noHistory: () => (isZh() ? '暂无演进历史' : 'No history yet'),
}
