/**
 * dsh-my-notify — SSE 客户端集合 + 通知构造 + 同类去重窗口 + 心跳。
 *
 * createNoticeBus 创建共享通知总线：所有订阅客户端（Set）、去重记录
 * （Map）与心跳定时器都归总线所有；emitNotice 构造通知帧并广播。
 * 内部函数均取显式 state，避免超长闭包工厂。
 */

/** 创建通知总线：持有客户端集合、去重窗口与心跳定时器。 */
export function createNoticeBus(options) {
  const state = {
    clients: new Set(), // { response }
    recent: new Map(), // `${kind}:${sessionId ?? ''}` -> lastPushTime
    heartbeatTimer: null,
  }
  return {
    clients: state.clients,
    emitNotice: (notice) => emitNotice(state, options, notice),
    startHeartbeat: () => startHeartbeat(state),
    stopHeartbeat: () => stopHeartbeat(state),
  }
}

/** 广播一条通知到所有已订阅客户端（逐条容忍失败，失败即摘除）。 */
function broadcast(state, notice) {
  const payload = `data: ${JSON.stringify(notice)}\n\n`
  for (const client of [...state.clients]) {
    try {
      client.response.write(payload)
    } catch {
      state.clients.delete(client)
      try {
        client.response.destroy()
      } catch {
        /* ignore */
      }
    }
  }
}

/** 构造通知并广播（同类同会话在去重窗口内只推一次）。 */
function emitNotice(state, options, notice) {
  const key = `${notice.kind}:${notice.sessionId ?? ''}`
  const now = Date.now()
  if (state.recent.has(key) && now - state.recent.get(key) < options.dedupeMs) return
  evictStale(state, options, now)
  state.recent.set(key, now)
  broadcast(state, noticeFrame(notice, now))
}

/** 淘汰过期去重条目，避免 Map 无限增长。 */
function evictStale(state, options, now) {
  if (state.recent.size <= 128) return
  for (const [k, t] of state.recent) {
    if (now - t >= options.dedupeMs) state.recent.delete(k)
  }
}

/** 构造 SSE 通知帧（字段规整，缺失回退空串；agentType 默认 top）。 */
function noticeFrame(notice, now) {
  return {
    type: 'notice',
    kind: notice.kind,
    sessionId: typeof notice.sessionId === 'string' ? notice.sessionId : '',
    title: typeof notice.title === 'string' ? notice.title : '',
    note: typeof notice.note === 'string' ? notice.note : '',
    toolName: typeof notice.toolName === 'string' ? notice.toolName : '',
    agentType: notice.agentType === 'subagent' ? 'subagent' : 'top',
    time: now,
  }
}

/** 启动 SSE 心跳（空闲连接保活；仅首次启动，幂等）。 */
function startHeartbeat(state) {
  if (state.heartbeatTimer !== null) return
  state.heartbeatTimer = setInterval(() => {
    for (const c of [...state.clients]) {
      try {
        c.response.write(': ping\n\n')
      } catch {
        state.clients.delete(c)
      }
    }
  }, 25_000)
}

/** 停止心跳（幂等；卸载时调用）。 */
function stopHeartbeat(state) {
  if (state.heartbeatTimer !== null) {
    clearInterval(state.heartbeatTimer)
    state.heartbeatTimer = null
  }
}
