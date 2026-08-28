// ── diagram card (React) ─────────────────────────────────────────────
function MermaidCard({ entryId, source }) {
  const [status, setStatus] = useState('loading')
  const [svg, setSvg] = useState(null)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('preview')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    ensureMermaid()
      .then((m) => m.render(entryId, source))
      .then((out) => {
        if (cancelled) return
        setSvg(out && typeof out.svg === 'string' ? out.svg : null)
        setError(null)
        setStatus('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [entryId, source])

  return createElement(
    'div',
    { className: 'dmr-card', 'data-dmr-entry': entryId },
    createElement('div', { className: 'dmr-card-head' }, createElement(ViewToggle, { mode, setMode })),
    createElement(CardBody, { status, mode, error, source, svg }),
  )
}

/** Preview / code view-mode toggle (card header). */
function ViewToggle({ mode, setMode }) {
  return createElement(
    'div',
    { className: 'dmr-view-toggle', role: 'group', 'aria-label': 'view mode' },
    createElement(
      'button',
      {
        type: 'button',
        className: mode === 'preview' ? 'dmr-vt dmr-vt-active' : 'dmr-vt',
        onClick: () => setMode('preview'),
      },
      '预览',
    ),
    createElement(
      'button',
      {
        type: 'button',
        className: mode === 'code' ? 'dmr-vt dmr-vt-active' : 'dmr-vt',
        onClick: () => setMode('code'),
      },
      '代码',
    ),
  )
}

/** Card body: loading / error banner / code / rendered svg. */
function CardBody({ status, mode, error, source, svg }) {
  if (status === 'loading') {
    return createElement('div', { className: 'dmr-loading' }, '渲染中…')
  }
  if (status === 'error') {
    return createElement(
      'div',
      { className: 'dmr-error' },
      createElement('div', { className: 'dmr-error-title' }, 'Mermaid 渲染失败'),
      createElement('div', { className: 'dmr-error-msg' }, error),
    )
  }
  if (mode === 'code' || !svg) {
    return createElement('pre', { className: 'dmr-code' }, source)
  }
  return createElement('div', {
    className: 'dmr-svg',
    dangerouslySetInnerHTML: { __html: svg },
  })
}
