// ── view: Plugin Manager settings tab ──────────────────────────────────
// npm brand badge for market rows (badgeIcon from the shared icons part):
// brand fill + contrast ink, same family as the FILE_BADGES chips.
const NPM_BADGE = ['#CB3837', '#ffffff', 'npm']

function createActions({ setInstalled, setUpdates, setNotice, setError, setInstalling, setUninstalling }) {
  const reloadInstalled = () => {
    fetchInstalled()
      .then((value) => setInstalled(value.entries ?? []))
      .catch(() => setError(true))
  }
  const runUpdates = () => {
    setError(false)
    fetchUpdates()
      .then((value) => setUpdates(value.outdated ?? []))
      .catch(() => setError(true))
  }
  const install = (source) => {
    setError(false)
    setInstalling(source)
    postInstall(source)
      .then(() => {
        setNotice(strings.installDone())
        reloadInstalled()
      })
      .catch((error) => setError(error.message ?? true))
      .finally(() => setInstalling(null))
  }
  const uninstall = (name) => {
    setError(false)
    setUninstalling(name)
    postUninstall(name)
      .then(() => {
        setNotice(strings.uninstallDone())
        reloadInstalled()
      })
      .catch((error) => setError(error.message ?? true))
      .finally(() => setUninstalling(null))
  }
  return { reloadInstalled, runUpdates, install, uninstall }
}

function PluginManagerView() {
  const [installed, setInstalled] = useState(null)
  const [updates, setUpdates] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(false)
  const [installing, setInstalling] = useState(null)
  const [uninstalling, setUninstalling] = useState(null)
  const actions = createActions({ setInstalled, setUpdates, setNotice, setError, setInstalling, setUninstalling })

  useEffect(() => {
    actions.reloadInstalled()
  }, [])

  // Success notices auto-dismiss after 3s (write ops must still show them).
  useEffect(() => {
    if (notice === '') return
    const timer = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-root' },
    createElement('div', { className: 'dsh-my-plugin-manager-hint' }, strings.installHint()),
    error
      ? createElement(
          'div',
          { className: 'dsh-my-plugin-manager-error' },
          typeof error === 'string' ? `${strings.actionFailed()}：${error}` : strings.loadError(),
        )
      : null,
    notice !== ''
      ? createElement('div', { className: 'dsh-my-plugin-manager-status dsh-my-plugin-manager-saved' }, notice)
      : null,
    createElement(InstalledSection, { installed, updates, actions, uninstalling }),
    createElement(MarketSection, { actions, installing }),
  )
}

/** 已安装清单 + 更新检查。 */
function InstalledSection({ installed, updates, actions, uninstalling }) {
  const rows =
    installed === null
      ? null
      : installed.length === 0
        ? createElement(
            'div',
            { className: 'dsh-my-plugin-manager-empty' },
            icon.file(18),
            strings.emptyInstalled(),
            createElement('span', { className: 'dsh-my-plugin-manager-empty-hint' }, strings.emptyInstalledHint()),
          )
        : installed.map((entry) =>
            createElement(InstalledRow, {
              key: entry.moduleName,
              entry,
              outdated: outdatedOf(updates, entry.moduleName),
              onUninstall: () => actions.uninstall(entry.moduleName),
              uninstalling: uninstalling === entry.moduleName,
            }),
          )
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-section' },
    createElement(
      'div',
      { className: 'dsh-my-plugin-manager-section-head' },
      createElement('span', { className: 'dsh-my-plugin-manager-section-title' }, strings.installed()),
      createElement(
        'span',
        { className: 'dsh-my-plugin-manager-section-head-actions' },
        createElement(
          'button',
          {
            className: 'dsh-my-plugin-manager-iconbtn dsh-my-plugin-manager-iconbtn-xs',
            onClick: actions.runUpdates,
            title: strings.checkUpdates(),
            'aria-label': strings.checkUpdates(),
          },
          icon.refresh(14),
        ),
      ),
    ),
    installed === null ? createElement('div', { className: 'dsh-my-plugin-manager-status' }, strings.loading()) : rows,
    updates !== null && updates.length > 0
      ? createElement(
          'div',
          { className: 'dsh-my-plugin-manager-status dsh-my-plugin-manager-new' },
          strings.updatesAvailable(updates.length),
        )
      : updates !== null
        ? createElement('div', { className: 'dsh-my-plugin-manager-status' }, strings.noUpdates())
        : null,
  )
}

/** One installed plugin row: icon / name / state chip / version chip + uninstall. */
function InstalledRow({ entry, outdated, onUninstall, uninstalling }) {
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-row' },
    createElement(
      'div',
      { className: 'dsh-my-plugin-manager-row-head' },
      createElement('span', { className: 'dsh-my-plugin-manager-row-icon' }, icon.file(16)),
      createElement('span', { className: 'dsh-my-plugin-manager-name' }, entry.moduleName),
      createElement(
        'span',
        {
          className: `dsh-my-plugin-manager-state ${entry.enabled ? 'dsh-my-plugin-manager-state-on' : 'dsh-my-plugin-manager-state-off'}`,
        },
        entry.enabled ? strings.running() : strings.disabled(),
      ),
      createElement(
        'span',
        { className: 'dsh-my-plugin-manager-ver' },
        entry.version === '' ? strings.noVersion() : `v${entry.version}`,
      ),
    ),
    outdated !== null
      ? createElement(
          'div',
          { className: 'dsh-my-plugin-manager-actions' },
          createElement(
            'span',
            { className: 'dsh-my-plugin-manager-update' },
            `${outdated.current} → ${outdated.latest}`,
          ),
        )
      : null,
    createElement(
      'div',
      { className: 'dsh-my-plugin-manager-actions' },
      createElement(
        'button',
        {
          className: 'dsh-my-plugin-manager-btn dsh-my-plugin-manager-btn-danger',
          onClick: onUninstall,
          disabled: uninstalling,
        },
        icon.trash(14),
        uninstalling ? strings.uninstalling() : strings.uninstall(),
      ),
    ),
  )
}

/** 市场: npm 搜索 + 一键安装。 */
function MarketSection({ actions, installing }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const runSearch = () => {
    if (query.trim() === '') return
    setSearching(true)
    setSearchError(false)
    fetchSearch(query)
      .then((value) => {
        setResults(value.results ?? [])
        setSearching(false)
      })
      .catch(() => {
        setSearching(false)
        setSearchError(true)
      })
  }
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-section' },
    createElement(
      'div',
      { className: 'dsh-my-plugin-manager-section-head' },
      createElement('span', { className: 'dsh-my-plugin-manager-section-title' }, strings.market()),
    ),
    createElement(
      'div',
      { className: 'dsh-my-plugin-manager-searchbar' },
      createElement('input', {
        className: 'dsh-my-plugin-manager-search-input',
        placeholder: strings.searchPlaceholder(),
        value: query,
        onChange: (event) => setQuery(event.target.value),
        onKeyDown: (event) => {
          if (event.key === 'Enter') runSearch()
        },
      }),
      createElement(
        'button',
        {
          className: 'dsh-my-plugin-manager-btn dsh-my-plugin-manager-btn-primary',
          onClick: runSearch,
          disabled: searching,
        },
        icon.search(14),
        strings.search(),
      ),
    ),
    searchError ? createElement('div', { className: 'dsh-my-plugin-manager-error' }, strings.searchFailed()) : null,
    searching
      ? createElement('div', { className: 'dsh-my-plugin-manager-status' }, strings.loading())
      : marketRows(results, actions.install, installing),
  )
}

/** Market rows: placeholder / empty / result list. */
function marketRows(results, install, installing) {
  if (results === null)
    return createElement(
      'div',
      { className: 'dsh-my-plugin-manager-empty' },
      icon.search(18),
      strings.emptySearch(),
      createElement('span', { className: 'dsh-my-plugin-manager-empty-hint' }, strings.emptySearchHint()),
    )
  if (results.length === 0)
    return createElement(
      'div',
      { className: 'dsh-my-plugin-manager-empty' },
      icon.search(18),
      strings.noResults(),
      createElement('span', { className: 'dsh-my-plugin-manager-empty-hint' }, strings.noResultsHint()),
    )
  return results.map((item) =>
    createElement(MarketRow, {
      key: item.name,
      item,
      onInstall: () => install(item.name),
      installing: installing === item.name,
    }),
  )
}

/** One market search result row: npm badge / name / version chip + install. */
function MarketRow({ item, onInstall, installing }) {
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-row' },
    createElement(
      'div',
      { className: 'dsh-my-plugin-manager-row-head' },
      createElement('span', { className: 'dsh-my-plugin-manager-row-icon' }, badgeIcon(NPM_BADGE, 16)),
      createElement('span', { className: 'dsh-my-plugin-manager-name' }, item.name),
      createElement('span', { className: 'dsh-my-plugin-manager-ver' }, `v${item.version}`),
      item.author !== '' ? createElement('span', { className: 'dsh-my-plugin-manager-author' }, item.author) : null,
    ),
    createElement('div', { className: 'dsh-my-plugin-manager-desc' }, item.description),
    createElement(
      'div',
      { className: 'dsh-my-plugin-manager-actions' },
      createElement(
        'button',
        {
          className: 'dsh-my-plugin-manager-btn dsh-my-plugin-manager-btn-primary',
          onClick: onInstall,
          disabled: installing,
        },
        icon.plus(14),
        installing ? strings.installing() : strings.install(),
      ),
    ),
  )
}

/** The matching update entry for a module, if any. */
function outdatedOf(updates, moduleName) {
  if (!Array.isArray(updates)) return null
  const hit = updates.find((entry) => entry.name === moduleName)
  return hit === undefined ? null : hit
}
