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

/** Replace one scope's data inside the two-scope state. */
function mergeScope(data, scope, value) {
  return scope === 'global' ? { ...data, global: value } : { ...data, project: value }
}

/** Data actions bound to the state setters (created once per component). */
function createActions({ setData, setLoading, setError, setSaved }) {
  const applyValue = (value) => {
    setData(value)
    setLoading(false)
  }
  const refreshWith = (fetcher, cwd) => {
    setLoading(true)
    setError(false)
    setSaved(false)
    fetcher(cwd)
      .then(applyValue)
      .catch(() => {
        setLoading(false)
        setError(true)
      })
  }
  return {
    load: (cwd) => refreshWith(fetchAll, cwd),
    refresh: (cwd) => refreshWith(fetchAll, cwd),
  }
}

function MemoryView() {
  const [data, setData] = useState(null)
  const [pathInput, setPathInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)
  const [drafts, setDrafts] = useState({ global: '', project: '' })
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const actions = createActions({ setData, setLoading, setError, setSaved })

  useEffect(() => {
    actions.load('')
  }, [])

  const commit = createCommitHandler({
    data,
    setData,
    setSaved,
    setError,
    setDrafts,
    setEditing,
    setConfirming,
  })

  return createElement(
    'div',
    { className: 'dmm-root' },
    createElement(Toolbar, {
      pathInput,
      onInput: setPathInput,
      onLoad: actions.load,
      onRefresh: actions.refresh,
    }),
    error ? createElement('div', { className: 'dmm-error' }, strings.loadError()) : null,
    loading
      ? createElement('div', { className: 'dmm-status' }, strings.loading())
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

/** One confirmed write (add / update / delete) → POST + refresh the scope. */
function createCommitHandler({ data, setData, setSaved, setError, setDrafts, setEditing, setConfirming }) {
  return (confirm) => {
    setSaved(false)
    setError(false)
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
      .catch(() => setError(true))
  }
}

/** Path input + load/refresh buttons + consent note. */
function Toolbar({ pathInput, onInput, onLoad, onRefresh }) {
  return createElement(
    'div',
    null,
    createElement(
      'div',
      { className: 'dmm-pathbar' },
      createElement('input', {
        className: 'dmm-path-input',
        placeholder: strings.projectHint(),
        value: pathInput,
        onChange: (event) => onInput(event.target.value),
        onKeyDown: (event) => {
          if (event.key === 'Enter') onLoad(pathInput)
        },
      }),
      createElement(
        'button',
        {
          className: 'dmm-btn',
          'aria-label': strings.loadProject(),
          onClick: () => onLoad(pathInput),
        },
        strings.loadProject(),
      ),
      createElement(
        'button',
        {
          className: 'dmm-btn',
          'aria-label': strings.refresh(),
          onClick: () => onRefresh(pathInput),
        },
        strings.refresh(),
      ),
    ),
    createElement('div', { className: 'dmm-note' }, strings.confirmHint()),
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
  return createElement(
    'div',
    { className: 'dmm-sections' },
    createElement(SectionBlock, {
      scope: 'global',
      title: strings.globalSection(),
      badge: strings.globalSection(),
      note: strings.globalNote(),
      data: data.global,
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
    }),
    createElement(SectionBlock, {
      scope: 'project',
      title: strings.projectSection(),
      badge: data.project.cwd !== '' ? strings.projectRoot() + data.project.projectRoot : strings.projectSection(),
      note: strings.projectNote(),
      data: data.project,
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
    }),
    saved ? createElement('div', { className: 'dmm-status dmm-saved' }, strings.saved()) : null,
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
    { className: `dmm-section${isProject ? ' dmm-section-project' : ''}` },
    createElement(
      'div',
      { className: 'dmm-section-head' },
      createElement('span', { className: 'dmm-section-title' }, title),
      createElement('span', { className: 'dmm-badge' }, badge),
    ),
    createElement('div', { className: 'dmm-note' }, note),
    rows.length === 0 ? createElement('div', { className: 'dmm-empty' }, strings.empty()) : rows,
    createElement(
      'div',
      { className: 'dmm-addbar' },
      createElement('input', {
        className: 'dmm-add-input',
        placeholder: strings.addPlaceholder(),
        value: drafts[scope],
        onChange: (event) => onDraft(scope, event.target.value),
      }),
      createElement(
        'button',
        {
          className: 'dmm-btn-save',
          'aria-label': `${strings.add()} ${scope}`,
          onClick: () => onConfirm({ kind: 'add', scope, desc: drafts[scope] }),
        },
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

/** Build the memory rows of one scope (edit mode swaps in an input). */
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

/** One memory row: desc + meta + edit/delete; edit mode swaps in an input. */
function MemoryRow({ item, isEditing, editingDesc, onEdit, onEditDesc, onCancelEdit, onSaveEdit, onDelete }) {
  if (isEditing) {
    return createElement(
      'div',
      { className: 'dmm-row' },
      createElement('input', {
        className: 'dmm-add-input',
        value: editingDesc,
        onChange: (event) => onEditDesc(event.target.value),
      }),
      createElement(
        'div',
        { className: 'dmm-actions' },
        createElement('button', { className: 'dmm-btn-save', onClick: onSaveEdit }, strings.save()),
        createElement('button', { className: 'dmm-btn-edit', onClick: onCancelEdit }, strings.cancel()),
      ),
    )
  }
  return createElement(
    'div',
    { className: 'dmm-row' },
    createElement(
      'div',
      { className: 'dmm-row-head' },
      createElement('span', { className: 'dmm-desc' }, item.desc),
      createElement(
        'div',
        { className: 'dmm-actions' },
        createElement(
          'button',
          {
            className: 'dmm-btn-edit',
            'aria-label': `${strings.edit()} ${item.id}`,
            onClick: onEdit,
          },
          strings.edit(),
        ),
        createElement(
          'button',
          {
            className: 'dmm-btn-danger',
            'aria-label': `${strings.delete()} ${item.id}`,
            onClick: onDelete,
          },
          strings.delete(),
        ),
      ),
    ),
    createElement('div', { className: 'dmm-meta' }, strings.updatedAt(item.updatedAt)),
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
    { className: `dmm-confirm dmm-confirm-${isDelete ? 'delete' : 'save'}` },
    createElement('div', { className: 'dmm-confirm-text' }, text),
    createElement('div', { className: 'dmm-confirm-desc' }, confirm.desc),
    createElement(
      'div',
      { className: 'dmm-confirm-actions' },
      createElement(
        'button',
        {
          className: `dmm-confirm-ok dmm-confirm-ok-${isDelete ? 'delete' : 'save'}`,
          onClick: onOk,
        },
        isDelete ? strings.confirmDeleteBtn() : strings.confirmSave(),
      ),
      createElement('button', { className: 'dmm-confirm-cancel', onClick: onCancel }, strings.cancel()),
    ),
  )
}
