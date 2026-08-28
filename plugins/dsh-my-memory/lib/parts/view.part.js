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
  const actions = createActions({ setData, setLoading, setError, setSaved })

  useEffect(() => {
    actions.load('')
  }, [])

  const commit = createCommitHandler({ data, setData, setSaved, setError, setDrafts, setEditing, setConfirming })

  return createElement(
    'div',
    { className: 'dsh-my-memory-root' },
    createElement(Toolbar, { pathInput, onInput: setPathInput, onLoad: actions.load, onRefresh: actions.refresh }),
    error === null ? null : createElement(ErrorBanner, { kind: error, onRetry: () => actions.load(pathInput) }),
    loading
      ? createElement('div', { className: 'dsh-my-memory-status' }, strings.loading())
      : data === null
        ? null
        : createElement(Sections, {
            data,
            saved,
            drafts,
            editing,
            confirming,
            onDraft: (scope, value) => setDrafts({ ...drafts, [scope]: value }),
            onEdit: (scope, id, desc) => setEditing({ scope, id, desc }),
            onEditDesc: (value) => setEditing({ ...editing, desc: value }),
            onCancelEdit: () => setEditing(null),
            onConfirm: (confirm) => setConfirming(confirm),
            onCancelConfirm: () => setConfirming(null),
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
  onDraft,
  onEdit,
  onEditDesc,
  onCancelEdit,
  onConfirm,
  onCancelConfirm,
  onCommit,
}) {
  const blockProps = {
    drafts,
    editing,
    confirming,
    onDraft,
    onEdit,
    onEditDesc,
    onCancelEdit,
    onConfirm,
    onCancelConfirm,
    onCommit,
  }
  return createElement(
    'div',
    { className: 'dsh-my-memory-sections' },
    createElement(SectionBlock, {
      scope: 'global',
      title: strings.globalSection(),
      badge: strings.globalSection(),
      note: strings.globalNote(),
      data: data.global,
      ...blockProps,
    }),
    createElement(SectionBlock, {
      scope: 'project',
      title: strings.projectSection(),
      badge: data.project.cwd !== '' ? strings.projectRoot() + data.project.projectRoot : strings.projectSection(),
      note: strings.projectNote(),
      data: data.project,
      ...blockProps,
    }),
    saved
      ? createElement('div', { className: 'dsh-my-memory-status dsh-my-memory-saved' }, icon.check(14), strings.saved())
      : null,
  )
}

/** One scope's section: rows + add bar + inline confirmation panel. */
function SectionBlock({
  scope,
  title,
  badge,
  note,
  data,
  drafts,
  editing,
  confirming,
  onDraft,
  onEdit,
  onEditDesc,
  onCancelEdit,
  onConfirm,
  onCancelConfirm,
  onCommit,
}) {
  const isProject = scope === 'project'
  const rows = buildRows(data.items, scope, editing, onEdit, onEditDesc, onCancelEdit, onConfirm)
  return createElement(
    'div',
    { className: `dsh-my-memory-section${isProject ? ' dsh-my-memory-section-project' : ''}` },
    createElement(
      'div',
      { className: 'dsh-my-memory-section-head' },
      createElement('span', { className: 'dsh-my-memory-section-title' }, title),
      createElement('span', { className: 'dsh-my-memory-badge' }, badge),
    ),
    createElement('div', { className: 'dsh-my-memory-note' }, note),
    rows.length === 0 ? createElement(EmptyState) : rows,
    createElement(
      'div',
      { className: 'dsh-my-memory-addbar' },
      createElement('input', {
        className: 'dsh-my-memory-add-input',
        placeholder: strings.addPlaceholder(),
        value: drafts[scope],
        onChange: (event) => onDraft(scope, event.target.value),
      }),
      createElement(
        'button',
        {
          className: 'dsh-my-memory-btn-save',
          'aria-label': `${strings.add()} ${scope}`,
          onClick: () => onConfirm({ kind: 'add', scope, desc: drafts[scope] }),
        },
        icon.plus(14),
        strings.add(),
      ),
    ),
    confirming !== null && confirming.scope === scope
      ? createElement(ConfirmPanel, {
          confirm: confirming,
          onCancel: onCancelConfirm,
          onOk: () => onCommit(confirming),
        })
      : null,
  )
}

function EmptyState() {
  return createElement(
    'div',
    { className: 'dsh-my-memory-empty' },
    createElement('span', { className: 'dsh-my-memory-empty-icon' }, icon.file(16)),
    strings.empty(),
    createElement('span', { className: 'dsh-my-memory-empty-hint' }, strings.emptyHint()),
  )
}

function buildRows(items, scope, editing, onEdit, onEditDesc, onCancelEdit, onConfirm) {
  return items.map((item) => {
    const isEditing = editing !== null && editing.scope === scope && editing.id === item.id
    return createElement(MemoryRow, {
      key: item.id,
      item,
      isEditing,
      editingDesc: isEditing ? editing.desc : '',
      onEdit: () => onEdit(scope, item.id, item.desc),
      onEditDesc,
      onCancelEdit,
      onSaveEdit: () => onConfirm({ kind: 'update', scope, id: item.id, desc: editing.desc }),
      onDelete: () => onConfirm({ kind: 'delete', scope, id: item.id, desc: item.desc }),
    })
  })
}

function IconButton({ className, label, onClick, children }) {
  return createElement('button', { className, 'aria-label': label, onClick }, children)
}

/** One memory row: desc + meta + icon edit/delete; edit mode swaps in an input. */
function MemoryRow({ item, isEditing, editingDesc, onEdit, onEditDesc, onCancelEdit, onSaveEdit, onDelete }) {
  if (isEditing) {
    return createElement(
      'div',
      { className: 'dsh-my-memory-row' },
      createElement('input', {
        className: 'dsh-my-memory-add-input',
        value: editingDesc,
        onChange: (event) => onEditDesc(event.target.value),
      }),
      createElement(
        'div',
        { className: 'dsh-my-memory-actions' },
        createElement(
          'button',
          { className: 'dsh-my-memory-btn-save', onClick: onSaveEdit },
          icon.check(14),
          strings.save(),
        ),
        createElement(
          'button',
          { className: 'dsh-my-memory-btn', onClick: onCancelEdit },
          icon.close(14),
          strings.cancel(),
        ),
      ),
    )
  }
  return createElement(
    'div',
    { className: 'dsh-my-memory-row' },
    createElement(
      'div',
      { className: 'dsh-my-memory-row-head' },
      createElement('span', { className: 'dsh-my-memory-desc' }, item.desc),
      createElement(
        'div',
        { className: 'dsh-my-memory-actions' },
        createElement(
          IconButton,
          { className: 'dsh-my-memory-iconbtn', label: `${strings.edit()} ${item.id}`, onClick: onEdit },
          icon.pencil(14),
        ),
        createElement(
          IconButton,
          {
            className: 'dsh-my-memory-iconbtn dsh-my-memory-iconbtn-danger',
            label: `${strings.delete()} ${item.id}`,
            onClick: onDelete,
          },
          icon.trash(14),
        ),
      ),
    ),
    createElement('div', { className: 'dsh-my-memory-meta' }, strings.updatedAt(item.updatedAt)),
  )
}

/** Custom confirmation panel (ask-style, not the native confirm): delete is red, save is green. */
function ConfirmPanel({ confirm, onCancel, onOk }) {
  const isDelete = confirm.kind === 'delete'
  const text =
    confirm.kind === 'add'
      ? strings.confirmAdd()
      : confirm.kind === 'update'
        ? strings.confirmUpdate()
        : strings.confirmDelete()
  return createElement(
    'div',
    { className: `dsh-my-memory-confirm dsh-my-memory-confirm-${isDelete ? 'delete' : 'save'}` },
    createElement(
      'div',
      { className: 'dsh-my-memory-confirm-head' },
      isDelete ? icon.trash(15) : icon.check(15),
      createElement('div', { className: 'dsh-my-memory-confirm-text' }, text),
    ),
    createElement('div', { className: 'dsh-my-memory-confirm-desc' }, confirm.desc),
    createElement(
      'div',
      { className: 'dsh-my-memory-confirm-actions' },
      createElement(
        'button',
        {
          className: `dsh-my-memory-confirm-ok dsh-my-memory-confirm-ok-${isDelete ? 'delete' : 'save'}`,
          onClick: onOk,
        },
        isDelete ? icon.trash(14) : icon.check(14),
        isDelete ? strings.confirmDeleteBtn() : strings.confirmSave(),
      ),
      createElement(
        'button',
        { className: 'dsh-my-memory-confirm-cancel', onClick: onCancel },
        icon.close(14),
        strings.cancel(),
      ),
    ),
  )
}
