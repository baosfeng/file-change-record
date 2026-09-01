// ── 通知分发（SSE 帧 → 渲染入口）───────────────────────────────────
function isNoticeKind(kind) {
  return kind === 'end' || kind === 'ask' || kind === 'approval' || kind === 'remote'
}

// ── 通知去重（issue #70）：本地窗口 + 跨标签页协调 ─────────────────
// 服务端已按 kind:sessionId 在 dedupeMs（默认 3000ms）内去重；客户端再做
// 双保险：① 本标签页内存窗口（快速路径 + localStorage 不可用时的兜底）；
// ② localStorage 时间戳锁（跨标签页协调——同一通知只由一个标签页弹系统
// 通知 + 响铃，其余标签页静默）。窗口 2000ms，覆盖多标签页帧到达时间差
// 与服务端窗口外的偶发重复帧。
const CLIENT_DEDUPE_MS = 2000
const DEDUPE_LS_PREFIX = 'dsh-notify:dedupe:'
const localRecent = new Map() // `${kind}:${sessionId}` -> lastTime

/** 通知帧是否在去重窗口内已处理（本标签页或其他标签页）；未处理则登记并返回 true。 */
function claimNotice(key) {
  const now = Date.now()
  const lastLocal = localRecent.get(key)
  if (lastLocal !== undefined && now - lastLocal < CLIENT_DEDUPE_MS) return false
  try {
    const lockKey = DEDUPE_LS_PREFIX + key
    const last = Number(window.localStorage.getItem(lockKey) || 0)
    if (now - last < CLIENT_DEDUPE_MS) {
      localRecent.set(key, now)
      return false
    }
    window.localStorage.setItem(lockKey, String(now))
  } catch {
    // localStorage 不可用（隐私模式等）：仅本地窗口去重
  }
  localRecent.set(key, now)
  if (localRecent.size > 256) {
    for (const [k, t] of localRecent) {
      if (now - t >= CLIENT_DEDUPE_MS) localRecent.delete(k)
    }
  }
  return true
}

function openSessionFor(sessionId, sessionsSvc) {
  return () => {
    try {
      window.focus()
    } catch {
      // ignore
    }
    if (
      sessionId !== '' &&
      sessionsSvc !== undefined &&
      sessionsSvc !== null &&
      typeof sessionsSvc.open === 'function'
    ) {
      try {
        sessionsSvc.open(sessionId)
      } catch {
        // opening is best-effort
      }
    }
  }
}

function dispatchByPermission(notice, sessionId, openSession) {
  if (prefOn(LS.notify, true) && typeof window !== 'undefined' && typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') {
      fireSystemNotification(notice, sessionId, openSession)
      return
    }
    if (Notification.permission === 'default') {
      // 第一次收到通知时请求权限（用户此刻正需要它）；请求期间先以
      // toast + 声音保证提醒，授权成功后本次已不重复弹系统通知。
      void Notification.requestPermission()
        .then((permission) => {
          if (permission === 'granted') {
            fireSystemNotification(notice, sessionId, openSession)
          } else {
            showToast(notice, openSession)
          }
        })
        .catch(() => showToast(notice, openSession))
      showToast(notice, openSession)
      return
    }
  }
  showToast(notice, openSession)
}

function handleNotice(notice, sessionsSvc) {
  if (notice === null || typeof notice !== 'object' || notice.type !== 'notice') return
  if (!isNoticeKind(notice.kind)) return
  const sessionId = typeof notice.sessionId === 'string' ? notice.sessionId : ''
  const key = `${notice.kind}:${sessionId}`
  if (!claimNotice(key)) return // 窗口内已处理（本标签页或其他标签页）→ 静默
  const openSession = openSessionFor(sessionId, sessionsSvc)
  dispatchByPermission(notice, sessionId, openSession)
  if (prefOn(LS.sound, true)) beep()
}

// ── SSE 订阅（server 事件 → 浏览器通知）─────────────────────────────
function subscribeStream(sessionsSvc) {
  if (typeof window === 'undefined' || typeof EventSource !== 'function') return () => {}
  const source = new EventSource('/notify/api/stream')
  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      handleNotice(data, sessionsSvc)
    } catch {
      // one bad frame must never kill the stream handler
    }
  }
  return () => {
    source.close()
    removeToastBox()
  }
}

// ── 插件体 ──────────────────────────────────────────────────────────
exports.apply = function apply(ctx) {
  const sessionsSvc = ctx.get('sessions')

  // 样式注入（与 fiber 同生命周期）。
  ctx.effect(() => injectStyles(), 'dsh-my-notify: styles')

  // 音频解锁：首次用户交互后 resume（浏览器自动播放策略）。
  ctx.effect(() => armAudioUnlock(), 'dsh-my-notify: audio unlock')

  // SSE 订阅：server 事件 → 浏览器通知。
  ctx.effect(() => subscribeStream(sessionsSvc), 'dsh-my-notify: event stream')

  // 设置页 tab（官方 slots 扩展点，issue #27 配置可视化）。
  attachSettingsTab(ctx)
}
