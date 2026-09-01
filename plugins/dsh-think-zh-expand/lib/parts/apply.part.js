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
// 视觉基线（issue #73 用户要求）：与 DSH 官方 ReasoningRow 完全一致——
// 头部 DisclosureRow 结构（leading 图标区 + 标题 + separator + 摘要），
// 正文 thinkBody 样式（tertiary 色、22px 缩进、14px/24px）；issue #54 的
// 卡片化翻新（圆角/边框/背景、clock 图标、「生成中」徽章、脉冲/入场动画）
// 已按用户要求回退，仅保留类名前缀。issue #57 的思考正文浅灰覆盖规则
// （.tzx-md / 表格 / 公式拉回 label-tertiary）已按用户要求移除：思考正文
// 经 MarkdownView 渲染后颜色跟随其官方默认（与正式回复一致的 primary）。
const STYLES = `
.dsh-think-zh-expand-assistant{display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);font-size:16px;line-height:28px}
.dsh-think-zh-expand-assistant-body{display:flex;flex-direction:column;gap:16px}
.dsh-think-zh-expand-think{display:flex;flex-direction:column;width:100%;min-width:0}
.dsh-think-zh-expand-think-head{position:relative;overflow:hidden;display:flex;align-items:center;height:24px;min-width:0;cursor:pointer;user-select:none}
.dsh-think-zh-expand-think-leading{position:relative;flex:none;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;margin-right:6px;padding:0;border:none;background:none;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.dsh-think-zh-expand-think-icon{display:inline-flex;opacity:1;transition:opacity .1s ease}
.dsh-think-zh-expand-think-head:hover .dsh-think-zh-expand-think-icon{opacity:0}
.dsh-think-zh-expand-think-chevron{display:inline-flex;color:var(--dsw-alias-label-secondary)}
.dsh-think-zh-expand-think-chevron-hover{position:absolute;top:0;right:0;bottom:0;left:0;margin:auto;opacity:0;transition:opacity .1s ease}
.dsh-think-zh-expand-think-head:hover .dsh-think-zh-expand-think-chevron-hover{opacity:1}
.dsh-think-zh-expand-think-title{flex:none;font-size:14px;line-height:24px;color:var(--dsw-alias-label-secondary)}
.dsh-think-zh-expand-think-separator{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}
.dsh-think-zh-expand-think-summary{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;font-size:14px;line-height:24px;overflow:hidden}
.dsh-think-zh-expand-think-body{white-space:pre-wrap;word-break:break-word;padding:4px 0 4px 22px;font-size:14px;line-height:24px;color:var(--dsw-alias-label-tertiary)}
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
