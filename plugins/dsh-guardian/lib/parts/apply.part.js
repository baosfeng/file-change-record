    // ── plugin body ───────────────────────────────────────────────────────
    exports.inject = ['betterSidebar']

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
