// ── 安全护栏面板 ────────────────────────────────────────────────────
const GUARD_POLL_MS = 5000

/** 请求插件 API（非 2xx 抛错；返回响应 JSON 的 value 字段）。 */
function apiJson(path, options) {
  return fetch(path, options).then(async (res) => {
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`)
    return data.value
  })
}

/** 时间戳 → HH:MM:SS。 */
function timeText(time) {
  try {
    const date = new Date(time)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  } catch {
    return ''
  }
}

/** 告警类型 → 中文标签。 */
function alertTypeLabel(type) {
  if (type === 'destructive') return strings.typeDestructive()
  if (type === 'poison') return strings.typePoison()
  if (type === 'injection') return strings.typeInjection()
  return type
}

/** 严重度 → 中文标签。 */
function severityLabel(severity) {
  if (severity === 'high') return strings.sevHigh()
  if (severity === 'medium') return strings.sevMedium()
  return strings.sevLow()
}

/** 告警类型 → 徽标样式类别。 */
function badgeKind(alert) {
  if (alert.type === 'destructive') return 'danger'
  if (alert.type === 'poison') return 'warn'
  return 'info'
}

/** 单条告警行（徽标 + 时间 + 消息 + 确认按钮）。 */
function AlertRow({ alert, onConfirm }) {
  const detail = alert.detail || {}
  const meta =
    detail.command !== undefined
      ? detail.command
      : detail.file !== undefined
        ? `${strings.file()} ${detail.file}`
        : detail.rule !== undefined
          ? `${strings.rule()} ${detail.rule}`
          : ''
  return createElement(
    'div',
    { className: 'dso-alert' },
    createElement(
      'div',
      { className: 'dso-alert-head' },
      createElement('span', { className: `dso-badge dso-badge-${badgeKind(alert)}` }, alertTypeLabel(alert.type)),
      createElement('span', { className: `dso-sev dso-sev-${alert.severity}` }, severityLabel(alert.severity)),
      createElement('span', { className: 'dso-time' }, timeText(alert.time)),
    ),
    createElement('div', { className: 'dso-alert-msg' }, alert.message),
    meta !== '' ? createElement('div', { className: 'dso-alert-meta' }, meta) : null,
    alert.confirmed
      ? createElement('div', { className: 'dso-alert-confirmed' }, strings.confirmed())
      : createElement(
          'button',
          { className: 'dso-btn dso-btn-small', onClick: () => onConfirm(alert.id) },
          strings.confirm(),
        ),
  )
}

/** 拉取告警列表。 */
async function loadAlerts(setters) {
  try {
    setters.setAlerts(await apiJson('/guard/api/alerts?limit=200'))
    setters.setError('')
  } catch (err) {
    setters.setError(err instanceof Error ? err.message : String(err))
  } finally {
    setters.setLoading(false)
  }
}

/** 确认告警（用户确认机制）。 */
async function confirmAlert(id, setAlerts) {
  try {
    await apiJson('/guard/api/alerts/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, confirmed: true } : a)))
  } catch {
    // 确认失败静默（下次轮询恢复真实状态）
  }
}

/** 扫描结果展示（发现项列表）。 */
function ScanResult({ result }) {
  const findings = result?.findings || []
  return createElement(
    'div',
    { className: 'dso-feedback' },
    findings.length === 0 ? strings.scanClean() : `${strings.findings(findings.length)}：`,
    findings.length > 0
      ? findings.map((f, index) =>
          createElement(
            'div',
            { key: index, className: `dso-issue dso-issue-${f.severity}` },
            createElement('div', { className: 'dso-issue-sev' }, severityLabel(f.severity)),
            createElement('div', { className: 'dso-issue-msg' }, f.message),
            createElement('div', { className: 'dso-issue-rule' }, `${f.file} · ${f.pattern}`),
          ),
        )
      : null,
  )
}

/** 执行投毒扫描（target 校验 + 请求 + 状态管理）。 */
async function runScan(target, setters) {
  const value = target.trim()
  if (value === '') {
    setters.setError(strings.noTarget())
    return
  }
  setters.setBusy(true)
  setters.setError('')
  try {
    setters.setResult(
      await apiJson('/guard/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target: value }),
      }),
    )
  } catch (err) {
    setters.setError(err instanceof Error ? err.message : String(err))
    setters.setResult(null)
  } finally {
    setters.setBusy(false)
  }
}

/** 投毒扫描工具：输入包名/路径 → 扫描 → 显示发现项。 */
function ScanTool() {
  const [target, setTarget] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = () => runScan(target, { setResult, setBusy, setError })
  return createElement(
    'div',
    { className: 'dso-section' },
    createElement('div', { className: 'dso-section-title' }, strings.scanTitle()),
    createElement(
      'div',
      { className: 'dso-repo-row' },
      createElement('input', {
        className: 'dso-input dso-repo-input',
        value: target,
        placeholder: strings.scanPlaceholder(),
        onChange: (e) => setTarget(e.target.value),
        onKeyDown: (e) => {
          if (e.key === 'Enter') void run()
        },
      }),
      createElement(
        'button',
        { className: 'dso-btn dso-btn-primary', disabled: busy, onClick: () => void run() },
        strings.scan(),
      ),
    ),
    error !== ''
      ? createElement('div', { className: 'dso-feedback dso-feedback-error' }, `${strings.scanError()}：${error}`)
      : null,
    result !== null ? createElement(ScanResult, { result }) : null,
  )
}

/** 注入检测结果展示（命中规则列表）。 */
function PromptResult({ hits }) {
  return createElement(
    'div',
    { className: 'dso-feedback' },
    hits.length === 0 ? strings.checkClean() : `${strings.checkHits(hits.length)}：`,
    hits.length > 0
      ? hits.map((h, index) =>
          createElement(
            'div',
            { key: index, className: `dso-issue dso-issue-${h.severity}` },
            createElement('div', { className: 'dso-issue-sev' }, severityLabel(h.severity)),
            createElement('div', { className: 'dso-issue-msg' }, h.message),
            createElement('div', { className: 'dso-issue-rule' }, h.id),
          ),
        )
      : null,
  )
}

/** 提示注入检测工具：输入文本 → 检测 → 显示命中规则。 */
function PromptTool() {
  const [text, setText] = useState('')
  const [hits, setHits] = useState(null)
  const [error, setError] = useState('')
  const run = async () => {
    const value = text.trim()
    if (value === '') {
      setError(strings.noText())
      return
    }
    setError('')
    try {
      const result = await apiJson('/guard/api/scan-prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: value }),
      })
      setHits(result.hits)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setHits(null)
    }
  }
  return createElement(
    'div',
    { className: 'dso-section' },
    createElement('div', { className: 'dso-section-title' }, strings.promptTitle()),
    createElement('textarea', {
      className: 'dso-input dso-textarea',
      value: text,
      placeholder: strings.promptPlaceholder(),
      onChange: (e) => setText(e.target.value),
    }),
    createElement('button', { className: 'dso-btn dso-btn-primary', onClick: () => void run() }, strings.check()),
    error !== ''
      ? createElement('div', { className: 'dso-feedback dso-feedback-error' }, `${strings.loadError()}：${error}`)
      : null,
    hits !== null ? createElement(PromptResult, { hits }) : null,
  )
}

/** 安全护栏主面板：告警列表 + 扫描工具 + 注入检测工具（可见时轮询）。 */
function GuardPanel(props) {
  const visible = props.visible !== false
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return undefined
    let alive = true
    const setters = { setAlerts, setError, setLoading }
    const tick = () => {
      if (alive) void loadAlerts(setters)
    }
    tick()
    const timer = setInterval(tick, GUARD_POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [visible])

  const rows = alerts.map((alert) =>
    createElement(AlertRow, {
      key: alert.id,
      alert,
      onConfirm: (id) => void confirmAlert(id, setAlerts),
    }),
  )

  return createElement(
    'div',
    { className: 'dso-panel' },
    createElement('div', { className: 'dso-section-title' }, strings.alertsTitle()),
    error !== '' ? createElement('div', { className: 'dso-empty' }, `${strings.loadError()}：${error}`) : null,
    loading && error === '' ? createElement('div', { className: 'dso-empty' }, strings.loading()) : null,
    !loading && error === '' && alerts.length === 0
      ? createElement('div', { className: 'dso-empty' }, strings.emptyAlerts())
      : null,
    createElement('div', { className: 'dso-timeline' }, rows),
    createElement(ScanTool, null),
    createElement(PromptTool, null),
  )
}
