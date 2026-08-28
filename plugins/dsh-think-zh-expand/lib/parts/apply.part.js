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
// issue #54 UI 翻新：类名统一 dsh-think-zh-expand- 前缀；思考块卡片化
// （圆角/边框/背景走语义 token），标题行折叠箭头 chevronRight 旋转过渡、
// 思考图标 clock 品牌色、流式「生成中」徽章脉冲动画、行入场动画。
const STYLES = `
.dsh-think-zh-expand-assistant{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary);font-size:16px;line-height:28px}
.dsh-think-zh-expand-assistant-body{display:flex;flex-direction:column;gap:16px}
.dsh-think-zh-expand-think{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;animation:dsh-think-zh-expand-row-in 150ms var(--ds-ease-in-out)}
.dsh-think-zh-expand-think[data-state='running']{border-color:color-mix(in srgb,var(--dsw-alias-accent) 35%,var(--dsw-alias-border-l1))}
.dsh-think-zh-expand-think-head{display:flex;align-items:center;gap:6px;min-width:0;cursor:pointer;user-select:none;padding:6px 10px;border-radius:8px;transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-think-zh-expand-think-head:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-think-zh-expand-think-head:active{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-think-zh-expand-think-head:focus-visible{outline:2px solid var(--dsw-alias-accent);outline-offset:-2px}
.dsh-think-zh-expand-think-chevron{flex:none;display:flex;align-items:center;color:var(--dsw-alias-label-tertiary);transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-think-zh-expand-think-chevron-open{transform:rotate(90deg)}
.dsh-think-zh-expand-think-icon{flex:none;display:flex;align-items:center;color:var(--dsw-alias-accent)}
.dsh-think-zh-expand-think-title{flex:none;font:var(--dsw-font-s-strong-14);color:var(--dsw-alias-label-secondary)}
.dsh-think-zh-expand-think-badge{flex:none;display:inline-flex;align-items:center;gap:4px;height:17px;padding:0 6px;border-radius:4px;font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-accent);background:color-mix(in srgb,var(--dsw-alias-accent) 12%,transparent)}
.dsh-think-zh-expand-think-badge::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;animation:dsh-think-zh-expand-pulse 1.2s var(--ds-ease-in-out) infinite}
.dsh-think-zh-expand-think-summary{min-width:0;flex:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary)}
.dsh-think-zh-expand-think-body{min-width:0;padding:2px 10px 10px;font-size:14px;line-height:24px;color:var(--dsw-alias-label-tertiary)}
.dsh-think-zh-expand-stopped{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);border-radius:6px;align-self:flex-start;padding:0 6px;font:var(--dsw-font-xxxs-11);line-height:18px}
@keyframes dsh-think-zh-expand-row-in{from{opacity:0;transform:translateY(1px)}to{opacity:1;transform:none}}
@keyframes dsh-think-zh-expand-pulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
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
