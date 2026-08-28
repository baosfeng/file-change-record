// ── diagram card (React) ─────────────────────────────────────────────
// 样式前缀 dsh-mermaid-render-（issue #54：与 dsh-md-render 的旧缩写前缀
// 分离，消除跨插件类名冲突）；图标走共享图标系统（dsh-shared/client-parts）。
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
    { className: 'dsh-mermaid-render-card', 'data-dsh-mermaid-render-entry': entryId },
    createElement(
      'div',
      { className: 'dsh-mermaid-render-card-head' },
      createElement(
        'div',
        { className: 'dsh-mermaid-render-card-title' },
        icon.file(12),
        createElement('span', null, 'Mermaid 图表'),
      ),
      createElement(ViewToggle, { mode, setMode }),
    ),
    createElement(CardBody, { status, mode, error, source, svg }),
  )
}

/** Preview / code view-mode toggle (card header, icon + label). */
function ViewToggle({ mode, setMode }) {
  return createElement(
    'div',
    { className: 'dsh-mermaid-render-view-toggle', role: 'group', 'aria-label': 'view mode' },
    createElement(
      'button',
      {
        type: 'button',
        className: mode === 'preview' ? 'dsh-mermaid-render-vt dsh-mermaid-render-vt-active' : 'dsh-mermaid-render-vt',
        onClick: () => setMode('preview'),
        'aria-pressed': mode === 'preview',
      },
      icon.file(14),
      createElement('span', null, '预览'),
    ),
    createElement(
      'button',
      {
        type: 'button',
        className: mode === 'code' ? 'dsh-mermaid-render-vt dsh-mermaid-render-vt-active' : 'dsh-mermaid-render-vt',
        onClick: () => setMode('code'),
        'aria-pressed': mode === 'code',
      },
      icon.code(14),
      createElement('span', null, '代码'),
    ),
  )
}

/** Card body: loading / error banner / code / rendered svg. */
function CardBody({ status, mode, error, source, svg }) {
  if (status === 'loading') {
    return createElement(
      'div',
      { className: 'dsh-mermaid-render-loading' },
      icon.refresh(14),
      createElement('span', null, '渲染中…'),
    )
  }
  if (status === 'error') {
    return createElement(
      'div',
      { className: 'dsh-mermaid-render-error' },
      createElement(
        'div',
        { className: 'dsh-mermaid-render-error-head' },
        icon.alert(15),
        createElement('span', { className: 'dsh-mermaid-render-error-title' }, 'Mermaid 渲染失败'),
      ),
      createElement('div', { className: 'dsh-mermaid-render-error-msg' }, error),
    )
  }
  if (mode === 'code' || !svg) {
    return createElement('pre', { className: 'dsh-mermaid-render-code' }, source)
  }
  return createElement('div', {
    className: 'dsh-mermaid-render-svg',
    dangerouslySetInnerHTML: { __html: svg },
  })
}
