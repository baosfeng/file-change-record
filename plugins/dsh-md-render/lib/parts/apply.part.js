exports.inject = []

exports.apply = function apply(ctx) {
  // 行号开关（issue #80）：从插件配置读取 lineNumbers（默认开）；缺省
  // 或非法值保持默认，不覆盖 renderOptions。
  const cfg = ctx && ctx.config
  if (cfg && typeof cfg.lineNumbers === 'boolean') {
    setRenderOptions({ lineNumbers: cfg.lineNumbers })
  }

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
}
