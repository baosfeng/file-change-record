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
// 视觉基线：与 DSH 官方 reasoning 渲染一致（浅灰缩进文本行、无卡片/无
// 徽章/无动画）；issue #54 的卡片化翻新（圆角/边框/背景、clock 图标、
// 「生成中」徽章、脉冲/入场动画）已按用户要求回退，仅保留类名前缀。
// issue #57 修复：思考正文经 MarkdownView 渲染后其根容器 .tzx-md 自带
// primary 色，覆盖思考块浅灰继承色导致区分不开；补 think-body 内的
// .tzx-md / 表格 / 公式颜色覆盖（见 STYLES 内注释）。
const STYLES = `
.dsh-think-zh-expand-assistant{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary);font-size:16px;line-height:28px}
.dsh-think-zh-expand-assistant-body{display:flex;flex-direction:column;gap:16px}
.dsh-think-zh-expand-think{display:flex;flex-direction:column;color:var(--dsw-alias-label-tertiary)}
.dsh-think-zh-expand-think-head{display:flex;align-items:center;gap:8px;min-width:0;cursor:pointer;user-select:none;padding:2px 0;border-radius:6px}
.dsh-think-zh-expand-think-head:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-think-zh-expand-think-chevron{flex:none;color:var(--dsw-alias-label-secondary);font-size:12px}
.dsh-think-zh-expand-think-title{flex:none;font-size:14px;font-weight:400;color:var(--dsw-alias-label-secondary)}
.dsh-think-zh-expand-think-summary{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;font-size:14px;line-height:24px;overflow:hidden}
.dsh-think-zh-expand-think-body{white-space:pre-wrap;word-break:break-word;padding:4px 0 4px 24px;font-size:14px;line-height:24px;color:var(--dsw-alias-label-tertiary)}
/* issue #57: MarkdownView 根容器自带 label-primary，覆盖思考块浅灰继承色；
   显式把思考块内的正文/表格/公式拉回浅灰，与正式回复（primary）一眼区分 */
.dsh-think-zh-expand-think-body .tzx-md{color:var(--dsw-alias-label-tertiary)}
.dsh-think-zh-expand-think-body .tzx-md .tzx-p{color:var(--dsw-alias-label-tertiary)}
.dsh-think-zh-expand-think-body .dsh-md-render-table{color:var(--dsw-alias-label-tertiary)}
.dsh-think-zh-expand-think-body .dsh-md-render-table th,.dsh-think-zh-expand-think-body .dsh-md-render-table td{border-color:var(--dsw-alias-border-l2)}
.dsh-think-zh-expand-think-body .dsh-md-render-math,.dsh-think-zh-expand-think-body .dsh-md-render-math-block{color:var(--dsw-alias-label-tertiary)}
.dsh-think-zh-expand-stopped{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);border-radius:6px;align-self:flex-start;padding:0 6px;font-size:11px;line-height:18px}
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
