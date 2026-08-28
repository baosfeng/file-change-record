// ── plugin body ───────────────────────────────────────────────────────
// 零第三方依赖：面板挂在官方 slots 扩展点（设置 → 插件 → 记忆），
// 不依赖 dsh-better-sidebar。slots 服务是官方 client 服务，通过
// ctx.get 动态获取——服务缺省时静默跳过（不注册 tab，server 端记忆
// 能力不受影响）。
exports.apply = function apply(ctx) {
  ctx.effect(() => {
    if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') return () => {}
    const style = document.createElement('style')
    style.setAttribute(STYLE_TAG, 'styles')
    style.textContent = STYLES
    document.head.appendChild(style)
    return () => {
      if (style.parentNode) style.parentNode.removeChild(style)
    }
  }, 'dsh-my-memory: styles')

  const slots = ctx.get('slots')
  if (slots === undefined) return

  ctx.effect(
    () =>
      slots.inject('settings.plugins.tab', () =>
        slots.register(
          {
            name: 'settings.plugins.tab',
            id: 'my-memory',
            order: 92,
            label: () => strings.title(),
          },
          MemoryView,
        ),
      ),
    'dsh-my-memory: settings tab registration',
  )
}
