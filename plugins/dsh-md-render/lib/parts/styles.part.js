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
.dsh-md-render-table th{cursor:pointer;user-select:none}
.dsh-md-render-sort-arrow{display:inline-block;margin-left:4px;font-size:12px;line-height:1;color:var(--dsw-alias-label-tertiary);transition:color var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-md-render-table th[data-sorted] .dsh-md-render-sort-arrow{color:var(--dsw-alias-accent-primary)}
.dsh-md-render-table tr.dsh-md-render-folded-row{display:none}
.dsh-md-render-table-fold{display:block;margin:8px auto 0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);padding:4px 12px;cursor:pointer;transition:border-color var(--ds-transition-duration-slow) var(--ds-ease-in-out),color var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-md-render-table-fold:hover{border-color:var(--dsw-alias-accent-primary);color:var(--dsw-alias-accent-primary)}
.dsh-md-render-scroll-hint{display:flex;align-items:center;gap:4px;padding:2px 8px;font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}
.dsh-md-render-scroll-hint svg{display:block;flex:none}
.dsh-md-render-prefix,.dsh-md-render-suffix{margin:0}
/* ── 复制按钮（issue #74）：代码块 / 整段内容右下角一键复制 ──
   绝对定位右下角、hover 才显示（不干扰阅读）；DSH 语义 token 深浅
   主题自适应；流式渲染中（[data-streaming] 祖先）隐藏，避免复制到
   半截内容。 */
.md-code-block{position:relative}
.tzx-md{position:relative}
.dsh-md-render-copy{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;font:var(--dsw-font-xxxs-11);line-height:20px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;cursor:pointer;opacity:0;transition:opacity var(--ds-transition-duration-slow) var(--ds-ease-in-out),color var(--ds-transition-duration-slow) var(--ds-ease-in-out),border-color var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-md-render-code-head>.dsh-md-render-copy{margin-left:auto}
.tzx-md>.dsh-md-render-copy{position:absolute;right:8px;bottom:8px}
.md-code-block:hover .dsh-md-render-copy,.tzx-md:hover>.dsh-md-render-copy{opacity:1}
.dsh-md-render-copy:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.dsh-md-render-copy-done{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
[data-streaming] .dsh-md-render-copy{display:none}
/* ── 代码块增强（issue #80）：头部语言标签 + 行号 + 语法高亮 ──
   header 行与复制按钮（#74）同排；行号用 CSS counter 伪元素（不污染
   pre/code 文本内容，mermaid/复制读取原文本不受影响）；token 类走
   固定色板 + prefers-color-scheme 深浅两套，随 activation 注入/卸载。 */
.dsh-md-render-code-head{display:flex;align-items:center;gap:8px;padding:4px 8px;font:var(--dsw-font-xxxs-11);line-height:20px;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 55%,transparent);border:1px solid var(--dsw-alias-border-l1);border-bottom:none;border-radius:8px 8px 0 0}
.dsh-md-render-code-lang{text-transform:lowercase;letter-spacing:.02em;user-select:none}
.md-code-block .tzx-pre{border-top:none;border-radius:0 0 8px 8px}
.tzx-md .tzx-pre code{display:block;white-space:normal;counter-reset:dsh-md-render-line}
.dsh-md-render-code-line{display:block;white-space:pre;position:relative;padding-left:3.5em;counter-increment:dsh-md-render-line}
.dsh-md-render-code-line::before{content:counter(dsh-md-render-line);position:absolute;left:0;width:3em;text-align:right;color:var(--dsw-alias-label-tertiary);user-select:none}
.md-code-block{--dsh-md-render-c-kw:#7c3aed;--dsh-md-render-c-str:#16a34a;--dsh-md-render-c-com:#94a3b8;--dsh-md-render-c-num:#dc2626;--dsh-md-render-c-fn:#2563eb}
.dsh-md-render-tok-keyword{color:var(--dsh-md-render-c-kw)}
.dsh-md-render-tok-string{color:var(--dsh-md-render-c-str)}
.dsh-md-render-tok-comment{color:var(--dsh-md-render-c-com);font-style:italic}
.dsh-md-render-tok-number{color:var(--dsh-md-render-c-num)}
.dsh-md-render-tok-function{color:var(--dsh-md-render-c-fn)}
@media (prefers-color-scheme:dark){.md-code-block{--dsh-md-render-c-kw:#c4b5fd;--dsh-md-render-c-str:#86efac;--dsh-md-render-c-com:#64748b;--dsh-md-render-c-num:#f87171;--dsh-md-render-c-fn:#93c5fd}}
/* ── 语法补全（issue #81）：任务列表 / 删除线 / 图片 ──
   任务列表：checkbox 与文本同排、状态色走 accent；删除线 <del>
   line-through 弱化次级字色；图片块级自适应、失败占位。 */
.tzx-md del,.dsh-md-render-del{text-decoration:line-through;color:var(--dsw-alias-label-secondary)}
.dsh-md-render-task-checkbox{width:14px;height:14px;margin:0 6px 0 0;vertical-align:-2px;accent-color:var(--dsw-alias-accent-primary);cursor:pointer;flex:none}
.dsh-md-render-img{display:block;max-width:100%;max-height:40vh;margin:4px 0;border-radius:8px;object-fit:contain}
.dsh-md-render-img-fallback{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px dashed var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12)}
`
