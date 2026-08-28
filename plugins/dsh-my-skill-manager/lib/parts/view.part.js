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
    { className: 'dsh-my-skill-manager-root' },
    createElement(Toolbar, {
      pathInput,
      onInput: setPathInput,
      onLoad: actions.load,
      onRescan: actions.rescan,
    }),
    error ? createElement('div', { className: 'dsh-my-skill-manager-error' }, strings.loadError()) : null,
    loading
      ? createElement('div', { className: 'dsh-my-skill-manager-status' }, strings.loading())
      : data === null
        ? null
        : createElement(Sections, {
            data,
            saved,
            onToggle: (scope, name, isDisabled) => actions.toggle(data, scope, name, isDisabled),
          }),
  )
}

/** Path input + icon buttons (load project / rescan) + config note. */
function Toolbar({ pathInput, onInput, onLoad, onRescan }) {
  return createElement(
    'div',
    { className: 'dsh-my-skill-manager-toolbar' },
    createElement(
      'div',
      { className: 'dsh-my-skill-manager-pathbar' },
      createElement('input', {
        className: 'dsh-my-skill-manager-path-input',
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
          className: 'dsh-my-skill-manager-iconbtn',
          'aria-label': strings.loadProject(),
          title: strings.loadProject(),
          onClick: () => onLoad(pathInput),
        },
        icon.folder(14),
      ),
      createElement(
        'button',
        {
          className: 'dsh-my-skill-manager-iconbtn',
          'aria-label': strings.refresh(),
          title: strings.refresh(),
          onClick: () => onRescan(pathInput),
        },
        icon.refresh(14),
      ),
    ),
    createElement('div', { className: 'dsh-my-skill-manager-note' }, strings.projectConfigNote()),
  )
}

/** The toggle section for the current view (global or project) + diagnostics. */
function Sections({ data, saved, onToggle }) {
  const projectMode = data.cwd !== ''
  return createElement(
    'div',
    { className: 'dsh-my-skill-manager-sections' },
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
    saved
      ? createElement('div', { className: 'dsh-my-skill-manager-status dsh-my-skill-manager-saved' }, strings.saved())
      : null,
  )
}

/** Skipped skill entries reported by the server-side directory scan:
 *  warn badge + key info (name/reason) + detail (path). */
function DiagnosticsBlock({ diagnostics }) {
  const missing = diagnostics?.missing ?? []
  if (missing.length === 0) return null
  return createElement(
    'div',
    { className: 'dsh-my-skill-manager-section' },
    createElement('div', { className: 'dsh-my-skill-manager-section-head' }, strings.diagnosticsTitle()),
    createElement('div', { className: 'dsh-my-skill-manager-hint' }, strings.diagnosticsHint()),
    missing.map((item) =>
      createElement(
        'div',
        { key: item.path, className: 'dsh-my-skill-manager-diag-row' },
        createElement('span', { className: 'dsh-my-skill-manager-diag-badge' }, strings.diagBadge()),
        createElement('span', { className: 'dsh-my-skill-manager-diag-name' }, item.name),
        createElement('span', { className: 'dsh-my-skill-manager-diag-reason' }, strings.diagReason(item.reason)),
        createElement('span', { className: 'dsh-my-skill-manager-diag-path' }, item.path),
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
    { className: 'dsh-my-skill-manager-section' },
    createElement(
      'div',
      { className: 'dsh-my-skill-manager-section-head' },
      createElement('span', { className: 'dsh-my-skill-manager-section-title' }, title),
    ),
    createElement('div', { className: 'dsh-my-skill-manager-hint' }, hint),
    rows.length === 0
      ? createElement(
          'div',
          { className: 'dsh-my-skill-manager-empty' },
          createElement('span', { className: 'dsh-my-skill-manager-empty-icon' }, icon.file(16)),
          strings.empty(),
          createElement('span', { className: 'dsh-my-skill-manager-empty-hint' }, strings.emptyHint()),
        )
      : rows,
  )
}

function SkillRow({ skill, disabled, locked, onToggle }) {
  return createElement(
    'div',
    { className: `dsh-my-skill-manager-row${disabled ? ' dsh-my-skill-manager-row-disabled' : ''}` },
    createElement(
      'div',
      { className: 'dsh-my-skill-manager-row-head' },
      createElement('span', { className: 'dsh-my-skill-manager-name' }, skill.name),
      skill.cataloged === false
        ? createElement(
            'span',
            { className: 'dsh-my-skill-manager-src dsh-my-skill-manager-src-warn', title: strings.notCatalogedHint() },
            strings.notCataloged(),
          )
        : null,
      createElement(
        'span',
        { className: 'dsh-my-skill-manager-src' },
        isProjectSource(skill.source) ? strings.sourceProject(skill.source) : strings.sourceGlobal(skill.source),
      ),
      createElement(
        'span',
        { className: `dsh-my-skill-manager-state${disabled ? '' : ' dsh-my-skill-manager-state-on'}` },
        disabled ? strings.disabled() : strings.enabled(),
      ),
      createElement(Switch, {
        checked: !disabled,
        disabled: locked,
        label: `${skill.name}: ${disabled ? strings.disabled() : strings.enabled()}`,
        onToggle,
      }),
    ),
    createElement('div', { className: 'dsh-my-skill-manager-desc' }, skill.description),
  )
}

/** Visual switch (role=switch): track + sliding thumb, checked = enabled.
 *  Semantics match the previous enable/disable text button exactly: clicking
 *  reports the CURRENT disabled state, and the parent flips the list. */
function Switch({ checked, disabled, label, onToggle }) {
  return createElement(
    'button',
    {
      type: 'button',
      role: 'switch',
      'aria-checked': checked,
      'aria-label': label,
      className: `dsh-my-skill-manager-switch${checked ? ' dsh-my-skill-manager-switch-on' : ''}`,
      disabled,
      onClick: onToggle,
    },
    createElement(
      'span',
      { className: 'dsh-my-skill-manager-switch-track' },
      createElement('span', { className: 'dsh-my-skill-manager-switch-thumb' }),
    ),
  )
}
