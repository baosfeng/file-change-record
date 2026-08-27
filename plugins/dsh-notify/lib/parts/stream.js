    // ── 通知分发（SSE 帧 → 渲染入口）───────────────────────────────────
    function isNoticeKind(kind) {
      return kind === 'end' || kind === 'ask' || kind === 'approval' || kind === 'remote'
    }

    function openSessionFor(sessionId, sessionsSvc) {
      return () => {
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
          void Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              fireSystemNotification(notice, sessionId, openSession)
            } else {
              showToast(notice, openSession)
            }
          }).catch(() => showToast(notice, openSession))
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
      ctx.effect(() => injectStyles(), 'dsh-notify: styles')

      // 音频解锁：首次用户交互后 resume（浏览器自动播放策略）。
      ctx.effect(() => armAudioUnlock(), 'dsh-notify: audio unlock')

      // SSE 订阅：server 事件 → 浏览器通知。
      ctx.effect(() => subscribeStream(sessionsSvc), 'dsh-notify: event stream')

      // 设置页 tab（官方 slots 扩展点，issue #27 配置可视化）。
      attachSettingsTab(ctx)
    }
