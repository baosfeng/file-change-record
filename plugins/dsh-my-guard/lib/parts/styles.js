// ── 样式（DSH 语义 token，随 activation 注入 / teardown 卸载）──────
const STYLES = `
.dso-panel{display:flex;flex-direction:column;gap:10px;padding:12px;color:var(--dsw-alias-label-primary)}
.dso-timeline{display:flex;flex-direction:column;gap:6px;max-height:calc(100vh - 320px);overflow-y:auto}
.dso-alert{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px}
.dso-alert-head{display:flex;align-items:center;gap:8px;justify-content:space-between}
.dso-badge{flex:none;font:var(--dsw-font-xxxs-strong-11);border-radius:4px;padding:1px 6px}
.dso-badge-danger{color:var(--dsw-alias-state-danger-primary);background:color-mix(in srgb, var(--dsw-alias-state-danger-primary) 14%, transparent)}
.dso-badge-warn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent)}
.dso-badge-info{color:var(--dsw-alias-state-info-primary);background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 14%, transparent)}
.dso-sev{flex:none;font:var(--dsw-font-xxxs-strong-11);border-radius:4px;padding:1px 6px}
.dso-sev-high{color:var(--dsw-alias-state-danger-primary);background:color-mix(in srgb, var(--dsw-alias-state-danger-primary) 10%, transparent)}
.dso-sev-medium{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent)}
.dso-sev-low{color:var(--dsw-alias-state-info-primary);background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 10%, transparent)}
.dso-time{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}
.dso-alert-msg{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);line-height:1.5;margin-top:4px;word-break:break-word}
.dso-alert-meta{font:var(--dsw-font-mono-xxs);font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.5;margin-top:2px;word-break:break-all}
.dso-alert-confirmed{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-state-success-primary);margin-top:4px}
.dso-empty{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center;padding:16px 8px;line-height:1.7}
.dso-section{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:8px}
.dso-section-title{font:var(--dsw-font-xs-strong-13);color:var(--dsw-alias-label-primary)}
.dso-repo-row{display:flex;gap:8px;align-items:center}
.dso-repo-input{flex:1}
.dso-input{flex:1;min-width:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 8px}
.dso-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.dso-textarea{min-height:52px;resize:vertical;font:var(--dsw-font-xxs-12)}
.dso-btn{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);
  border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 12px;cursor:pointer}
.dso-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dso-btn:disabled{opacity:.5;cursor:default}
.dso-btn-small{padding:2px 8px;font:var(--dsw-font-xxxs-strong-11);margin-top:4px}
.dso-btn-primary{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-interactive-primary);
  background:color-mix(in srgb, var(--dsw-alias-interactive-primary) 16%, transparent)}
.dso-feedback{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);word-break:break-all;line-height:1.5}
.dso-feedback-error{color:var(--dsw-alias-state-danger-primary)}
.dso-issue{display:flex;flex-direction:column;gap:2px;border-radius:6px;padding:6px 8px;font:var(--dsw-font-xxs-12)}
.dso-issue-high{background:color-mix(in srgb, var(--dsw-alias-state-danger-primary) 12%, transparent)}
.dso-issue-medium{background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent)}
.dso-issue-low{background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 10%, transparent)}
.dso-issue-sev{font:var(--dsw-font-xxxs-strong-11);text-transform:uppercase}
.dso-issue-high .dso-issue-sev{color:var(--dsw-alias-state-danger-primary)}
.dso-issue-medium .dso-issue-sev{color:var(--dsw-alias-state-warn-primary)}
.dso-issue-low .dso-issue-sev{color:var(--dsw-alias-state-info-primary)}
.dso-issue-rule{font:var(--dsw-font-mono-xxs);font-size:11px;color:var(--dsw-alias-label-secondary)}
.dso-issue-msg{color:var(--dsw-alias-label-primary);line-height:1.5}
`

function injectStyles() {
  if (typeof document === 'undefined' || typeof document.head === 'undefined') return () => {}
  const style = document.createElement('style')
  style.setAttribute('data-dsh-my-guard', 'styles')
  style.textContent = STYLES
  document.head.appendChild(style)
  return () => {
    if (style.parentNode !== null) style.parentNode.removeChild(style)
  }
}
