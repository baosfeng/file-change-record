/**
 * dsh-my-observability — client half (browser). SOURCE TEMPLATE.
 *
 * 提供两个侧边栏页签：
 *  - 轨迹回放（dsh-my-observability:replay）：按时间轴查看 agent 行为
 *    （agent 状态 / 模型流 / 工具调用与结果），支持会话切换与类型过滤，
 *    数据来自 server 端事件审计（/observability/api/events）；
 *  - Git 工具 + 增量 diff 审查（dsh-my-observability:git）：仓库状态与
 *    差异查看、类型化提交（Conventional Commits）、提交前规则引擎 +
 *    可选 AI 审查（/observability/api/git/* 与 /observability/api/review）。
 *
 * 面板可见（visible）时轮询（REPLAY_POLL_MS），隐藏时暂停（省请求）。
 * 样式走 DSH 语义 token（--dsw-alias-* / --dsw-font-*），随 activation
 * 注入、fiber teardown 卸载（HMR/禁用无残留）。
 *
 * BUILD NOTE: 本文件是模板源码，不是 DSH 实际服务的文件。scripts/build.mjs
 * 将四个片段文件（lib/parts/i18n.js / replay.js / git.js / styles.js，均为
 * 无 import/export 的纯函数声明文本）经下方 __PART_*__ 占位符（函数式
 * replaceAll，避免 $&/$1 特殊解释）拼接进 factory 作用域，写出
 * lib/client.js —— 即 DSH 实际服务的产物。产物必须提交；CI 只对产物执行
 * node --check（见 scripts/test-all.sh / .github/workflows/ci.yml）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-my-observability',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useEffect, useState } = require('react')

    // ── parts（scripts/build.mjs 拼接；顺序固定）───────────────────────
        // ── i18n（浏览器语言判定）──────────────────────────────────────────
    function isZh() {
      try {
        const lang = (navigator.language || 'en').toLowerCase()
        return lang.startsWith('zh')
      } catch {
        return false
      }
    }

    const strings = {
      replayTitle: () => (isZh() ? '轨迹回放' : 'Trajectory'),
      gitTitle: () => (isZh() ? 'Git 工具' : 'Git Tools'),
      allSessions: () => (isZh() ? '全部会话' : 'All sessions'),
      filterAll: () => (isZh() ? '全部' : 'All'),
      filterStatus: () => (isZh() ? '状态' : 'Status'),
      filterLlm: () => (isZh() ? '模型流' : 'LLM'),
      filterTools: () => (isZh() ? '工具' : 'Tools'),
      emptyEvents: () => (isZh() ? '暂无审计事件——开始一段对话后，agent 的行为会出现在这里' : 'No audit events yet — agent activity will appear here after a conversation'),
      loadError: () => (isZh() ? '加载失败' : 'Load failed'),
      typeAgentStatus: () => (isZh() ? 'agent 状态' : 'agent status'),
      typeLlmStream: () => (isZh() ? '模型流' : 'LLM stream'),
      typeToolCall: () => (isZh() ? '工具调用' : 'tool call'),
      typeToolResult: () => (isZh() ? '工具结果' : 'tool result'),
      phaseStart: () => (isZh() ? '开始' : 'start'),
      phaseEnd: () => (isZh() ? '结束' : 'end'),
      phaseError: () => (isZh() ? '错误' : 'error'),
      agentTop: () => (isZh() ? '顶层' : 'top'),
      agentSub: () => (isZh() ? '子代理' : 'subagent'),
      agentUnknown: () => (isZh() ? '未知' : 'unknown'),
      toolOk: () => (isZh() ? '成功' : 'ok'),
      toolFail: () => (isZh() ? '失败' : 'failed'),
      // Git 面板
      repoLabel: () => (isZh() ? '仓库路径' : 'Repo path'),
      repoPlaceholder: () => (isZh() ? '如 /path/to/project' : 'e.g. /path/to/project'),
      loadRepo: () => (isZh() ? '加载' : 'Load'),
      branch: () => (isZh() ? '分支' : 'Branch'),
      staged: () => (isZh() ? '已暂存' : 'staged'),
      unstaged: () => (isZh() ? '未暂存' : 'unstaged'),
      clean: () => (isZh() ? '工作区干净' : 'Working tree clean'),
      diffTitle: () => (isZh() ? '差异' : 'Diff'),
      showDiff: () => (isZh() ? '查看差异' : 'Show diff'),
      showStagedDiff: () => (isZh() ? '查看暂存差异' : 'Staged diff'),
      noChanges: () => (isZh() ? '没有变更' : 'No changes'),
      review: () => (isZh() ? '提交前审查' : 'Review'),
      reviewAi: () => (isZh() ? 'AI 审查' : 'AI review'),
      reviewResult: () => (isZh() ? '审查结果' : 'Review result'),
      reviewPass: () => (isZh() ? '未发现问题' : 'No issues found'),
      issues: (count) => (isZh() ? `${count} 个问题` : `${count} issue(s)`),
      commitTitle: () => (isZh() ? '类型化提交' : 'Typed commit'),
      commitType: () => (isZh() ? '类型' : 'Type'),
      commitScope: () => (isZh() ? '范围（可选）' : 'Scope (optional)'),
      commitDesc: () => (isZh() ? '描述' : 'Description'),
      commitBody: () => (isZh() ? '正文（可选）' : 'Body (optional)'),
      commit: () => (isZh() ? '提交' : 'Commit'),
      committed: () => (isZh() ? '已提交' : 'Committed'),
      commitError: () => (isZh() ? '提交失败' : 'Commit failed'),
      severityError: () => (isZh() ? '错误' : 'Error'),
      severityWarning: () => (isZh() ? '警告' : 'Warning'),
      severityInfo: () => (isZh() ? '提示' : 'Info'),
      aiVerdictApprove: () => (isZh() ? 'AI 结论：可以提交' : 'AI verdict: approve'),
      aiVerdictChanges: () => (isZh() ? 'AI 结论：建议修改' : 'AI verdict: changes'),
      aiFailed: () => (isZh() ? 'AI 审查不可用' : 'AI review unavailable'),
      loading: () => (isZh() ? '加载中…' : 'Loading…'),
      emptyDiff: () => (isZh() ? '（空）' : '(empty)'),
      noRepo: () => (isZh() ? '请输入仓库路径' : 'Enter a repo path'),
    }

        // ── 轨迹回放面板（时间轴）──────────────────────────────────────────
    const REPLAY_POLL_MS = 5000

    /** 请求插件 API（非 2xx 抛错；返回响应 JSON 的 value 字段）。 */
    function apiJson(path, options) {
      return fetch(path, options).then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`)
        return data.value
      })
    }

    /** 事件类型 → 中文标签。 */
    function typeLabel(event) {
      switch (event.type) {
        case 'agent_status': return strings.typeAgentStatus()
        case 'llm_stream': return strings.typeLlmStream()
        case 'tool_call': return strings.typeToolCall()
        case 'tool_result': return strings.typeToolResult()
        default: return event.type
      }
    }

    /** 事件类型 → 徽标样式类别。 */
    function badgeKind(event) {
      if (event.type === 'agent_status') return 'status'
      if (event.type === 'llm_stream') return 'llm'
      return 'tool'
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

    /** agent 类型标记 → 中文。 */
    function agentTypeText(agentType) {
      if (agentType === 'top') return strings.agentTop()
      if (agentType === 'subagent') return strings.agentSub()
      return strings.agentUnknown()
    }

    /** 模型流阶段 → 中文。 */
    function phaseText(phase) {
      if (phase === 'start') return strings.phaseStart()
      if (phase === 'end') return strings.phaseEnd()
      if (phase === 'error') return strings.phaseError()
      return phase
    }

    /** agent 状态事件摘要。 */
    function agentMeta(data) {
      return `状态 ${data.status} · ${agentTypeText(data.agentType)}`
    }

    /** 模型流事件摘要（开始/结束/错误 + 统计）。 */
    function llmMeta(data) {
      const stats = data.phase === 'start' ? '' : ` · ${data.chunks} chunks / ${data.chars} chars / ${data.ms}ms`
      const error = data.message !== undefined ? `：${data.message}` : ''
      return `${phaseText(data.phase)}${stats}${error}`
    }

    /** 工具调用事件摘要（名称 + 参数摘要）。 */
    function toolCallMeta(data) {
      const args = data.args && data.args.summary !== undefined ? ` — ${data.args.summary}` : ''
      return `${data.name}${args}`
    }

    /** 工具结果事件摘要（名称 + 成败 + 耗时）。 */
    function toolResultMeta(data) {
      const result = data.ok === false ? strings.toolFail() : strings.toolOk()
      return `${data.name} · ${result} · ${data.ms}ms`
    }

    /** 事件 → 摘要文本（单行，尽力而为）。 */
    function eventMeta(event) {
      const data = event.data || {}
      if (event.type === 'agent_status') return agentMeta(data)
      if (event.type === 'llm_stream') return llmMeta(data)
      if (event.type === 'tool_call') return toolCallMeta(data)
      if (event.type === 'tool_result') return toolResultMeta(data)
      return ''
    }

    /** 单条事件行（徽标 + 时间 + 摘要）。 */
    function EventRow({ event }) {
      const meta = eventMeta(event)
      return createElement('div', { className: 'dso-event' },
        createElement('div', { className: 'dso-event-head' },
          createElement('span', { className: `dso-badge dso-badge-${badgeKind(event)}` }, typeLabel(event)),
          createElement('span', { className: 'dso-time' }, timeText(event.time)),
        ),
        meta !== '' ? createElement('div', { className: 'dso-event-meta' }, meta) : null,
      )
    }

    /** 类型过滤按钮组。 */
    function TypeFilter({ filter, onFilter }) {
      const options = [
        ['', strings.filterAll()],
        ['agent_status', strings.filterStatus()],
        ['llm_stream', strings.filterLlm()],
        ['tool', strings.filterTools()],
      ]
      return createElement('div', { className: 'dso-filters' },
        options.map(([value, label]) => createElement('button', {
          key: value,
          className: `dso-chip${filter === value ? ' dso-chip-active' : ''}`,
          onClick: () => onFilter(value),
        }, label)),
      )
    }

    /** 按过滤条件筛选事件（tool = tool_call + tool_result）。 */
    function filterEvents(events, filter) {
      if (filter === '') return events
      return events.filter((event) => filter === 'tool'
        ? event.type === 'tool_call' || event.type === 'tool_result'
        : event.type === filter)
    }

    /** 拉取会话列表与事件（选中为空时自动选当前/首个会话）。 */
    async function loadReplayData(selected, currentSession, setters) {
      try {
        const list = await apiJson('/observability/api/sessions')
        setters.setSessions(list)
        if (selected === '' && list.length > 0) {
          const preferred = list.some((s) => s.sessionId === currentSession) ? currentSession : list[0].sessionId
          setters.setSelected(preferred)
          return
        }
        const query = selected !== ''
          ? `/observability/api/events?sessionId=${encodeURIComponent(selected)}&limit=300`
          : '/observability/api/events?limit=0'
        setters.setEvents(await apiJson(query))
        setters.setError('')
      } catch (err) {
        setters.setError(err instanceof Error ? err.message : String(err))
      } finally {
        setters.setLoading(false)
      }
    }

    /** 工具栏：会话选择 + 类型过滤。 */
    function ReplayToolbar({ sessions, selected, onSelect, filter, onFilter }) {
      return createElement('div', { className: 'dso-toolbar' },
        createElement('select', {
          className: 'dso-select',
          value: selected,
          onChange: (e) => onSelect(e.target.value),
        },
        sessions.length === 0
          ? createElement('option', { value: '' }, strings.allSessions())
          : sessions.map((s) => createElement('option', { key: s.sessionId, value: s.sessionId }, s.sessionId)),
        ),
        createElement(TypeFilter, { filter, onFilter }),
      )
    }

    /** 轨迹回放主面板：会话选择 + 类型过滤 + 时间轴（可见时轮询）。 */
    function ReplayPanel(props) {
      const currentSession = props.scope?.sessionId || ''
      const visible = props.visible !== false
      const [sessions, setSessions] = useState([])
      const [selected, setSelected] = useState('')
      const [filter, setFilter] = useState('')
      const [events, setEvents] = useState([])
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')

      useEffect(() => {
        if (!visible) return undefined
        let alive = true
        const setters = { setSessions, setSelected, setEvents, setError, setLoading }
        const tick = () => { if (alive) void loadReplayData(selected, currentSession, setters) }
        tick()
        const timer = setInterval(tick, REPLAY_POLL_MS)
        return () => { alive = false; clearInterval(timer) }
      }, [visible, selected, currentSession])

      const filtered = filterEvents(events, filter)
      const rows = filtered.map((event, index) => createElement(EventRow, { key: event.id ?? index, event }))

      return createElement('div', { className: 'dso-panel' },
        createElement(ReplayToolbar, { sessions, selected, onSelect: setSelected, filter, onFilter: setFilter }),
        error !== '' ? createElement('div', { className: 'dso-empty' }, `${strings.loadError()}：${error}`) : null,
        loading && error === '' ? createElement('div', { className: 'dso-empty' }, strings.loading()) : null,
        !loading && error === '' && filtered.length === 0
          ? createElement('div', { className: 'dso-empty' }, strings.emptyEvents())
          : null,
        createElement('div', { className: 'dso-timeline' }, rows),
      )
    }

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
      return createElement('div', { className: 'dso-section' },
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
      const rows = issues.map((issue, index) => createElement('div', {
        key: index,
        className: `dso-issue dso-issue-${issue.severity}`,
      },
        createElement('span', { className: 'dso-issue-sev' }, severityText(issue.severity)),
        createElement('span', { className: 'dso-issue-rule' },
          `${issue.rule}${issue.file !== '' ? ` ${issue.file}:${issue.line}` : ''}`,
        ),
        createElement('span', { className: 'dso-issue-msg' }, issue.message),
      ))
      const aiText = aiTextOf(report.ai)
      return createElement('div', { className: 'dso-section' },
        createElement('div', { className: 'dso-section-title' }, strings.reviewResult()),
        issues.length === 0 ? createElement('div', { className: 'dso-review-ok' }, strings.reviewPass()) : null,
        rows,
        aiText !== '' ? createElement('div', { className: 'dso-ai' }, aiText) : null,
      )
    }

    /** 提交表单字段（type/scope/description/body + 提交按钮）。 */
    function CommitFields({ form, update, busy, submit }) {
      return createElement('div', { className: 'dso-form' },
        createElement('select', { className: 'dso-select dso-type', value: form.type, onChange: update('type') },
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
        createElement('div', { className: 'dso-actions' },
          createElement('button', {
            className: 'dso-btn dso-btn-primary',
            disabled: busy,
            onClick: submit,
          }, strings.commit()),
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
      return createElement('div', { className: 'dso-section' },
        createElement('div', { className: 'dso-section-title' }, strings.commitTitle()),
        createElement(CommitFields, { form, update, busy, submit }),
        feedback !== '' ? createElement('div', { className: 'dso-feedback' }, feedback) : null,
      )
    }

    /** 仓库路径行：输入 + 加载按钮。 */
    function RepoRow({ repo, onRepoChange, onLoad }) {
      return createElement('div', { className: 'dso-repo-row' },
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
      return createElement('div', { className: 'dso-actions' },
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
        setReport(await apiJson('/observability/api/review', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ repoPath: path }),
        }))
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

      return createElement('div', { className: 'dso-panel' },
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

        // ── 样式（DSH 语义 token，随 activation 注入 / teardown 卸载）──────
    const STYLES = `
.dso-panel{display:flex;flex-direction:column;gap:10px;padding:12px;color:var(--dsw-alias-label-primary)}
.dso-toolbar{display:flex;flex-direction:column;gap:8px}
.dso-select{flex:1;min-width:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 8px}
.dso-input{flex:1;min-width:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 8px}
.dso-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.dso-repo-row{display:flex;gap:8px;align-items:center}
.dso-repo-input{flex:1}
.dso-filters{display:flex;gap:6px;flex-wrap:wrap}
.dso-chip{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);background:transparent;
  border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 10px;cursor:pointer}
.dso-chip-active{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-interactive-primary);
  background:color-mix(in srgb, var(--dsw-alias-interactive-primary) 12%, transparent)}
.dso-timeline{display:flex;flex-direction:column;gap:6px;max-height:calc(100vh - 240px);overflow-y:auto}
.dso-event{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px}
.dso-event-head{display:flex;align-items:center;gap:8px;justify-content:space-between}
.dso-badge{flex:none;font:var(--dsw-font-xxxs-strong-11);border-radius:4px;padding:1px 6px}
.dso-badge-status{color:var(--dsw-alias-state-info-primary);background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 14%, transparent)}
.dso-badge-llm{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent)}
.dso-badge-tool{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent)}
.dso-time{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}
.dso-event-meta{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);line-height:1.6;word-break:break-word;margin-top:2px}
.dso-empty{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center;padding:16px 8px;line-height:1.7}
.dso-status{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-secondary)}
.dso-actions{display:flex;gap:8px;flex-wrap:wrap}
.dso-btn{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);
  border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 12px;cursor:pointer}
.dso-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dso-btn:disabled{opacity:.5;cursor:default}
.dso-btn-primary{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-interactive-primary);
  background:color-mix(in srgb, var(--dsw-alias-interactive-primary) 16%, transparent)}
.dso-section{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:8px}
.dso-section-title{font:var(--dsw-font-xs-strong-13);color:var(--dsw-alias-label-primary)}
.dso-diff{max-height:240px;overflow:auto;font:var(--dsw-font-mono-xxs);font-size:11px;line-height:1.5;
  color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);
  border-radius:6px;padding:8px;white-space:pre-wrap;word-break:break-all}
.dso-form{display:flex;flex-direction:column;gap:6px}
.dso-type{flex:none;width:96px}
.dso-textarea{min-height:52px;resize:vertical;font:var(--dsw-font-xxs-12)}
.dso-feedback{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);word-break:break-all;line-height:1.5}
.dso-issue{display:flex;flex-direction:column;gap:2px;border-radius:6px;padding:6px 8px;font:var(--dsw-font-xxs-12)}
.dso-issue-error{background:color-mix(in srgb, var(--dsw-alias-state-danger-primary) 12%, transparent)}
.dso-issue-warning{background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent)}
.dso-issue-info{background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 10%, transparent)}
.dso-issue-sev{font:var(--dsw-font-xxxs-strong-11);text-transform:uppercase}
.dso-issue-error .dso-issue-sev{color:var(--dsw-alias-state-danger-primary)}
.dso-issue-warning .dso-issue-sev{color:var(--dsw-alias-state-warn-primary)}
.dso-issue-info .dso-issue-sev{color:var(--dsw-alias-state-info-primary)}
.dso-issue-rule{font:var(--dsw-font-mono-xxs);font-size:11px;color:var(--dsw-alias-label-secondary)}
.dso-issue-msg{color:var(--dsw-alias-label-primary);line-height:1.5}
.dso-review-ok{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-state-success-primary)}
.dso-ai{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);line-height:1.5;
  border:1px dashed var(--dsw-alias-border-l2);border-radius:6px;padding:6px 8px}
`

    function injectStyles() {
      if (typeof document === 'undefined' || typeof document.head === 'undefined') return () => {}
      const style = document.createElement('style')
      style.setAttribute('data-dsh-my-observability', 'styles')
      style.textContent = STYLES
      document.head.appendChild(style)
      return () => {
        if (style.parentNode !== null) style.parentNode.removeChild(style)
      }
    }


    // ── 插件体：样式注入 + 两个页签注册 ────────────────────────────────
    exports.inject = ['betterSidebar']

    exports.apply = function apply(ctx) {
      ctx.effect(() => injectStyles(), 'dsh-my-observability: styles')
      const service = ctx.betterSidebar
      if (service === undefined) return
      ctx.effect(() => service.registerTab({
        id: 'dsh-my-observability:replay',
        title: () => strings.replayTitle(),
        order: 40,
        single: true,
        component: (props) => createElement(ReplayPanel, props),
      }), 'dsh-my-observability: replay tab registration')
      ctx.effect(() => service.registerTab({
        id: 'dsh-my-observability:git',
        title: () => strings.gitTitle(),
        order: 41,
        single: true,
        component: (props) => createElement(GitPanel, props),
      }), 'dsh-my-observability: git tab registration')
    }

    return module.exports
  },
})
