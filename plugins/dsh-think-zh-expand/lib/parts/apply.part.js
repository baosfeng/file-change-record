/**
 * PART: 插件入口（样式常量 + slots 注册 + UI 中文化装配）。
 *
 * 由 scripts/build.mjs 拼入 lib/client.js 的 factory 作用域（纯函数声明
 * 文本，无 import/export）。依赖 factory 内的 createElement、
 * AssistantStepView 与 installUiLocalize。行为与拆分前等价：样式随
 * activation 注入、fiber teardown 卸载；assistant-step 渲染器以 priority
 * -1 替换内置（0）；UI 中文化随 fiber 卸载断开观察器。
 */

// ── 样式（DSH 语义 token，随 activation 注入）───────────────────
// 仅保留本插件职责相关样式（assistant 容器 / 思考块 / 已停止标记）；
// MarkdownView 的渲染样式（.tzx-md 系列）已随 issue #31 迁移至
// dsh-md-render（其 styles.part.js 注入）。
const STYLES = `
.tzx-assistant{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary);font-size:16px;line-height:28px}
.tzx-assistant-body{display:flex;flex-direction:column;gap:16px}
.tzx-think{display:flex;flex-direction:column;color:var(--dsw-alias-label-tertiary)}
.tzx-think-row{display:flex;align-items:center;gap:8px;min-width:0;cursor:pointer;user-select:none;padding:2px 0;border-radius:6px}
.tzx-think-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.tzx-think-chevron{flex:none;color:var(--dsw-alias-label-secondary);font-size:12px}
.tzx-think-title{flex:none;font-size:14px;font-weight:400;color:var(--dsw-alias-label-secondary)}
.tzx-think-summary{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;font-size:14px;line-height:24px;overflow:hidden}
.tzx-think-body{white-space:pre-wrap;word-break:break-word;padding:4px 0 4px 24px;font-size:14px;line-height:24px;color:var(--dsw-alias-label-tertiary)}
.tzx-stopped{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);border-radius:6px;align-self:flex-start;padding:0 6px;font-size:11px;line-height:18px}
    `

exports.inject = ['slots']

// ── 插件入口：样式注入 + 渲染器替换 + UI 中文化 ────────────────
exports.apply = function apply(ctx) {
  // Inject the shared stylesheet once (torn down with the fiber).
  ctx.effect(() => {
    if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') return () => {}
    const style = document.createElement('style')
    style.setAttribute('data-dsh-think-zh-expand', 'styles')
    style.textContent = STYLES
    document.head.appendChild(style)
    return () => {
      if (style.parentNode) style.parentNode.removeChild(style)
    }
  }, 'dsh-think-zh-expand: styles')

  // Replace the built-in assistant-step renderer: register with a lower
  // priority than the shipped occupant (0) so this entry wins the keyed
  // dispatch, exactly like dsh-better-sidebar shadows built-in seats.
  ctx.effect(
    () =>
      ctx.slots.inject('conversation.chat.node', () =>
        ctx.slots.register(
          {
            name: 'conversation.chat.node',
            key: 'assistant-step',
            priority: -1,
            registrant: 'dsh-think-zh-expand',
          },
          (props) => createElement(AssistantStepView, props),
        ),
      ),
    'dsh-think-zh-expand: assistant-step renderer',
  )

  // UI 标签中文化（词表替换，随 fiber 卸载断开观察器）。
  ctx.effect(() => installUiLocalize(), 'dsh-think-zh-expand: ui localization')
}
