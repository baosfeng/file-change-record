exports.inject = []

exports.apply = function apply(ctx) {
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
