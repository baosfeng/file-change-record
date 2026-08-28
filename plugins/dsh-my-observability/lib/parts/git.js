// ── Git 工具 + 增量 diff 审查面板 ──────────────────────────────────
const REPO_KEY = 'dsh-my-observability:repo'
const COMMIT_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore']

function loadRepoKey() {
  try {
    const value = window.localStorage.getItem(REPO_KEY)
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

function saveRepoKey(repo) {
  try {
    window.localStorage.setItem(REPO_KEY, repo)
  } catch {
    // storage is best-effort
  }
}

/** 状态条：分支 + 变更计数。 */
function StatusBar({ status }) {
  if (status === null) return null
  const parts = [`${strings.branch()} ${status.branch}`]
  if (status.clean) parts.push(strings.clean())
  else {
    if (status.stagedCount > 0) parts.push(`${status.stagedCount} ${strings.staged()}`)
    if (status.unstagedCount > 0) parts.push(`${status.unstagedCount} ${strings.unstaged()}`)
  }
  return createElement('div', { className: 'dso-status' }, parts.join(' · '))
}

/** 差异文本预览。 */
function DiffView({ diff }) {
  return createElement(
    'div',
    { className: 'dso-section' },
    createElement('div', { className: 'dso-section-title' }, strings.diffTitle()),
    createElement('pre', { className: 'dso-diff' }, diff !== '' ? diff : strings.emptyDiff()),
  )
}

/** 严重级别 → 中文。 */
function severityText(severity) {
  if (severity === 'error') return strings.severityError()
  if (severity === 'warning') return strings.severityWarning()
  return strings.severityInfo()
}

/** AI 结论文本（未启用/失败/成功三态，尽力而为）。 */
function aiTextOf(ai) {
  if (ai === undefined || ai === null || !ai.enabled) return ''
  if (ai.failed) return `${strings.aiFailed()}（${ai.note ?? ''}）`
  return ai.verdict === 'approve' ? strings.aiVerdictApprove() : strings.aiVerdictChanges()
}

/** 审查报告：问题列表 + AI 结论。 */
function ReviewReport({ report }) {
  if (report === null) return null
  const issues = report.issues || []
  const rows = issues.map((issue, index) =>
    createElement(
      'div',
      {
        key: index,
        className: `dso-issue dso-issue-${issue.severity}`,
      },
      createElement('span', { className: 'dso-issue-sev' }, severityText(issue.severity)),
      createElement(
        'span',
        { className: 'dso-issue-rule' },
        `${issue.rule}${issue.file !== '' ? ` ${issue.file}:${issue.line}` : ''}`,
      ),
      createElement('span', { className: 'dso-issue-msg' }, issue.message),
    ),
  )
  const aiText = aiTextOf(report.ai)
  return createElement(
    'div',
    { className: 'dso-section' },
    createElement('div', { className: 'dso-section-title' }, strings.reviewResult()),
    issues.length === 0 ? createElement('div', { className: 'dso-review-ok' }, strings.reviewPass()) : null,
    rows,
    aiText !== '' ? createElement('div', { className: 'dso-ai' }, aiText) : null,
  )
}

/** 提交表单字段（type/scope/description/body + 提交按钮）。 */
function CommitFields({ form, update, busy, submit }) {
  return createElement(
    'div',
    { className: 'dso-form' },
    createElement(
      'select',
      { className: 'dso-select dso-type', value: form.type, onChange: update('type') },
      COMMIT_TYPES.map((type) => createElement('option', { key: type, value: type }, type)),
    ),
    createElement('input', {
      className: 'dso-input',
      placeholder: strings.commitScope(),
      value: form.scope,
      onChange: update('scope'),
    }),
    createElement('input', {
      className: 'dso-input',
      placeholder: strings.commitDesc(),
      value: form.description,
      onChange: update('description'),
    }),
    createElement('textarea', {
      className: 'dso-input dso-textarea',
      placeholder: strings.commitBody(),
      value: form.body,
      onChange: update('body'),
    }),
    createElement(
      'div',
      { className: 'dso-actions' },
      createElement(
        'button',
        {
          className: 'dso-btn dso-btn-primary',
          disabled: busy,
          onClick: submit,
        },
        strings.commit(),
      ),
    ),
  )
}

/** 类型化提交表单：type/scope/description/body → POST /git/commit。 */
function CommitForm({ repo, onCommitted }) {
  const [form, setForm] = useState({ type: 'feat', scope: '', description: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const submit = async () => {
    if (form.description.trim() === '') {
      setFeedback(strings.commitError())
      return
    }
    setBusy(true)
    try {
      const value = await apiJson('/observability/api/git/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repoPath: repo, ...form }),
      })
      setFeedback(`${strings.committed()}：${value.hash} ${value.message}`)
      setForm({ ...form, scope: '', description: '', body: '' })
      onCommitted()
    } catch (err) {
      setFeedback(`${strings.commitError()}：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }
  return createElement(
    'div',
    { className: 'dso-section' },
    createElement('div', { className: 'dso-section-title' }, strings.commitTitle()),
    createElement(CommitFields, { form, update, busy, submit }),
    feedback !== '' ? createElement('div', { className: 'dso-feedback' }, feedback) : null,
  )
}

/** 仓库路径行：输入 + 加载按钮。 */
function RepoRow({ repo, onRepoChange, onLoad }) {
  return createElement(
    'div',
    { className: 'dso-repo-row' },
    createElement('input', {
      className: 'dso-input dso-repo-input',
      placeholder: strings.repoPlaceholder(),
      value: repo,
      onChange: (e) => onRepoChange(e.target.value),
    }),
    createElement('button', { className: 'dso-btn', onClick: onLoad }, strings.loadRepo()),
  )
}

/** 操作按钮组：diff / staged diff / 审查。 */
function GitActions({ onDiff, onReview }) {
  return createElement(
    'div',
    { className: 'dso-actions' },
    createElement('button', { className: 'dso-btn', onClick: () => onDiff(false) }, strings.showDiff()),
    createElement('button', { className: 'dso-btn', onClick: () => onDiff(true) }, strings.showStagedDiff()),
    createElement('button', { className: 'dso-btn dso-btn-primary', onClick: onReview }, strings.review()),
  )
}

/** 拉取仓库状态（错误写入 setError）。 */
async function fetchStatus(path, setStatus, setError) {
  if (path === '') return
  try {
    setStatus(await apiJson(`/observability/api/git/status?repo=${encodeURIComponent(path)}`))
    setError('')
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err))
  }
}

/** 拉取差异文本（staged 切换；错误写入 setError）。 */
async function fetchDiff(path, staged, setDiff, setError) {
  if (path === '') return
  try {
    const value = await apiJson(`/observability/api/git/diff?repo=${encodeURIComponent(path)}&staged=${staged ? 1 : 0}`)
    setDiff(value.text)
    setError('')
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err))
  }
}

/** 运行提交前审查（错误写入 setError）。 */
async function runReview(path, setReport, setError) {
  if (path === '') return
  try {
    setReport(
      await apiJson('/observability/api/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repoPath: path }),
      }),
    )
    setError('')
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err))
  }
}

/** Git 面板主组件：仓库状态 / diff / 审查 / 类型化提交。 */
function GitPanel() {
  const [repo, setRepo] = useState(loadRepoKey)
  const [status, setStatus] = useState(null)
  const [diff, setDiff] = useState('')
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  const onCommitted = async () => {
    setDiff('')
    setReport(null)
    await fetchStatus(repo, setStatus, setError)
  }

  return createElement(
    'div',
    { className: 'dso-panel' },
    createElement(RepoRow, {
      repo,
      onRepoChange: (value) => {
        setRepo(value)
        saveRepoKey(value)
      },
      onLoad: () => fetchStatus(repo, setStatus, setError),
    }),
    error !== '' ? createElement('div', { className: 'dso-empty' }, error) : null,
    createElement(StatusBar, { status }),
    createElement(GitActions, {
      onDiff: (staged) => fetchDiff(repo, staged, setDiff, setError),
      onReview: () => runReview(repo, setReport, setError),
    }),
    createElement(DiffView, { diff }),
    createElement(ReviewReport, { report }),
    createElement(CommitForm, { repo, onCommitted }),
  )
}
