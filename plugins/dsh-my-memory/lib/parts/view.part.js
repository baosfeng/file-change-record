// ── view: Memory settings tab ─────────────────────────────────────────
/** Load both scopes: global always; project only when a cwd is given. */
function fetchAll(cwd) {
  const projectCwd = cwd.trim()
  const globalP = fetchMemory('global', '')
  const projectP =
    projectCwd === ''
      ? Promise.resolve({ scope: 'project', cwd: '', projectRoot: '', items: [] })
      : fetchMemory('project', projectCwd)
  return Promise.all([globalP, projectP]).then(([global, project]) => ({ global, project }))
}

function mergeScope(data, scope, value) {
  return scope === 'global' ? { ...data, global: value } : { ...data, project: value }
}

/** Data actions bound to the state setters; error: null | 'load' | 'save'. */
function createActions({ setData, setLoading, setError, setSaved }) {
  const applyValue = (value) => {
    setData(value)
    setLoading(false)
  }
  const refreshWith = (fetcher, cwd) => {
    setLoading(true)
    setError(null)
    setSaved(false)
    fetcher(cwd)
      .then(applyValue)
      .catch(() => {
        setLoading(false)
        setError('load')
      })
  }
  const run = (cwd) => refreshWith(fetchAll, cwd)
  return { load: run, refresh: run }
}

function MemoryView() {
  const [data, setData] = useState(null)
  const [pathInput, setPathInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [drafts, setDrafts] = useState({ global: '', project: '' })
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set())
  const [sortOrder, setSortOrder] = useState({ global: 'desc', project: 'desc' })
  const [entryLimit, setEntryLimit] = useState(DEFAULT_ENTRY_LIMIT)
  const actions = createActions({ setData, setLoading, setError, setSaved })

  useEffect(() => {
    // 面板打开即拉取服务端精简引导配置（issue #105；失败回落默认值），
    // 再解析当前会话 cwd 自动加载记忆（issue #104）。
    fetchConfig()
      .then((value) => setEntryLimit(value.maxEntryLength))
      .catch(() => {})
    fetchSessionCwd(currentSessionId()).then((cwd) => actions.load(cwd))
  }, [])

  const commit = createCommitHandler({ data, setData, setSaved, setError, setDrafts, setEditing, setConfirming })

  return createElement(
    'div',
    { className: 'dsh-my-memory-root' },
    createElement(Toolbar, { pathInput, onInput: setPathInput, onLoad: actions.load, onRefresh: actions.refresh }),
    error === null ? null : createElement(ErrorBanner, { kind: error, onRetry: () => actions.load(pathInput) }),
    loading
      ? createElement(
          'div',
          { className: 'dsh-my-memory-status dsh-my-memory-loading' },
          createElement('span', { className: 'dsh-my-memory-spinner' }),
          strings.loading(),
        )
      : data === null
        ? null
        : createElement(Sections, {
            data,
            saved,
            drafts,
            editing,
            confirming,
            expanded,
            sortOrder,
            entryLimit,
            onDraft: (scope, value) => setDrafts({ ...drafts, [scope]: value }),
            onEdit: (scope, id, desc) => setEditing({ scope, id, desc }),
            onEditDesc: (value) => setEditing({ ...editing, desc: value }),
            onCancelEdit: () => setEditing(null),
            onConfirm: (confirm) => setConfirming(confirm),
            onCancelConfirm: () => setConfirming(null),
            onToggle: (key) =>
              setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(key)) next.delete(key)
                else next.add(key)
                return next
              }),
            onSort: (scope) => setSortOrder((prev) => ({ ...prev, [scope]: prev[scope] === 'desc' ? 'asc' : 'desc' })),
            onCommit: commit,
          }),
  )
}

/** Load-failure banner with a retry entry; write-failure banner without. */
function ErrorBanner({ kind, onRetry }) {
  if (kind === 'load') {
    return createElement(
      'div',
      { className: 'dsh-my-memory-error' },
      strings.loadError(),
      createElement(
        'button',
        { className: 'dsh-my-memory-btn dsh-my-memory-btn-retry', onClick: onRetry },
        icon.refresh(14),
        strings.retry(),
      ),
    )
  }
  return kind === 'save' ? createElement('div', { className: 'dsh-my-memory-error' }, strings.saveFailed()) : null
}

/** One confirmed write (add / update / delete) → POST + refresh the scope. */
function createCommitHandler({ data, setData, setSaved, setError, setDrafts, setEditing, setConfirming }) {
  return (confirm) => {
    setSaved(false)
    setError(null)
    writeMemory({
      action: confirm.kind,
      scope: confirm.scope,
      cwd: confirm.scope === 'project' ? data.project.cwd : '',
      id: confirm.id,
      desc: confirm.desc,
    })
      .then((value) => {
        setSaved(true)
        setDrafts((d) => ({ ...d, [confirm.scope]: '' }))
        setEditing(null)
        setConfirming(null)
        setData((d) => mergeScope(d, confirm.scope, value))
      })
      .catch(() => setError('save'))
  }
}

/** Path input + load/refresh buttons + consent note. */
function Toolbar({ pathInput, onInput, onLoad, onRefresh }) {
  return createElement(
    'div',
    { className: 'dsh-my-memory-toolbar' },
    createElement(
      'div',
      { className: 'dsh-my-memory-pathbar' },
      createElement('input', {
        className: 'dsh-my-memory-path-input',
        placeholder: strings.projectHint(),
        value: pathInput,
        onChange: (event) => onInput(event.target.value),
        onKeyDown: (event) => {
          if (event.key === 'Enter') onLoad(pathInput)
        },
      }),
      createElement(
        'button',
        { className: 'dsh-my-memory-btn', 'aria-label': strings.loadProject(), onClick: () => onLoad(pathInput) },
        icon.folder(14),
        strings.loadProject(),
      ),
      createElement(
        'button',
        { className: 'dsh-my-memory-btn', 'aria-label': strings.refresh(), onClick: () => onRefresh(pathInput) },
        icon.refresh(14),
        strings.refresh(),
      ),
    ),
    createElement('div', { className: 'dsh-my-memory-note' }, strings.confirmHint()),
  )
}

/** The two scopes side by side: global (default) + project (accented). */
function Sections({
  data,
  saved,
  drafts,
  editing,
  confirming,
  expanded,
  sortOrder,
  entryLimit,
  onDraft,
  onEdit,
  onEditDesc,
  onCancelEdit,
  onConfirm,
  onCancelConfirm,
  onToggle,
  onSort,
  onCommit,
}) {
  const blockProps = {
    drafts,
    editing,
    confirming,
    expanded,
    sortOrder,
    entryLimit,
    onDraft,
    onEdit,
    onEditDesc,
    onCancelEdit,
    onConfirm,
    onCancelConfirm,
    onToggle,
    onSort,
    onCommit,
  }
  return createElement(
    'div',
    { className: 'dsh-my-memory-sections' },
    createElement(SectionBlock, {
      scope: 'global',
      title: strings.globalSection(),
      note: strings.globalNote(),
      data: data.global,
      ...blockProps,
    }),
    createElement(SectionBlock, {
      scope: 'project',
      title: strings.projectSection(),
      note: strings.projectNote(),
      data: data.project,
      ...blockProps,
    }),
    saved
      ? createElement('div', { className: 'dsh-my-memory-status dsh-my-memory-saved' }, icon.check(14), strings.saved())
      : null,
  )
}

/** One scope's section: 区块标题 / 徽标 / 排序开关 / 列表 / 新增栏 / 确认面板。 */
function SectionBlock({
  scope,
  title,
  note,
  data,
  drafts,
  editing,
  confirming,
  expanded,
  sortOrder,
  entryLimit,
  onDraft,
  onEdit,
  onEditDesc,
  onCancelEdit,
  onConfirm,
  onCancelConfirm,
  onToggle,
  onSort,
  onCommit,
}) {
  const isProject = scope === 'project'
  // 徽标：分类 + 数量（不再重复标题文字；项目加载后附带项目根路径）。
  const badge =
    scope === 'global'
      ? strings.countBadge(strings.globalScope(), data.items.length)
      : data.cwd !== ''
        ? strings.projectBadge(data.projectRoot, data.items.length)
        : strings.countBadge(strings.projectScope(), data.items.length)
  const order = sortOrder[scope]
  const items = sortMemories(data.items, order)
  const rows = buildRows(items, scope, editing, onEdit, onEditDesc, onCancelEdit, onConfirm, expanded, onToggle)
  // 空状态：无会话项目时提示输入项目根路径（issue #104），否则提示新增（issue #110 视觉统一）。
  const emptyHint = isProject && data.cwd === '' ? strings.projectEmptyHint() : undefined
  return createElement(
    'div',
    { className: `dsh-my-memory-section${isProject ? ' dsh-my-memory-section-project' : ''}` },
    createElement(
      'div',
      { className: 'dsh-my-memory-section-head' },
      createElement('span', { className: 'dsh-my-memory-section-title' }, title),
      createElement('span', { className: 'dsh-my-memory-badge' }, badge),
      createElement(SortToggle, { scope, order, onSort }),
    ),
    createElement('div', { className: 'dsh-my-memory-note' }, note),
    rows.length === 0 ? createElement(EmptyState, { hint: emptyHint }) : rows,
    createElement(AddBar, {
      scope,
      value: drafts[scope],
      entryLimit,
      onChange: (value) => onDraft(scope, value),
      onAdd: () => onConfirm({ kind: 'add', scope, desc: drafts[scope] }),
    }),
    confirming !== null && confirming.scope === scope
      ? createElement(ConfirmPanel, {
          confirm: confirming,
          entryLimit,
          onCancel: onCancelConfirm,
          onOk: () => onCommit(confirming),
        })
      : null,
  )
}
