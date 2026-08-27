    // ── 样式（DSH 语义 token，随 activation 注入）──────────────────
    // 表头/边框/对齐走 DSH token；滚动容器提供宽表格横向滚动
    // （overflow-x:auto，hover 时滚动条常显，避免遮挡内容）。
    // .tzx-md 系列为统一 MarkdownView 的输出样式（issue #31 从
    // dsh-think-zh-expand 迁移）；.dmr-math 为公式渲染样式。
    const STYLES = `
.tzx-md{display:flex;flex-direction:column;gap:8px;min-width:0}
.tzx-md .tzx-p{margin:0}
.tzx-md h1,.tzx-md h2,.tzx-md h3,.tzx-md h4{margin:0;font-weight:600;line-height:1.35}
.tzx-md ul,.tzx-md ol{margin:0;padding-left:26px}
.tzx-md li{margin:2px 0}
.tzx-md .tzx-pre{margin:0;background:var(--dsw-alias-markdown-code-block);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px 16px;overflow:auto;font:var(--dsw-font-markdown-code-block-small)}
.tzx-md code{background:var(--dsw-alias-markdown-code-block);border-radius:4px;padding:0 4px;font:var(--dsw-font-markdown-code-block-small)}
.tzx-md .tzx-pre code{background:none;padding:0}
.tzx-md .tzx-bq{margin:0;padding-left:12px;border-left:3px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
.tzx-md .tzx-bq p{margin:0}
.tzx-md .tzx-table{border-collapse:collapse;margin:0;font-size:14px;line-height:22px}
.tzx-md .tzx-table th,.tzx-md .tzx-table td{border:1px solid var(--dsw-alias-border-l1);padding:4px 10px}
.tzx-md .tzx-table th{background:var(--dsw-alias-markdown-code-block);font-weight:600}
.tzx-md a{color:var(--dsw-alias-accent-primary)}
.dmr-math{font:var(--dsw-font-markdown-code-block-small);font-style:italic;color:var(--dsw-alias-label-primary)}
.dmr-math-block{margin:0;text-align:center;font:var(--dsw-font-markdown-code-block-small);font-style:italic;color:var(--dsw-alias-label-primary);padding:4px 0}
.dmr-table-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;margin:0}
.dmr-table{border-collapse:collapse;width:max-content;max-width:max-content;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.dmr-table th,.dmr-table td{padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);max-width:min(30vw,320px);min-width:100px}
.dmr-table th{text-align:start;font-weight:600;border-bottom:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-table-head)}
.dmr-table td{font:var(--dsw-font-markdown-table)}
.dmr-table th:first-child,.dmr-table td:first-child{padding-left:0}
.dmr-table td:last-child{padding-right:0}
.dmr-table code{font-size:13px}
.dmr-prefix,.dmr-suffix{margin:0}
`
