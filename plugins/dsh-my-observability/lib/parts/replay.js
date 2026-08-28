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
    case 'agent_status':
      return strings.typeAgentStatus()
    case 'llm_stream':
      return strings.typeLlmStream()
    case 'tool_call':
      return strings.typeToolCall()
    case 'tool_result':
      return strings.typeToolResult()
    default:
      return event.type
  }
}

/** 事件类型 → 视觉类别（徽标/图标/节点共用，颜色语义一致）：
 *  status=info / llm=warn / call=accent / result=success / fail=danger。 */
function typeKind(event) {
  if (event.type === 'agent_status') return 'status'
  if (event.type === 'llm_stream') return 'llm'
  if (event.type === 'tool_call') return 'call'
  return event.data?.ok === false ? 'fail' : 'result'
}

/** 事件类型 → 类型图标（共享线性图标集，stroke=currentColor）。 */
function typeIcon(event) {
  const kind = typeKind(event)
  if (kind === 'status') return icon.clock(15)
  if (kind === 'llm') return icon.file(15)
  if (kind === 'call') return icon.external(15)
  if (kind === 'fail') return icon.close(15)
  return icon.check(15)
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

/** 单条事件行：节点圆点 + 类型图标 + 徽标/时间 + 摘要（hover/active 反馈）。 */
function EventRow({ event }) {
  const meta = eventMeta(event)
  const kind = typeKind(event)
  return createElement(
    'button',
    { className: 'dsh-my-observability-event', type: 'button' },
    createElement('span', { className: `dsh-my-observability-node dsh-my-observability-node-${kind}` }),
    createElement(
      'span',
      { className: `dsh-my-observability-event-icon dsh-my-observability-icon-${kind}` },
      typeIcon(event),
    ),
    createElement(
      'span',
      { className: 'dsh-my-observability-event-body' },
      createElement(
        'span',
        { className: 'dsh-my-observability-event-head' },
        createElement(
          'span',
          { className: `dsh-my-observability-badge dsh-my-observability-badge-${kind}` },
          typeLabel(event),
        ),
        createElement('span', { className: 'dsh-my-observability-time' }, timeText(event.time)),
      ),
      meta !== '' ? createElement('span', { className: 'dsh-my-observability-event-meta' }, meta) : null,
    ),
  )
}

/** 类型过滤按钮组（aria-pressed 选中态）。 */
function TypeFilter({ filter, onFilter }) {
  const options = [
    ['', strings.filterAll()],
    ['agent_status', strings.filterStatus()],
    ['llm_stream', strings.filterLlm()],
    ['tool', strings.filterTools()],
  ]
  return createElement(
    'div',
    { className: 'dsh-my-observability-filters' },
    options.map(([value, label]) =>
      createElement(
        'button',
        {
          key: value,
          type: 'button',
          className: `dsh-my-observability-chip${filter === value ? ' dsh-my-observability-chip-active' : ''}`,
          'aria-pressed': filter === value,
          onClick: () => onFilter(value),
        },
        label,
      ),
    ),
  )
}

/** 按过滤条件筛选事件（tool = tool_call + tool_result）。 */
function filterEvents(events, filter) {
  if (filter === '') return events
  return events.filter((event) =>
    filter === 'tool' ? event.type === 'tool_call' || event.type === 'tool_result' : event.type === filter,
  )
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
    const query =
      selected !== ''
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

/** 工具栏：会话选择 + 手动刷新 + 类型过滤。 */
function ReplayToolbar({ sessions, selected, onSelect, filter, onFilter, onRefresh }) {
  return createElement(
    'div',
    { className: 'dsh-my-observability-toolbar' },
    createElement(
      'div',
      { className: 'dsh-my-observability-toolbar-row' },
      createElement(
        'select',
        {
          className: 'dsh-my-observability-select',
          value: selected,
          disabled: sessions.length === 0,
          onChange: (e) => onSelect(e.target.value),
        },
        sessions.length === 0
          ? createElement('option', { value: '' }, strings.allSessions())
          : sessions.map((s) => createElement('option', { key: s.sessionId, value: s.sessionId }, s.sessionId)),
      ),
      createElement(
        'button',
        {
          type: 'button',
          className: 'dsh-my-observability-iconbtn',
          'aria-label': strings.refresh(),
          title: strings.refresh(),
          onClick: onRefresh,
        },
        icon.refresh(15),
      ),
    ),
    createElement(TypeFilter, { filter, onFilter }),
  )
}

/** 加载中状态（旋转刷新图标 + 次级色文案，不阻塞布局）。 */
function LoadingState() {
  return createElement(
    'div',
    { className: 'dsh-my-observability-state' },
    icon.refresh(14),
    createElement('span', null, strings.loading()),
  )
}

/** 空状态（图标 + 主文案 + hint 两行结构）。 */
function EmptyState() {
  return createElement(
    'div',
    { className: 'dsh-my-observability-empty' },
    createElement('span', { className: 'dsh-my-observability-empty-icon' }, icon.clock(20)),
    createElement('span', null, strings.emptyEvents()),
    createElement('span', { className: 'dsh-my-observability-empty-hint' }, strings.emptyEventsHint()),
  )
}

/** 错误状态（错误色文案 + 重试按钮）。 */
function ErrorState({ message, onRetry }) {
  return createElement(
    'div',
    { className: 'dsh-my-observability-error' },
    createElement('span', { className: 'dsh-my-observability-error-text' }, `${strings.loadError()}：${message}`),
    createElement(
      'button',
      {
        type: 'button',
        className: 'dsh-my-observability-iconbtn',
        'aria-label': strings.retry(),
        title: strings.retry(),
        onClick: onRetry,
      },
      icon.refresh(15),
    ),
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
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    if (!visible) return undefined
    let alive = true
    const setters = { setSessions, setSelected, setEvents, setError, setLoading }
    const tick = () => {
      if (alive) void loadReplayData(selected, currentSession, setters)
    }
    tick()
    const timer = setInterval(tick, REPLAY_POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [visible, selected, currentSession, reloadTick])

  const retry = () => {
    setError('')
    setLoading(true)
    setReloadTick((tick) => tick + 1)
  }

  const filtered = filterEvents(events, filter)
  const rows = filtered.map((event, index) => createElement(EventRow, { key: event.id ?? index, event }))

  return createElement(
    'div',
    { className: 'dsh-my-observability-panel' },
    createElement(ReplayToolbar, {
      sessions,
      selected,
      onSelect: setSelected,
      filter,
      onFilter: setFilter,
      onRefresh: retry,
    }),
    error !== '' ? createElement(ErrorState, { message: error, onRetry: retry }) : null,
    loading && error === '' ? createElement(LoadingState, null) : null,
    !loading && error === '' && filtered.length === 0 ? createElement(EmptyState, null) : null,
    createElement('div', { className: 'dsh-my-observability-timeline' }, rows),
  )
}
