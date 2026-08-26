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
      const load = (cwd) => {
        setLoading(true)
        setError(false)
        setSaved(false)
        fetchList(cwd)
          .then((value) => {
            setData(value)
            setLoading(false)
          })
          .catch(() => {
            setLoading(false)
            setError(true)
          })
      }
      const save = (scope, disabled, cwd) => {
        setSaved(false)
        setError(false)
        saveConfig(scope, disabled, cwd)
          .then(() => {
            setSaved(true)
            load(scope === 'project' ? (cwd || '') : '')
          })
          .catch(() => setError(true))
      }
      return {
        load,
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

      return createElement('div', { className: 'dsm-root' },
        createElement(Toolbar, { pathInput, onInput: setPathInput, onLoad: actions.load }),
        error ? createElement('div', { className: 'dsm-error' }, strings.loadError()) : null,
        loading ? createElement('div', { className: 'dsm-status' }, strings.loading())
          : data === null ? null : createElement(Sections, {
            data,
            saved,
            onToggle: (scope, name, isDisabled) => actions.toggle(data, scope, name, isDisabled),
          }),
      )
    }

    /** Path input + project config note. */
    function Toolbar({ pathInput, onInput, onLoad }) {
      return createElement('div', null,
        createElement('div', { className: 'dsm-pathbar' },
          createElement('input', {
            className: 'dsm-path-input',
            placeholder: strings.projectHint(),
            value: pathInput,
            onChange: (event) => onInput(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') onLoad(pathInput)
            },
          }),
          createElement('button', { className: 'dsm-btn', onClick: () => onLoad(pathInput) }, strings.loadProject()),
        ),
        createElement('div', { className: 'dsm-note' }, strings.projectConfigNote()),
      )
    }

    /** The global + project toggle sections and the saved indicator. */
    function Sections({ data, saved, onToggle }) {
      return createElement('div', null,
        createElement(SectionBlock, {
          title: strings.globalSection(),
          hint: strings.disabledHint(),
          skills: data.skills,
          disabledNames: data.globalDisabled,
          onToggle: (name, isDisabled) => onToggle('global', name, isDisabled),
        }),
        createElement(SectionBlock, {
          title: projectTitleOf(data),
          hint: data.cwd === '' ? strings.projectHint() : strings.disabledHint(),
          skills: data.skills,
          disabledNames: data.projectDisabled,
          onToggle: (name, isDisabled) => onToggle('project', name, isDisabled),
          locked: data.cwd === '',
        }),
        saved ? createElement('div', { className: 'dsm-status dsm-saved' }, strings.saved()) : null,
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
      return createElement('div', { className: 'dsm-section' },
        createElement('div', { className: 'dsm-section-title' }, title),
        createElement('div', { className: 'dsm-hint' }, hint),
        rows.length === 0 ? createElement('div', { className: 'dsm-empty' }, strings.empty())
          : rows,
      )
    }

    function SkillRow({ skill, disabled, locked, onToggle }) {
      return createElement('div', { className: `dsm-row${disabled ? ' dsm-row-disabled' : ''}` },
        createElement('div', { className: 'dsm-row-head' },
          createElement('span', { className: 'dsm-name' }, skill.name),
          createElement('span', { className: 'dsm-src' },
            isProjectSource(skill.source) ? strings.sourceProject(skill.source) : strings.sourceGlobal(skill.source)),
          createElement('button', {
            className: `dsm-toggle${disabled ? ' dsm-toggle-on' : ''}`,
            disabled: locked,
            onClick: onToggle,
            'aria-label': `${skill.name}: ${disabled ? strings.disabled() : strings.enabled()}`,
          }, disabled ? strings.disabled() : strings.enabled()),
        ),
        createElement('div', { className: 'dsm-desc' }, skill.description),
      )
    }
