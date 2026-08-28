// ── 通知内容构造 ────────────────────────────────────────────────────
function shortId(id) {
  if (typeof id !== 'string' || id === '') return ''
  return id.length > 8 ? id.slice(0, 8) : id
}

function kindLabel(kind) {
  switch (kind) {
    case 'end':
      return strings.kindEnd()
    case 'ask':
      return strings.kindAsk()
    case 'approval':
      return strings.kindApproval()
    default:
      return strings.kindRemote()
  }
}

function noticeTitle(notice) {
  if (typeof notice.title === 'string' && notice.title !== '') return notice.title
  return strings.untitled(shortId(notice.sessionId))
}

function noticeBody(notice) {
  const parts = []
  if (notice.kind !== 'remote') parts.push(kindLabel(notice.kind))
  if (typeof notice.toolName === 'string' && notice.toolName !== '') parts.push(notice.toolName)
  if (typeof notice.note === 'string' && notice.note !== '') parts.push(notice.note)
  return parts.join(' · ')
}

function faviconOf() {
  try {
    const link = document.querySelector('link[rel="icon"]')
    return link !== null && typeof link.href === 'string' ? link.href : ''
  } catch {
    return ''
  }
}

// ── 提示音（Web Audio 合成短促滴声）────────────────────────────────
let audioCtx = null

function baseAudio() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (typeof AC !== 'function') return null
  if (audioCtx === null) {
    try {
      audioCtx = new AC()
    } catch {
      return null
    }
  }
  return audioCtx
}

function beep() {
  const ac = baseAudio()
  if (ac === null) return
  const resume = typeof ac.resume === 'function' ? ac.resume() : Promise.resolve()
  void Promise.resolve(resume)
    .then(() => {
      if (!prefOn(LS.sound, true)) return
      const t0 = ac.currentTime
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t0)
      osc.stop(t0 + 0.24)
    })
    .catch(() => {
      // autoplay policy / audio hardware: sound is best-effort
    })
}

/** 浏览器自动播放策略：首次用户交互后解锁 AudioContext。 */
function armAudioUnlock() {
  if (typeof document === 'undefined') return () => {}
  const unlock = () => {
    try {
      const ac = baseAudio()
      if (ac !== null && typeof ac.resume === 'function') void ac.resume()
    } catch {
      // ignore
    }
    document.removeEventListener('pointerdown', unlock)
    document.removeEventListener('keydown', unlock)
  }
  document.addEventListener('pointerdown', unlock, { passive: true })
  document.addEventListener('keydown', unlock)
  return () => {
    document.removeEventListener('pointerdown', unlock)
    document.removeEventListener('keydown', unlock)
  }
}

// ── 页面内 toast（通知权限关闭/被拒时的兜底）────────────────────────
function ensureToastBox() {
  let box = document.getElementById('dsh-my-notify-toast-box')
  if (box === null) {
    box = document.createElement('div')
    box.id = 'dsh-my-notify-toast-box'
    box.className = 'dn-toast-box'
    document.body.appendChild(box)
  }
  return box
}

function buildToastItem(notice) {
  const item = document.createElement('div')
  item.className = 'dn-toast'
  item.setAttribute('role', 'status')
  const head = document.createElement('div')
  head.className = 'dn-toast-head'
  const badge = document.createElement('span')
  badge.className = 'dn-toast-badge'
  badge.textContent = kindLabel(notice.kind)
  const title = document.createElement('span')
  title.className = 'dn-toast-title'
  title.textContent = noticeTitle(notice)
  head.appendChild(badge)
  head.appendChild(title)
  item.appendChild(head)
  const body = document.createElement('div')
  body.className = 'dn-toast-body'
  const bodyText = noticeBody(notice) || kindLabel(notice.kind)
  body.textContent = bodyText
  item.appendChild(body)
  // 只允许 textContent 渲染：note/远程 body 不受信任，禁止 innerHTML。
  return item
}

function attachToastEvents(item, onOpen) {
  let timer = null
  const dismiss = () => {
    if (timer !== null) clearTimeout(timer)
    if (item.parentNode !== null) item.parentNode.removeChild(item)
  }
  item.addEventListener('click', (event) => {
    if (event !== null && event.stopPropagation) event.stopPropagation()
    dismiss()
    try {
      onOpen()
    } catch {
      // opening the session is best-effort
    }
  })
  timer = setTimeout(dismiss, 6000)
}

function showToast(notice, onOpen) {
  if (!prefOn(LS.toast, true)) return
  if (typeof document === 'undefined') return
  const box = ensureToastBox()
  const item = buildToastItem(notice)
  attachToastEvents(item, onOpen)
  box.appendChild(item)
  if (box.children.length > 4) box.removeChild(box.firstChild)
}

function removeToastBox() {
  try {
    const box = document.getElementById('dsh-my-notify-toast-box')
    if (box !== null && box.parentNode !== null) box.parentNode.removeChild(box)
  } catch {
    // ignore
  }
}

// ── 系统通知（Notification API）────────────────────────────────────
function fireSystemNotification(notice, sessionId, openSession) {
  try {
    const bodyText = noticeBody(notice)
    const notification = new Notification(noticeTitle(notice), {
      body: bodyText !== '' ? bodyText : kindLabel(notice.kind),
      tag: `dsh-my-notify:${notice.kind}:${sessionId}`,
      icon: faviconOf(),
    })
    notification.onclick = () => {
      try {
        notification.close()
      } catch {
        // ignore
      }
      openSession()
    }
  } catch {
    // Notification constructor failure: fall back to the toast.
    showToast(notice, openSession)
  }
}

// ── 样式（DSH 语义 token，随 activation 注入）───────────────────────
const STYLES = `
.dn-toast-box{position:fixed;right:16px;bottom:16px;z-index:3000;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.dn-toast{pointer-events:auto;width:284px;max-width:calc(100vw - 32px);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);
  border:1px solid var(--dsw-alias-border-l2);border-radius:10px;box-shadow:var(--dsw-shadow-lv2);padding:10px 12px;cursor:pointer;
  animation:dn-toast-in 160ms var(--ds-ease-in-out);display:flex;flex-direction:column;gap:4px}
.dn-toast:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dn-toast-head{display:flex;align-items:center;gap:8px;min-width:0}
.dn-toast-badge{flex:none;font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-state-warn-primary);
  background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent);border-radius:4px;padding:1px 6px}
.dn-toast-title{flex:1;min-width:0;font:var(--dsw-font-s-strong-14);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dn-toast-body{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);line-height:1.6;word-break:break-word}
@keyframes dn-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
`

function injectStyles() {
  if (typeof document === 'undefined' || typeof document.head === 'undefined') return () => {}
  const style = document.createElement('style')
  style.setAttribute('data-dsh-my-notify', 'styles')
  style.textContent = STYLES
  document.head.appendChild(style)
  return () => {
    if (style.parentNode !== null) style.parentNode.removeChild(style)
  }
}
