// ── diagram card (React) ─────────────────────────────────────────────
// 样式前缀 dsh-mermaid-render-（issue #54：与 dsh-md-render 的旧缩写前缀
// 分离，消除跨插件类名冲突）；图标走共享图标系统（dsh-shared/client-parts）。
// 导出（issue #85）：工具栏下载 PNG / 下载 SVG / 复制代码，逻辑见 export.part.js。
let noticeTimer = null

function MermaidCard({ entryId, source }) {
  const [status, setStatus] = useState('loading')
  const [svg, setSvg] = useState(null)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('preview')
  const [notice, setNotice] = useState(null)

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

  /** 短暂提示（成功/失败），2.5s 后自动消失。 */
  function flashNotice(type, text) {
    setNotice({ type, text })
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => setNotice(null), 2500)
  }

  const exportActions = makeExportHandlers(entryId, source, flashNotice)

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
      createElement(
        'div',
        { className: 'dsh-mermaid-render-card-actions' },
        createElement(ExportButtons, {
          status,
          onPng: exportActions.onPng,
          onSvg: exportActions.onSvg,
          onCopy: exportActions.onCopy,
        }),
        createElement(ViewToggle, { mode, setMode }),
      ),
    ),
    notice ? renderNotice(notice) : null,
    createElement(CardBody, { status, mode, error, source, svg }),
  )
}

/** 导出结果提示条（成功/失败），无提示时返回 null。 */
function renderNotice(notice) {
  if (!notice) return null
  return createElement(
    'div',
    { className: 'dsh-mermaid-render-notice dsh-mermaid-render-notice-' + notice.type },
    notice.text,
  )
}

/** 导出按钮组：下载 PNG / 下载 SVG / 复制代码（issue #85）。 */
function ExportButtons({ status, onPng, onSvg, onCopy }) {
  const ready = status === 'ok'
  return createElement(
    'div',
    { className: 'dsh-mermaid-render-export', role: 'group', 'aria-label': 'export' },
    createElement(
      'button',
      {
        type: 'button',
        className: 'dsh-mermaid-render-eb',
        onClick: onPng,
        disabled: !ready,
        title: '下载 PNG',
        'aria-label': '下载 PNG',
      },
      icon.download(14),
      createElement('span', null, '下载 PNG'),
    ),
    createElement(
      'button',
      {
        type: 'button',
        className: 'dsh-mermaid-render-eb',
        onClick: onSvg,
        disabled: !ready,
        title: '下载 SVG',
        'aria-label': '下载 SVG',
      },
      icon.download(14),
      createElement('span', null, '下载 SVG'),
    ),
    createElement(
      'button',
      {
        type: 'button',
        className: 'dsh-mermaid-render-eb',
        onClick: onCopy,
        title: '复制代码',
        'aria-label': '复制代码',
      },
      icon.copy(14),
      createElement('span', null, '复制代码'),
    ),
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
