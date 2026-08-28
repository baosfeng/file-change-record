    // ── 样式（DSH 语义 token，随 activation 注入 / teardown 卸载）──────
    const STYLES = `
.dso-panel{display:flex;flex-direction:column;gap:10px;padding:12px;color:var(--dsw-alias-label-primary)}
.dso-toolbar{display:flex;flex-direction:column;gap:8px}
.dso-select{flex:1;min-width:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 8px}
.dso-input{flex:1;min-width:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 8px}
.dso-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.dso-repo-row{display:flex;gap:8px;align-items:center}
.dso-repo-input{flex:1}
.dso-filters{display:flex;gap:6px;flex-wrap:wrap}
.dso-chip{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);background:transparent;
  border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 10px;cursor:pointer}
.dso-chip-active{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-interactive-primary);
  background:color-mix(in srgb, var(--dsw-alias-interactive-primary) 12%, transparent)}
.dso-timeline{display:flex;flex-direction:column;gap:6px;max-height:calc(100vh - 240px);overflow-y:auto}
.dso-event{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px}
.dso-event-head{display:flex;align-items:center;gap:8px;justify-content:space-between}
.dso-badge{flex:none;font:var(--dsw-font-xxxs-strong-11);border-radius:4px;padding:1px 6px}
.dso-badge-status{color:var(--dsw-alias-state-info-primary);background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 14%, transparent)}
.dso-badge-llm{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent)}
.dso-badge-tool{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent)}
.dso-time{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}
.dso-event-meta{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);line-height:1.6;word-break:break-word;margin-top:2px}
.dso-empty{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center;padding:16px 8px;line-height:1.7}
.dso-status{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-secondary)}
.dso-actions{display:flex;gap:8px;flex-wrap:wrap}
.dso-btn{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);
  border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 12px;cursor:pointer}
.dso-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dso-btn:disabled{opacity:.5;cursor:default}
.dso-btn-primary{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-interactive-primary);
  background:color-mix(in srgb, var(--dsw-alias-interactive-primary) 16%, transparent)}
.dso-section{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:8px}
.dso-section-title{font:var(--dsw-font-xs-strong-13);color:var(--dsw-alias-label-primary)}
.dso-diff{max-height:240px;overflow:auto;font:var(--dsw-font-mono-xxs);font-size:11px;line-height:1.5;
  color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);
  border-radius:6px;padding:8px;white-space:pre-wrap;word-break:break-all}
.dso-form{display:flex;flex-direction:column;gap:6px}
.dso-type{flex:none;width:96px}
.dso-textarea{min-height:52px;resize:vertical;font:var(--dsw-font-xxs-12)}
.dso-feedback{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);word-break:break-all;line-height:1.5}
.dso-issue{display:flex;flex-direction:column;gap:2px;border-radius:6px;padding:6px 8px;font:var(--dsw-font-xxs-12)}
.dso-issue-error{background:color-mix(in srgb, var(--dsw-alias-state-danger-primary) 12%, transparent)}
.dso-issue-warning{background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent)}
.dso-issue-info{background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 10%, transparent)}
.dso-issue-sev{font:var(--dsw-font-xxxs-strong-11);text-transform:uppercase}
.dso-issue-error .dso-issue-sev{color:var(--dsw-alias-state-danger-primary)}
.dso-issue-warning .dso-issue-sev{color:var(--dsw-alias-state-warn-primary)}
.dso-issue-info .dso-issue-sev{color:var(--dsw-alias-state-info-primary)}
.dso-issue-rule{font:var(--dsw-font-mono-xxs);font-size:11px;color:var(--dsw-alias-label-secondary)}
.dso-issue-msg{color:var(--dsw-alias-label-primary);line-height:1.5}
.dso-review-ok{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-state-success-primary)}
.dso-ai{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);line-height:1.5;
  border:1px dashed var(--dsw-alias-border-l2);border-radius:6px;padding:6px 8px}
`

    function injectStyles() {
      if (typeof document === 'undefined' || typeof document.head === 'undefined') return () => {}
      const style = document.createElement('style')
      style.setAttribute('data-dsh-my-observability', 'styles')
      style.textContent = STYLES
      document.head.appendChild(style)
      return () => {
        if (style.parentNode !== null) style.parentNode.removeChild(style)
      }
    }
