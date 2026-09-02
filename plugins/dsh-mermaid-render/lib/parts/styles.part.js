// ── styles (DSH tokens; injected first, torn down with the fiber) ──
// 前缀 dsh-mermaid-render-（issue #54：与 dsh-md-render 的旧缩写前缀分离，
// 消除跨插件类名冲突）。视觉对齐 dsh-file-activity 设计语言：语义 token、
// 图标按钮/切换按钮 hover 填充 + 过渡、状态行旋转图标、卡片入场动画。
const STYLES = `
.dsh-mermaid-render-card{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:8px 12px;background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-shadow-lv2);font:var(--dsw-font-s-14);line-height:22px;color:var(--dsw-alias-label-primary);animation:dsh-mermaid-render-card-in 150ms var(--ds-ease-in-out)}
.dsh-mermaid-render-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dsh-mermaid-render-card-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.dsh-mermaid-render-export{display:inline-flex;gap:2px;flex:none}
.dsh-mermaid-render-eb{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l1);background:transparent;border-radius:6px;padding:2px 8px;cursor:pointer;font:var(--dsw-font-xxs-12);line-height:20px;color:var(--dsw-alias-label-secondary);transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-mermaid-render-eb svg{display:block;flex:none}
.dsh-mermaid-render-eb:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-mermaid-render-eb:disabled{opacity:.45;cursor:not-allowed}
.dsh-mermaid-render-notice{border-radius:6px;padding:4px 10px;font:var(--dsw-font-xxs-12);line-height:20px}
.dsh-mermaid-render-notice-ok{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent);color:var(--dsw-alias-state-success-primary)}
.dsh-mermaid-render-notice-error{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);color:var(--dsw-alias-state-error-primary)}
.dsh-mermaid-render-card-title{display:flex;align-items:center;gap:5px;font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-label-tertiary);text-transform:uppercase;letter-spacing:.04em}
.dsh-mermaid-render-card-title svg{display:block;flex:none}
.dsh-mermaid-render-view-toggle{display:inline-flex;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:2px;flex:none}
.dsh-mermaid-render-vt{display:inline-flex;align-items:center;gap:4px;border:none;background:transparent;border-radius:6px;padding:2px 8px;cursor:pointer;font:var(--dsw-font-xxs-12);line-height:20px;color:var(--dsw-alias-label-secondary);transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-mermaid-render-vt svg{display:block;flex:none}
.dsh-mermaid-render-vt:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-mermaid-render-vt-active{background:color-mix(in srgb, var(--dsw-alias-accent) 12%, transparent);color:var(--dsw-alias-accent);font-weight:600}
.dsh-mermaid-render-svg{overflow:auto;max-height:70vh}
.dsh-mermaid-render-svg svg{max-width:100%;height:auto}
.dsh-mermaid-render-code{margin:0;background:var(--dsw-alias-markdown-code-block);border-radius:6px;padding:8px 12px;overflow:auto;font:var(--dsw-font-markdown-code-block-small);white-space:pre-wrap}
.dsh-mermaid-render-loading{display:flex;align-items:center;gap:6px;padding:8px 6px;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary)}
.dsh-mermaid-render-loading svg{flex:none;animation:dsh-mermaid-render-spin 1s linear infinite}
.dsh-mermaid-render-error{border-radius:8px;background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);padding:8px 10px}
.dsh-mermaid-render-error-head{display:flex;align-items:center;gap:6px}
.dsh-mermaid-render-error-head svg{flex:none;color:var(--dsw-alias-state-error-primary)}
.dsh-mermaid-render-error-title{color:var(--dsw-alias-state-error-primary);font-weight:600}
.dsh-mermaid-render-error-msg{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-all;margin-top:4px;line-height:1.5}
@keyframes dsh-mermaid-render-card-in{from{opacity:0;transform:translateY(1px)}to{opacity:1;transform:none}}
@keyframes dsh-mermaid-render-spin{to{transform:rotate(360deg)}}
`
