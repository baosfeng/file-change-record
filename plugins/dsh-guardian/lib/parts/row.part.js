    // ── row ────────────────────────────────────────────────────────────────
    function EntryRow({ entry, source, onAction }) {
      const [expanded, setExpanded] = useState(false)
      const hasError = typeof entry.lastError === 'string' && entry.lastError !== ''
      return createElement('div', { className: 'dsh-guardian-row' },
        createElement('div', { className: 'dsh-guardian-row-head' },
          createElement('span', { className: 'dsh-guardian-source' }, source === 'staged' ? strings.staged() : strings.promoted()),
          createElement('span', { className: 'dsh-guardian-name', title: entry.id }, entry.name),
          createElement('span', { className: `dsh-guardian-badge dsh-guardian-${entry.status}` }, statusLabel(entry.status)),
        ),
        createElement('div', { className: 'dsh-guardian-row-meta' },
          createElement('span', null, entry.id),
          entry.attempts > 0 ? createElement('span', { className: 'dsh-guardian-attempts' }, `×${entry.attempts}`) : null,
        ),
        hasError
          ? createElement('button', {
              className: 'dsh-guardian-link',
              onClick: () => setExpanded(!expanded),
            }, expanded ? '▾ 收起' : '▸ 错误详情')
          : null,
        expanded && hasError
          ? createElement('pre', { className: 'dsh-guardian-error' }, entry.lastError)
          : null,
        createElement('div', { className: 'dsh-guardian-actions' },
          entry.status === 'failed' || entry.status === 'frozen'
            ? createElement('button', {
                className: 'dsh-guardian-btn dsh-guardian-primary',
                onClick: () => onAction('retry', entry),
              }, strings.retry())
            : null,
          createElement('button', {
            className: 'dsh-guardian-btn',
            onClick: () => onAction('remove', entry),
          }, strings.remove()),
        ),
      )
    }
