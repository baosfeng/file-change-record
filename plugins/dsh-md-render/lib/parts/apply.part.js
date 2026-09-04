exports.inject = []

exports.apply = function apply(ctx) {
  // 增强功能开关（issue #84）：从插件配置读取全部开关（默认开）；缺省
  // 或非法值保持默认，不覆盖 renderOptions。
  setRenderOptions(pickRenderOptions(ctx && ctx.config))

  // Stylesheet first, unconditionally (see dsh-file-activity pitfall:
  // injecting styles behind a service early-return loses them on HMR).
  ctx.effect(() => {
    if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') return () => {}
    const style = document.createElement('style')
    style.setAttribute('data-dsh-md-render', 'styles')
    style.textContent = STYLES
    document.head.appendChild(style)
    return () => {
      if (style.parentNode) style.parentNode.removeChild(style)
    }
  }, 'dsh-md-render: styles')

  ctx.effect(() => installScanner(), 'dsh-md-render: scanner')

  // 设置页 tab（官方 slots 扩展点，issue #84 配置可视化）。
  attachSettingsTab(ctx)
}
