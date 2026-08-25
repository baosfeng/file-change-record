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
