    // ── 样式（DSH 语义 token，随 activation 注入）──────────────────
    // 表头/边框/对齐走 DSH token；滚动容器提供宽表格横向滚动
    // （overflow-x:auto，hover 时滚动条常显，避免遮挡内容）。
    const STYLES = `
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
