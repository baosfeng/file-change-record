// ── view ───────────────────────────────────────────────────────────────
/** State + data loading + user actions for the panel. Polls /guardian/api
 *  while the tab is visible; actions re-fetch on success, flag the load
 *  error banner on failure. */
function useGuardianState(visible) {
  const [state, setState] = useState({
    safeMode: false,
    staged: [],
    promoted: [],
    events: [],
    loaded: false,
  })
  const [loadFailed, setLoadFailed] = useState(false)

  const load = () => {
    api('state')
      .then((value) => {
        setState({ ...value, loaded: true })
        setLoadFailed(false)
      })
      .catch(() => setLoadFailed(true))
  }

  useEffect(() => {
    load()
    if (visible === false) return
    const timer = window.setInterval(load, POLL_MS)
    return () => window.clearInterval(timer)
  }, [visible])

  const onAction = (kind, entry) => {
    const request = { id: entry.id }
    const path = kind === 'retry' ? 'retry' : 'remove'
    return api(path, request)
      .then(() => load())
      .catch(() => setLoadFailed(true))
  }

  const onSafeMode = (enabled) => {
    api('safemode', { enabled })
      .then(() => load())
      .catch(() => setLoadFailed(true))
  }

  return { state, loadFailed, reload: load, onAction, onSafeMode }
}

/** Visual switch (role=switch): track + sliding thumb, checked = enabled.
 *  Semantics match the previous checkbox exactly: clicking reports the NEW
 *  checked state via onToggle. */
function Switch({ checked, disabled, label, onToggle }) {
  return createElement(
    'button',
    {
      type: 'button',
      role: 'switch',
      'aria-checked': checked,
      'aria-label': label,
      className: `dsh-my-guardian-switch${checked ? ' dsh-my-guardian-switch-on' : ''}`,
      disabled,
      onClick: onToggle,
    },
    createElement(
      'span',
      { className: 'dsh-my-guardian-switch-track' },
      createElement('span', { className: 'dsh-my-guardian-switch-thumb' }),
    ),
  )
}

/** Safe-mode switch bar: icon + title + switch + hint, wired to the host API. */
function SafeModeBar({ safeMode, onSafeMode }) {
  return createElement(
    'div',
    { className: `dsh-my-guardian-safemode${safeMode ? ' dsh-my-guardian-safemode-on' : ''}` },
    createElement(
      'div',
      { className: 'dsh-my-guardian-safemode-head' },
      createElement('span', { className: 'dsh-my-guardian-safemode-icon' }, icon.settings(16)),
      createElement('span', { className: 'dsh-my-guardian-safemode-title' }, strings.safeMode()),
      createElement(Switch, {
        checked: safeMode === true,
        label: strings.safeMode(),
        onToggle: () => onSafeMode(!safeMode),
      }),
    ),
    createElement('div', { className: 'dsh-my-guardian-hint' }, strings.safeModeDesc()),
  )
}

/** Staged + promoted entries as rows; empty state when there are none. */
function EntryList({ rows, onAction }) {
  if (rows.length === 0) {
    return createElement(
      'div',
      { className: 'dsh-my-guardian-empty' },
      createElement('span', { className: 'dsh-my-guardian-empty-icon' }, icon.folder(20)),
      strings.empty(),
      createElement('span', { className: 'dsh-my-guardian-empty-hint' }, strings.emptyHint()),
    )
  }
  return createElement(
    'div',
    { className: 'dsh-my-guardian-section' },
    createElement(
      'div',
      { className: 'dsh-my-guardian-section-head' },
      createElement('span', { className: 'dsh-my-guardian-section-title' }, strings.entries()),
      createElement('span', { className: 'dsh-my-guardian-section-count' }, String(rows.length)),
    ),
    createElement(
      'div',
      { className: 'dsh-my-guardian-list' },
      rows.map(({ entry, source }) =>
        createElement(EntryRow, {
          key: `${source}:${entry.id}`,
          entry,
          source,
          onAction,
        }),
      ),
    ),
  )
}

/** Recent guardian event log: badge + key info + time per entry. */
function EventList({ events }) {
  if (events.length === 0) return null
  return createElement(
    'div',
    { className: 'dsh-my-guardian-events' },
    createElement('div', { className: 'dsh-my-guardian-events-title' }, icon.clock(14), strings.events()),
    events.map((event, index) =>
      createElement(
        'div',
        {
          className: 'dsh-my-guardian-event',
          key: index,
          title: event.message,
        },
        createElement(
          'span',
          { className: `dsh-my-guardian-event-badge dsh-my-guardian-event-${eventVariant(event.type)}` },
          eventLabel(event.type),
        ),
        createElement('span', { className: 'dsh-my-guardian-event-message' }, event.message),
        createElement('span', { className: 'dsh-my-guardian-event-time' }, formatTime(event.time)),
      ),
    ),
  )
}

function GuardianView({ visible }) {
  const { state, loadFailed, reload, onAction, onSafeMode } = useGuardianState(visible)

  if (!state.loaded && !loadFailed) {
    return createElement(
      'div',
      { className: 'dsh-my-guardian-loading' },
      createElement('span', { className: 'dsh-my-guardian-loading-icon' }, icon.refresh(14)),
      strings.loading(),
    )
  }

  const rows = [
    ...state.staged.map((entry) => ({ entry, source: 'staged' })),
    ...state.promoted.map((entry) => ({ entry, source: 'promoted' })),
  ]

  return createElement(
    'div',
    { className: 'dsh-my-guardian-root' },
    createElement(SafeModeBar, { safeMode: state.safeMode, onSafeMode }),
    loadFailed
      ? createElement(
          'div',
          { className: 'dsh-my-guardian-error' },
          createElement('span', { className: 'dsh-my-guardian-error-text' }, strings.loadError()),
          createElement(
            'button',
            {
              type: 'button',
              className: 'dsh-my-guardian-iconbtn dsh-my-guardian-iconbtn-xs',
              'aria-label': strings.retry(),
              title: strings.retry(),
              onClick: reload,
            },
            icon.refresh(14),
          ),
        )
      : null,
    createElement(EntryList, { rows, onAction }),
    createElement(EventList, { events: state.events }),
  )
}
