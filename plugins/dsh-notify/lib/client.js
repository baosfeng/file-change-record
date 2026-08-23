/**
 * dsh-notify — client half (browser).
 *
 * 订阅 server 端 SSE 通道（/notify/api/stream，由 lib/index.js 广播），在
 * 收到通知帧后：
 *  - 系统通知（Notification API）：标题=会话标题，正文=类型+摘要；
 *    点击 → 聚焦窗口 + 打开对应会话（ctx.sessions.open）；
 *  - 提示音：Web Audio 合成短促「滴」声（无需音频资源；受浏览器自动播放
 *    策略约束，首次用户交互后解锁）；
 *  - 页面内 toast 兜底：权限被拒/关闭通知时仍可见提醒，点击同样跳转。
 *
 * 本地开关（localStorage）：
 *  - dsh-notify:notify = '0' 关闭系统通知（默认开）
 *  - dsh-notify:sound   = '0' 关闭提示音（默认开）
 *  - dsh-notify:toast   = '0' 关闭页面内 toast（默认开）
 *
 * 样式走 DSH 语义 token（--dsw-alias-* / --dsw-font-*），随 activation
 * 注入、fiber teardown 卸载（HMR/禁用无残留）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-notify',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement } = require('react')

    // ── i18n ──────────────────────────────────────────────────────────────
    function isZh() {
      try {
        const lang = (navigator.language || 'en').toLowerCase()
        return lang.startsWith('zh')
      } catch {
        return false
      }
    }

    const strings = {
      kindEnd: () => (isZh() ? '会话已结束' : 'Session finished'),
      kindAsk: () => (isZh() ? '需要你回答' : 'Needs your answer'),
      kindApproval: () => (isZh() ? '等待你的批准' : 'Approval needed'),
      kindRemote: () => (isZh() ? '提示' : 'Notice'),
      untitled: (short) => (isZh() ? (short !== '' ? `会话 ${short}` : '会话') : short !== '' ? `Session ${short}` : 'Session'),
      hintClick: () => (isZh() ? '点击查看会话' : 'Click to view session'),
    }

    // ── 本地开关（localStorage 覆盖，默认全开）──────────────────────────
    const LS = { notify: 'dsh-notify:notify', sound: 'dsh-notify:sound', toast: 'dsh-notify:toast' }

    function prefOn(key, def) {
      try {
        const v = window.localStorage.getItem(key)
        if (v === null) return def
        return v === '1'
      } catch {
        return def
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
      void Promise.resolve(resume).then(() => {
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
      }).catch(() => {
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

    // ── 通知内容构造 ─────────────────────────────────────────────────────
    function shortId(id) {
      if (typeof id !== 'string' || id === '') return ''
      return id.length > 8 ? id.slice(0, 8) : id
    }

    function kindLabel(kind) {
      switch (kind) {
        case 'end': return strings.kindEnd()
        case 'ask': return strings.kindAsk()
        case 'approval': return strings.kindApproval()
        default: return strings.kindRemote()
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

    // ── 页面内 toast（通知权限关闭/被拒时的兜底）──────────────────────
    function ensureToastBox() {
      let box = document.getElementById('dsh-notify-toast-box')
      if (box === null) {
        box = document.createElement('div')
        box.id = 'dsh-notify-toast-box'
        box.className = 'dn-toast-box'
        document.body.appendChild(box)
      }
      return box
    }

    function showToast(notice, onOpen) {
      if (!prefOn(LS.toast, true)) return
      if (typeof document === 'undefined') return
      const box = ensureToastBox()
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
      box.appendChild(item)
      if (box.children.length > 4) box.removeChild(box.firstChild)
    }

    function removeToastBox() {
      try {
        const box = document.getElementById('dsh-notify-toast-box')
        if (box !== null && box.parentNode !== null) box.parentNode.removeChild(box)
      } catch {
        // ignore
      }
    }

    // ── 通知分发 ─────────────────────────────────────────────────────────
    function handleNotice(notice, sessionsSvc) {
      if (notice === null || typeof notice !== 'object' || notice.type !== 'notice') return
      if (notice.kind !== 'end' && notice.kind !== 'ask' && notice.kind !== 'approval' && notice.kind !== 'remote') return

      const sessionId = typeof notice.sessionId === 'string' ? notice.sessionId : ''

      const openSession = () => {
        try {
          window.focus()
        } catch {
          // ignore
        }
        if (sessionId !== '' && sessionsSvc !== undefined && sessionsSvc !== null && typeof sessionsSvc.open === 'function') {
          try {
            sessionsSvc.open(sessionId)
          } catch {
            // opening is best-effort
          }
        }
      }

      if (prefOn(LS.notify, true) && typeof window !== 'undefined' && typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          fireSystemNotification(notice, sessionId, openSession)
        } else if (Notification.permission === 'default') {
          // 第一次收到通知时请求权限（用户此刻正需要它）；请求期间先以
          // toast + 声音保证提醒，授权成功后本次已不重复弹系统通知。
          void Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              fireSystemNotification(notice, sessionId, openSession)
            } else {
              showToast(notice, openSession)
            }
          }).catch(() => showToast(notice, openSession))
          showToast(notice, openSession)
        } else {
          showToast(notice, openSession)
        }
      } else {
        showToast(notice, openSession)
      }

      if (prefOn(LS.sound, true)) beep()
    }

    function fireSystemNotification(notice, sessionId, openSession) {
      try {
        const bodyText = noticeBody(notice)
        const notification = new Notification(noticeTitle(notice), {
          body: bodyText !== '' ? bodyText : kindLabel(notice.kind),
          tag: `dsh-notify:${notice.kind}:${sessionId}`,
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

    // ── 插件体 ───────────────────────────────────────────────────────────
    exports.apply = function apply(ctx) {
      const sessionsSvc = ctx.get('sessions')

      // 样式注入（与 fiber 同生命周期）。
      ctx.effect(() => {
        if (typeof document === 'undefined' || typeof document.head === 'undefined') return () => {}
        const style = document.createElement('style')
        style.setAttribute('data-dsh-notify', 'styles')
        style.textContent = STYLES
        document.head.appendChild(style)
        return () => {
          if (style.parentNode !== null) style.parentNode.removeChild(style)
        }
      }, 'dsh-notify: styles')

      // 音频解锁：首次用户交互后 resume（浏览器自动播放策略）。
      ctx.effect(() => armAudioUnlock(), 'dsh-notify: audio unlock')

      // SSE 订阅：server 事件 → 浏览器通知。
      ctx.effect(() => {
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
      }, 'dsh-notify: event stream')
    }

    return module.exports
  },
})
