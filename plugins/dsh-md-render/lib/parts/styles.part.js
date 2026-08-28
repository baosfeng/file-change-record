// ── 样式（DSH 语义 token，随 activation 注入）──────────────────
// 视觉基准：dsh-file-activity（issue #54 阶段 0 UI 规范）——线性图标、
// 语义 token 着色、hover/transition 反馈；适配对话内渲染场景。
// 前缀 dsh-md-render-（issue #54：与 dsh-mermaid-render 前缀分离，
// 消除跨插件类名冲突）；.tzx-md 系列为统一 MarkdownView 的输出样式
// （issue #31 从 dsh-think-zh-expand 迁移，对外契约类名 tzx-* /
// md-code-block 保持不动）。
const STYLES = `
.tzx-md{display:flex;flex-direction:column;gap:8px;min-width:0;font:var(--dsw-font-s-14);line-height:22px;color:var(--dsw-alias-label-primary)}
.tzx-md .tzx-p{margin:0}
.tzx-md h1,.tzx-md h2,.tzx-md h3,.tzx-md h4{margin:0;font-weight:600;line-height:1.35}
.tzx-md ul,.tzx-md ol{margin:0;padding-left:26px}
.tzx-md li{margin:2px 0}
.tzx-md .tzx-pre{margin:0;background:var(--dsw-alias-markdown-code-block);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:12px 16px;overflow:auto;font:var(--dsw-font-markdown-code-block-small);transition:border-color var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.tzx-md .tzx-pre:hover{border-color:var(--dsw-alias-border-l2)}
.tzx-md code{background:var(--dsw-alias-markdown-code-block);border-radius:4px;padding:0 4px;font:var(--dsw-font-markdown-code-block-small)}
.tzx-md .tzx-pre code{background:none;padding:0}
.tzx-md .tzx-bq{margin:0;padding:2px 0 2px 12px;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.tzx-md .tzx-bq p{margin:0}
.tzx-md .tzx-table{border-collapse:collapse;margin:0;font-size:14px;line-height:22px}
.tzx-md .tzx-table th,.tzx-md .tzx-table td{border:1px solid var(--dsw-alias-border-l1);padding:6px 12px}
.tzx-md .tzx-table th{background:var(--dsw-alias-markdown-code-block);font-weight:600}
.tzx-md .tzx-table tbody tr{transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.tzx-md .tzx-table tbody tr:hover{background:var(--dsw-alias-interactive-bg-hover)}
.tzx-md a{color:var(--dsw-alias-accent-primary)}
.dsh-md-render-math{font:var(--dsw-font-markdown-code-block-small);font-style:italic;color:var(--dsw-alias-label-primary)}
.dsh-md-render-math-block{margin:0;text-align:center;font:var(--dsw-font-markdown-code-block-small);font-style:italic;color:var(--dsw-alias-label-primary);padding:4px 0}
.dsh-md-render-math-error{display:inline-flex;align-items:center;gap:4px;font:var(--dsw-font-markdown-code-block-small);font-style:italic;color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);border-radius:4px;padding:0 4px}
.dsh-md-render-math-error svg{display:block;flex:none}
div.dsh-md-render-math-error{margin:0;text-align:center;justify-content:center;padding:4px 8px}
.dsh-md-render-table-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;margin:0;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);transition:border-color var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-md-render-table-scroll:hover{border-color:var(--dsw-alias-border-l2)}
.dsh-md-render-table{border-collapse:collapse;width:max-content;max-width:max-content;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.dsh-md-render-table th,.dsh-md-render-table td{padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);max-width:min(30vw,320px);min-width:100px}
.dsh-md-render-table th{text-align:start;font-weight:600;border-bottom:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-table-head)}
.dsh-md-render-table td{font:var(--dsw-font-markdown-table)}
.dsh-md-render-table tbody tr{transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-md-render-table tbody tr:nth-child(even){background:color-mix(in srgb, var(--dsw-alias-bg-layer-2) 40%, transparent)}
.dsh-md-render-table tbody tr:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-md-render-table code{font-size:13px}
.dsh-md-render-scroll-hint{display:flex;align-items:center;gap:4px;padding:2px 8px;font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}
.dsh-md-render-scroll-hint svg{display:block;flex:none}
.dsh-md-render-prefix,.dsh-md-render-suffix{margin:0}
`
