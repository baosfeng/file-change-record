// ── view: Skill Manager settings tab ───────────────────────────────────
function isProjectSource(source) {
  return typeof source === 'string' && source.startsWith('project-')
}

/** Toggle one name in a disabled list (remove when disabling, add when enabling). */
function flipDisabled(list, name, isDisabled) {
  return isDisabled ? list.filter((n) => n !== name) : [...new Set([...list, name])]
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
  const load = (cwd) => refreshWith(fetchList, cwd)
  const rescan = (cwd) => refreshWith(rescanCatalog, cwd)
  const save = (scope, disabled, cwd) => {
    setSaved(false)
    setError(false)
    saveConfig(scope, disabled, cwd)
      .then(() => {
        setSaved(true)
        load(scope === 'project' ? cwd || '' : '')
      })
      .catch(() => setError(true))
  }
  return {
    load,
    rescan,
    toggle: (data, scope, name, isDisabled) => {
      if (scope === 'project' && data.cwd === '') return
      const list = scope === 'global' ? data.globalDisabled : data.projectDisabled
      save(scope, flipDisabled(list, name, isDisabled), scope === 'project' ? data.cwd : '')
    },
  }
}

function SkillManagerView() {
  const [data, setData] = useState(null)
  const [pathInput, setPathInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)
  const actions = createActions({ setData, setLoading, setError, setSaved })

  useEffect(() => {
    actions.load('')
  }, [])

  return createElement(
    'div',
    { className: 'dsm-root' },
    createElement(Toolbar, {
      pathInput,
      onInput: setPathInput,
      onLoad: actions.load,
      onRescan: actions.rescan,
    }),
    error ? createElement('div', { className: 'dsm-error' }, strings.loadError()) : null,
    loading
      ? createElement('div', { className: 'dsm-status' }, strings.loading())
      : data === null
        ? null
        : createElement(Sections, {
            data,
            saved,
            onToggle: (scope, name, isDisabled) => actions.toggle(data, scope, name, isDisabled),
          }),
  )
}

/** Path input + refresh button + project config note. */
function Toolbar({ pathInput, onInput, onLoad, onRescan }) {
  return createElement(
    'div',
    null,
    createElement(
      'div',
      { className: 'dsm-pathbar' },
      createElement('input', {
        className: 'dsm-path-input',
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
          className: 'dsm-btn',
          'aria-label': strings.loadProject(),
          onClick: () => onLoad(pathInput),
        },
        strings.loadProject(),
      ),
      createElement(
        'button',
        {
          className: 'dsm-btn',
          'aria-label': strings.refresh(),
          onClick: () => onRescan(pathInput),
        },
        strings.refresh(),
      ),
    ),
    createElement('div', { className: 'dsm-note' }, strings.projectConfigNote()),
  )
}

/** The toggle section for the current view (global or project) + diagnostics. */
function Sections({ data, saved, onToggle }) {
  const projectMode = data.cwd !== ''
  return createElement(
    'div',
    null,
    projectMode
      ? createElement(SectionBlock, {
          title: projectTitleOf(data),
          hint: strings.disabledHint(),
          skills: data.skills,
          disabledNames: data.projectDisabled,
          onToggle: (name, isDisabled) => onToggle('project', name, isDisabled),
        })
      : createElement(SectionBlock, {
          title: strings.globalSection(),
          hint: strings.disabledHint(),
          skills: data.skills,
          disabledNames: data.globalDisabled,
          onToggle: (name, isDisabled) => onToggle('global', name, isDisabled),
        }),
    createElement(DiagnosticsBlock, { diagnostics: data.diagnostics }),
    saved ? createElement('div', { className: 'dsm-status dsm-saved' }, strings.saved()) : null,
  )
}

/** Skipped skill entries reported by the server-side directory scan. */
function DiagnosticsBlock({ diagnostics }) {
  const missing = diagnostics?.missing ?? []
  if (missing.length === 0) return null
  return createElement(
    'div',
    { className: 'dsm-section' },
    createElement('div', { className: 'dsm-section-title' }, strings.diagnosticsTitle()),
    createElement('div', { className: 'dsm-hint' }, strings.diagnosticsHint()),
    missing.map((item) =>
      createElement(
        'div',
        { key: item.path, className: 'dsm-diag-row' },
        createElement('span', { className: 'dsm-name' }, item.name),
        createElement('span', { className: 'dsm-diag-reason' }, strings.diagReason(item.reason)),
        createElement('span', { className: 'dsm-diag-path' }, item.path),
      ),
    ),
  )
}

function projectTitleOf(data) {
  return data.projectRoot === ''
    ? strings.projectSection()
    : `${strings.projectSection()} · ${strings.projectRoot()}${data.projectRoot}`
}

function SectionBlock({ title, hint, skills, disabledNames, onToggle, locked }) {
  const rows = skills.map((skill) =>
    createElement(SkillRow, {
      key: skill.name,
      skill,
      disabled: disabledNames.includes(skill.name),
      locked,
      onToggle: () => onToggle(skill.name, disabledNames.includes(skill.name)),
    }),
  )
  return createElement(
    'div',
    { className: 'dsm-section' },
    createElement('div', { className: 'dsm-section-title' }, title),
    createElement('div', { className: 'dsm-hint' }, hint),
    rows.length === 0 ? createElement('div', { className: 'dsm-empty' }, strings.empty()) : rows,
  )
}

function SkillRow({ skill, disabled, locked, onToggle }) {
  return createElement(
    'div',
    { className: `dsm-row${disabled ? ' dsm-row-disabled' : ''}` },
    createElement(
      'div',
      { className: 'dsm-row-head' },
      createElement('span', { className: 'dsm-name' }, skill.name),
      skill.cataloged === false
        ? createElement(
            'span',
            { className: 'dsm-src dsm-src-warn', title: strings.notCatalogedHint() },
            strings.notCataloged(),
          )
        : null,
      createElement(
        'span',
        { className: 'dsm-src' },
        isProjectSource(skill.source) ? strings.sourceProject(skill.source) : strings.sourceGlobal(skill.source),
      ),
      createElement(
        'button',
        {
          className: `dsm-toggle${disabled ? ' dsm-toggle-on' : ''}`,
          disabled: locked,
          onClick: onToggle,
          'aria-label': `${skill.name}: ${disabled ? strings.disabled() : strings.enabled()}`,
        },
        disabled ? strings.disabled() : strings.enabled(),
      ),
    ),
    createElement('div', { className: 'dsm-desc' }, skill.description),
  )
}
