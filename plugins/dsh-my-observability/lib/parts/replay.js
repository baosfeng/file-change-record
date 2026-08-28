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
