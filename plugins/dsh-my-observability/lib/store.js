/**
 * dsh-my-observability — audit event store.
 *
 * 事件审计日志的内存态 + 持久化：
 *  - 按会话隔离（bySession 分桶），查询/追加都限定在单个会话内；
 *  - 每会话事件上限（MAX_EVENTS_PER_SESSION，FIFO 淘汰），防无限膨胀；
 *  - 持久化 $DSH_HOME/observability/audit.json（防抖 500ms + 原子写
 *    tmp+rename + teardown flush），启动时异步加载（加载完成前的事件
 *    缓冲在 pending，加载后回放），重启后完整恢复；
 *  - 全局事件上限（MAX_TOTAL_EVENTS），超限按会话轮转淘汰最旧会话事件。
 */
import { readFile } from 'node:fs/promises'
import { atomicWriteJson } from 'dsh-shared'
import { homedir } from 'node:os'
import { join } from 'node:path'

const MAX_EVENTS_PER_SESSION = 2000
const MAX_TOTAL_EVENTS = 20000

/** 审计数据文件：$DSH_HOME/observability/audit.json（fallback ~/.dsh/…）。 */
export function stateFile() {
  const home = process.env.DSH_HOME
  const base = typeof home === 'string' && home !== '' ? home : homedir()
  return join(base, 'observability', 'audit.json')
}

/** 初始空状态。 */
function createState() {
  return { version: 1, bySession: {} }
}

/**
 * 创建审计存储：{ state, record, events, sessions, count, dispose }。
 * record 在状态加载完成前缓冲（不丢事件）；dispose 冲刷未落盘数据。
 */
export function createStore(ctx) {
  const store = { state: createState() }
  const handle = {
    ctx,
    file: stateFile(),
    store,
    pending: [],
    ready: false,
    persistTimer: null,
    dirtyChain: Promise.resolve(),
  }
  store.record = (event) => record(handle, event)
  store.events = (sessionId, type, limit) => eventsOf(handle, sessionId, type, limit)
  store.sessions = () => sessionsOf(handle)
  store.count = () => countOf(handle)
  store.dispose = () => dispose(handle)
  void readFile(handle.file, 'utf8')
    .then((text) => onLoaded(handle, text))
    .catch(() => onLoaded(handle, ''))
  return store
}

/** 追加一条审计事件（自动分配 id/时间戳）；未就绪时缓冲。 */
function record(handle, event) {
  const item = { id: nextId(handle), time: Date.now(), ...event }
  if (!handle.ready) {
    handle.pending.push(item)
    return item
  }
  appendEvent(handle, item)
  persistSoon(handle)
  return item
}

/** 查询某会话的事件（正序时间轴；type 可选过滤；limit 限制条数）。 */
function eventsOf(handle, sessionId, type, limit) {
  const bucket = handle.store.state.bySession[sessionId]?.events
  if (!Array.isArray(bucket)) return []
  let list = bucket
  if (type !== undefined && type !== null && type !== '') {
    list = list.filter((event) => event.type === type)
  }
  const capped = typeof limit === 'number' && limit > 0 ? list.slice(-limit) : list
  return capped.map((event) => ({ ...event }))
}

/** 有审计事件的会话列表（按最后活动时间倒序，含事件数）。 */
function sessionsOf(handle) {
  const entries = Object.entries(handle.store.state.bySession)
  const list = entries
    .map(([sessionId, bucket]) => ({
      sessionId,
      count: bucket.events.length,
      lastTime: bucket.events.length > 0 ? bucket.events[bucket.events.length - 1].time : 0,
    }))
    .filter((entry) => entry.count > 0)
  list.sort((a, b) => b.lastTime - a.lastTime)
  return list
}

/** 全部会话事件总数（供状态展示/测试断言）。 */
function countOf(handle) {
  let total = 0
  for (const bucket of Object.values(handle.store.state.bySession)) total += bucket.events.length
  return total
}

/** 事件自增 id（跨会话单调）。 */
function nextId(handle) {
  handle.seq = (handle.seq ?? 0) + 1
  return handle.seq
}

/** 追加事件到会话桶：FIFO 淘汰 + 全局上限轮转淘汰。 */
function appendEvent(handle, event) {
  const state = handle.store.state
  const bucket = state.bySession[event.sessionId] ?? (state.bySession[event.sessionId] = { events: [] })
  bucket.events.push(event)
  if (bucket.events.length > MAX_EVENTS_PER_SESSION) {
    bucket.events.splice(0, bucket.events.length - MAX_EVENTS_PER_SESSION)
  }
  if (countOf(handle) > MAX_TOTAL_EVENTS) evictOldest(handle)
}

/** 全局超限：从最早活动的会话整桶淘汰，直到回到上限内。 */
function evictOldest(handle) {
  const state = handle.store.state
  const sessions = Object.entries(state.bySession)
    .filter(([, bucket]) => bucket.events.length > 0)
    .sort((a, b) => firstTimeOf(a[1]) - firstTimeOf(b[1]))
  for (const [sessionId, bucket] of sessions) {
    if (countOf(handle) <= MAX_TOTAL_EVENTS) break
    delete state.bySession[sessionId]
    void bucket
  }
}

function firstTimeOf(bucket) {
  return bucket.events.length > 0 ? bucket.events[0].time : 0
}

/** 状态加载完成：解析/规整 + 合并本进程已产生的事件 + 回放缓冲 + 落盘。 */
function onLoaded(handle, text) {
  const parsed = parseLoaded(text)
  if (parsed !== undefined) {
    mergeCurrent(handle.store.state, parsed)
    handle.store.state = parsed
  }
  handle.ready = true
  const pending = handle.pending.splice(0)
  for (const item of pending) appendEvent(handle, item)
  if (pending.length > 0 || parsed !== undefined) persistSoon(handle)
}

/** 把当前 state 中已产生的事件合并进磁盘状态（防 dispose 回放后覆盖丢失）。 */
function mergeCurrent(current, parsed) {
  for (const [sessionId, bucket] of Object.entries(current.bySession)) {
    if (!Array.isArray(bucket.events) || bucket.events.length === 0) continue
    const target = parsed.bySession[sessionId] ?? (parsed.bySession[sessionId] = { events: [] })
    target.events.push(...bucket.events)
  }
}

/** 解析已持久化的状态（结构不合法时回退空状态）。 */
function parseLoaded(text) {
  if (text === undefined || text === null || text === '') return undefined
  try {
    const parsed = JSON.parse(text)
    if (!isValidRoot(parsed)) return undefined
    const state = createState()
    for (const [sessionId, bucket] of Object.entries(parsed.bySession)) {
      const events = validEventsOf(bucket)
      if (events.length > 0) state.bySession[sessionId] = { events }
    }
    return state
  } catch {
    return undefined
  }
}

/** 持久化根结构校验（bySession 必须为对象）。 */
function isValidRoot(parsed) {
  return parsed !== null && typeof parsed === 'object' && typeof parsed.bySession === 'object'
}

/** 会话桶事件规整：过滤非法事件 + 截断到每会话上限。 */
function validEventsOf(bucket) {
  return Array.isArray(bucket?.events) ? bucket.events.filter(isValidEvent).slice(-MAX_EVENTS_PER_SESSION) : []
}

/** 事件结构校验（时间/会话/类型为字符串与数字的合理形态）。 */
function isValidEvent(event) {
  return (
    event !== null &&
    typeof event === 'object' &&
    typeof event.time === 'number' &&
    typeof event.sessionId === 'string' &&
    typeof event.type === 'string'
  )
}

/** 原子写当前状态（经 dirtyChain 串行化；自动建目录）。 */
function persistNow(handle) {
  handle.dirtyChain = handle.dirtyChain
    .then(() => atomicWriteJson(handle.file, handle.store.state, handle.ctx.logger, '[dsh-my-observability]'))
    .catch(() => {})
}

/** 防抖（500ms）调度持久化。 */
function persistSoon(handle) {
  if (handle.persistTimer !== null) return
  handle.persistTimer = setTimeout(() => {
    handle.persistTimer = null
    persistNow(handle)
  }, 500)
}

/** 卸载冲刷：清定时器 + 回放未就绪缓冲 + 立即落盘。 */
function dispose(handle) {
  if (handle.persistTimer !== null) {
    clearTimeout(handle.persistTimer)
    handle.persistTimer = null
  }
  if (!handle.ready) {
    const pending = handle.pending.splice(0)
    for (const item of pending) appendEvent(handle, item)
  }
  persistNow(handle)
  void handle.dirtyChain
}
