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
    api(path, request)
      .then(() => load())
      .catch(() => setLoadFailed(true))
  }

  const onSafeMode = (enabled) => {
    api('safemode', { enabled })
      .then(() => load())
      .catch(() => setLoadFailed(true))
  }

  return { state, loadFailed, onAction, onSafeMode }
}

/** Safe-mode switch header: checkbox + hint, wired to the host API. */
function SafeModeBar({ safeMode, onSafeMode }) {
  return createElement(
    'div',
    { className: 'dsh-my-guardian-safemode' },
    createElement(
      'label',
      null,
      createElement('input', {
        type: 'checkbox',
        checked: safeMode === true,
        onChange: (event) => onSafeMode(event.target.checked),
      }),
      createElement('span', null, strings.safeMode()),
    ),
    createElement('div', { className: 'dsh-my-guardian-hint' }, strings.safeModeDesc()),
  )
}

/** Staged + promoted entries as rows; empty state when there are none. */
function EntryList({ rows, onAction }) {
  if (rows.length === 0) {
    return createElement('div', { className: 'dsh-my-guardian-empty' }, strings.empty())
  }
  return createElement(
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
  )
}

/** Recent guardian event log lines (time-stamped, one per entry). */
function EventList({ events }) {
  if (events.length === 0) return null
  return createElement(
    'div',
    { className: 'dsh-my-guardian-events' },
    createElement('div', { className: 'dsh-my-guardian-events-title' }, strings.events()),
    events.map((event, index) =>
      createElement(
        'div',
        {
          className: 'dsh-my-guardian-event',
          key: index,
          title: event.message,
        },
        `${formatTime(event.time)} [${event.type}] ${event.message}`,
      ),
    ),
  )
}

function GuardianView({ visible }) {
  const { state, loadFailed, onAction, onSafeMode } = useGuardianState(visible)

  if (!state.loaded && !loadFailed) {
    return createElement('div', { className: 'dsh-my-guardian-styles-placeholder' }, strings.loading())
  }

  const rows = [
    ...state.staged.map((entry) => ({ entry, source: 'staged' })),
    ...state.promoted.map((entry) => ({ entry, source: 'promoted' })),
  ]

  return createElement(
    'div',
    { className: 'dsh-my-guardian-panel' },
    createElement(SafeModeBar, { safeMode: state.safeMode, onSafeMode }),
    loadFailed ? createElement('div', { className: 'dsh-my-guardian-error' }, strings.loadError()) : null,
    createElement(EntryList, { rows, onAction }),
    createElement(EventList, { events: state.events }),
  )
}
