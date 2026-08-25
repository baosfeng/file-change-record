    // ── styles (DSH tokens; injected first, torn down with the fiber) ──
    const STYLES = `
.dmr-card{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:8px 12px;background:var(--dsw-alias-bg-layer-1);font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.dmr-card-head{display:flex;justify-content:flex-end}
.dmr-view-toggle{display:inline-flex;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:2px}
.dmr-vt{border:none;background:transparent;border-radius:6px;padding:2px 10px;cursor:pointer;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dmr-vt:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dmr-vt-active{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-weight:600}
.dmr-svg{overflow:auto;max-height:70vh}
.dmr-svg svg{max-width:100%;height:auto}
.dmr-code{margin:0;background:var(--dsw-alias-markdown-code-block);border-radius:8px;padding:8px 12px;overflow:auto;font:var(--dsw-font-markdown-code-block-small);white-space:pre-wrap}
.dmr-error{border-radius:8px;background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);padding:6px 10px}
.dmr-error-title{color:var(--dsw-alias-state-error-primary);font-weight:600}
.dmr-error-msg{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-all}
`
