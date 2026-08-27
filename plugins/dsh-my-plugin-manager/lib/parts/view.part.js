    // ── view: Plugin Manager settings tab ──────────────────────────────────
    function createActions({ setInstalled, setUpdates, setNotice, setError }) {
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
        postInstall(source)
          .then(() => {
            setNotice(strings.installDone())
            reloadInstalled()
          })
          .catch((error) => setError(error.message ?? true))
      }
      const uninstall = (name) => {
        setError(false)
        postUninstall(name)
          .then(() => {
            setNotice(strings.uninstallDone())
            reloadInstalled()
          })
          .catch((error) => setError(error.message ?? true))
      }
      return { reloadInstalled, runUpdates, install, uninstall }
    }

    function PluginManagerView() {
      const [installed, setInstalled] = useState(null)
      const [updates, setUpdates] = useState(null)
      const [notice, setNotice] = useState('')
      const [error, setError] = useState(false)
      const actions = createActions({ setInstalled, setUpdates, setNotice, setError })

      useEffect(() => {
        actions.reloadInstalled()
      }, [])

      return createElement('div', { className: 'dpm-root' },
        createElement('div', { className: 'dpm-hint' }, strings.installHint()),
        error ? createElement('div', { className: 'dpm-error' },
          typeof error === 'string' ? `${strings.actionFailed()}：${error}` : strings.loadError()) : null,
        notice !== '' ? createElement('div', { className: 'dpm-status dpm-saved' }, notice) : null,
        createElement(InstalledSection, { installed, updates, actions }),
        createElement(MarketSection, { actions }),
      )
    }

    /** 已安装清单 + 更新检查。 */
    function InstalledSection({ installed, updates, actions }) {
      const rows = installed === null
        ? null
        : installed.length === 0
          ? createElement('div', { className: 'dpm-empty' }, strings.emptyInstalled())
          : installed.map((entry) =>
            createElement(InstalledRow, {
              key: entry.moduleName,
              entry,
              outdated: outdatedOf(updates, entry.moduleName),
              onUninstall: () => actions.uninstall(entry.moduleName),
            }))
      return createElement('div', { className: 'dpm-section' },
        createElement('div', { className: 'dpm-section-title' }, strings.installed()),
        installed === null ? createElement('div', { className: 'dpm-status' }, strings.loading())
          : rows,
        createElement('div', { className: 'dpm-actions' },
          createElement('button', { className: 'dpm-btn', onClick: actions.runUpdates }, strings.checkUpdates()),
        ),
        updates !== null && updates.length > 0
          ? createElement('div', { className: 'dpm-status dpm-new' }, strings.updatesAvailable(updates.length))
          : updates !== null
            ? createElement('div', { className: 'dpm-status' }, strings.noUpdates())
            : null,
      )
    }

    /** One installed plugin row: name / version / state + uninstall. */
    function InstalledRow({ entry, outdated, onUninstall }) {
      return createElement('div', { className: 'dpm-row' },
        createElement('div', { className: 'dpm-row-head' },
          createElement('span', { className: 'dpm-name' }, entry.moduleName),
          createElement('span', { className: 'dpm-ver' },
            `${strings.version()} ${entry.version === '' ? strings.noVersion() : entry.version}`),
          outdated !== null ? createElement('span', { className: 'dpm-ver dpm-new' },
            `${outdated.current} → ${outdated.latest}`) : null,
          createElement('span', { className: 'dpm-state' },
            entry.enabled ? strings.running() : strings.disabled()),
        ),
        createElement('div', { className: 'dpm-actions' },
          createElement('button', { className: 'dpm-btn dpm-btn-danger', onClick: onUninstall }, strings.uninstall()),
        ),
      )
    }

    /** 市场: npm 搜索 + 一键安装。 */
    function MarketSection({ actions }) {
      const [query, setQuery] = useState('')
      const [results, setResults] = useState(null)
      const [searching, setSearching] = useState(false)
      const runSearch = () => {
        if (query.trim() === '') return
        setSearching(true)
        fetchSearch(query)
          .then((value) => {
            setResults(value.results ?? [])
            setSearching(false)
          })
          .catch(() => setSearching(false))
      }
      return createElement('div', { className: 'dpm-section' },
        createElement('div', { className: 'dpm-section-title' }, strings.market()),
        createElement('div', { className: 'dpm-searchbar' },
          createElement('input', {
            className: 'dpm-search-input',
            placeholder: strings.searchPlaceholder(),
            value: query,
            onChange: (event) => setQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') runSearch()
            },
          }),
          createElement('button', { className: 'dpm-btn dpm-btn-primary', onClick: runSearch }, strings.search()),
        ),
        searching ? createElement('div', { className: 'dpm-status' }, strings.loading())
          : marketRows(results, actions.install),
      )
    }

    /** Market rows: placeholder / empty / result list. */
    function marketRows(results, install) {
      if (results === null) return createElement('div', { className: 'dpm-empty' }, strings.emptySearch())
      if (results.length === 0) return createElement('div', { className: 'dpm-empty' }, strings.noResults())
      return results.map((item) =>
        createElement(MarketRow, {
          key: item.name,
          item,
          onInstall: () => install(item.name),
        }))
    }

    /** One market search result row with an install button. */
    function MarketRow({ item, onInstall }) {
      return createElement('div', { className: 'dpm-row' },
        createElement('div', { className: 'dpm-row-head' },
          createElement('span', { className: 'dpm-name' }, item.name),
          createElement('span', { className: 'dpm-ver' }, item.version),
          item.author !== '' ? createElement('span', { className: 'dpm-state' }, item.author) : null,
        ),
        createElement('div', { className: 'dpm-desc' }, item.description),
        createElement('div', { className: 'dpm-actions' },
          createElement('button', { className: 'dpm-btn dpm-btn-primary', onClick: onInstall }, strings.install()),
        ),
      )
    }

    /** The matching update entry for a module, if any. */
    function outdatedOf(updates, moduleName) {
      if (!Array.isArray(updates)) return null
      const hit = updates.find((entry) => entry.name === moduleName)
      return hit === undefined ? null : hit
    }
