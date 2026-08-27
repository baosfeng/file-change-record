    // ── styles (DSH semantic tokens, injected on activate, removed on teardown) ──
    const STYLES = `
.dsm-root { display:flex; flex-direction:column; gap:10px; padding:12px; }
.dsm-pathbar { display:flex; gap:6px; align-items:center; }
.dsm-path-input { flex:1; min-width:0; height:28px; padding:0 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-hairline-strong, rgba(128,128,128,.35));
  background:var(--dsw-alias-bg-input, transparent); color:var(--dsw-alias-label-primary, inherit);
  font:var(--dsw-font-sm-13, 13px/1.4 sans-serif); }
.dsm-btn { flex:none; height:28px; padding:0 10px; border-radius:6px; cursor:pointer;
  border:1px solid var(--dsw-alias-line-border-strong, rgba(128,128,128,.4));
  background:var(--dsw-alias-surface-hover, rgba(128,128,128,.12)); color:var(--dsw-alias-label-primary, inherit);
  font:var(--dsw-font-sm-13, 13px sans-serif); }
.dsm-btn:hover { background:var(--dsw-alias-surface-press, rgba(128,128,128,.2)); }
.dsm-note { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); }
.dsm-status { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); }
.dsm-saved { color:var(--dsw-alias-state-success-primary, #2e9e5b); }
.dsm-error { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-state-danger-primary, #d33); }
.dsm-section { display:flex; flex-direction:column; gap:2px; }
.dsm-section-title { font:var(--dsw-font-sm-strong-13, 600 13px sans-serif);
  color:var(--dsw-alias-label-primary, inherit); padding:6px 0 2px; }
.dsm-hint { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); padding-bottom:4px; }
.dsm-empty { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); padding:6px 0; }
.dsm-row { display:flex; flex-direction:column; gap:2px; padding:6px 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-line-border-soft, rgba(128,128,128,.18));
  background:var(--dsw-alias-surface, transparent); }
.dsm-row:hover { background:var(--dsw-alias-surface-hover, rgba(128,128,128,.08)); }
.dsm-row-disabled { opacity:.72; }
.dsm-row-head { display:flex; align-items:center; gap:8px; }
.dsm-name { font:var(--dsw-font-sm-strong-13, 13px sans-serif); color:var(--dsw-alias-label-primary, inherit);
  flex:none; max-width:45%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsm-src { flex:none; font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888);
  padding:1px 6px; border-radius:4px; background:var(--dsw-alias-surface-hover, rgba(128,128,128,.12)); }
.dsm-src-warn { color:var(--dsw-alias-state-warning-primary, #c90);
  border:1px solid color-mix(in srgb, var(--dsw-alias-state-warning-primary, #c90) 45%, transparent); }
.dsm-desc { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-secondary, #666); }
.dsm-toggle { flex:none; height:22px; padding:0 8px; border-radius:5px; cursor:pointer;
  border:1px solid var(--dsw-alias-line-border-strong, rgba(128,128,128,.4));
  background:transparent; color:var(--dsw-alias-label-secondary, #666);
  font:var(--dsw-font-xxxs-11, 11px sans-serif); }
.dsm-toggle:hover { background:var(--dsw-alias-surface-hover, rgba(128,128,128,.12)); }
.dsm-toggle-on { color:var(--dsw-alias-state-danger-primary, #d33);
  border-color:color-mix(in srgb, var(--dsw-alias-state-danger-primary, #d33) 45%, transparent); }
.dsm-toggle:disabled { opacity:.45; cursor:not-allowed; }
.dsm-diag-row { display:flex; align-items:center; gap:8px; padding:4px 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-line-border-soft, rgba(128,128,128,.18));
  background:var(--dsw-alias-surface, transparent); }
.dsm-diag-reason { flex:none; font:var(--dsw-font-xxxs-11, 11px sans-serif);
  color:var(--dsw-alias-state-warning-primary, #c90); }
.dsm-diag-path { flex:1; min-width:0; font:var(--dsw-font-xxxs-11, 11px sans-serif);
  color:var(--dsw-alias-label-tertiary, #888); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
`.trim()

    const STYLE_TAG = 'data-dsh-skill-manager'
