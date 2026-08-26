    // ── plugin body ───────────────────────────────────────────────────────
    // 零第三方依赖：不 inject better-sidebar（那是第三方插件服务）。面板是
    // 可选增强——ctx.get('betterSidebar') 动态获取，服务不存在时静默跳过，
    // 核心治理能力（候选区/隔离/安全模式）纯 server 端，不受影响。
    exports.apply = function apply(ctx) {
      ctx.effect(() => {
        if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') return () => {}
        const style = document.createElement('style')
        style.setAttribute('data-dsh-guardian', 'styles')
        style.textContent = STYLES
        document.head.appendChild(style)
        return () => {
          if (style.parentNode) style.parentNode.removeChild(style)
        }
      }, 'dsh-guardian: styles')

      const service = ctx.get('betterSidebar')
      if (service === undefined) return

      ctx.effect(() => service.registerTab({
        id: TAB_ID,
        title: () => strings.title(),
        order: 80,
        single: true,
        component: ({ scope, visible }) => createElement(GuardianView, { sessionId: scope.sessionId, visible }),
      }), 'dsh-guardian: tab registration')
    }
