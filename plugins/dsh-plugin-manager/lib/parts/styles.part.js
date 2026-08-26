    // ── styles (DSH semantic tokens, injected on activate, removed on teardown) ──
    const STYLES = `
.dpm-root { display:flex; flex-direction:column; gap:10px; padding:12px; }
.dpm-hint { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); }
.dpm-status { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); }
.dpm-saved { color:var(--dsw-alias-state-success-primary, #2e9e5b); }
.dpm-error { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-state-danger-primary, #d33); }
.dpm-section { display:flex; flex-direction:column; gap:2px; }
.dpm-section-title { font:var(--dsw-font-sm-strong-13, 600 13px sans-serif);
  color:var(--dsw-alias-label-primary, inherit); padding:6px 0 2px; }
.dpm-row { display:flex; flex-direction:column; gap:2px; padding:6px 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-line-border-soft, rgba(128,128,128,.18));
  background:var(--dsw-alias-surface, transparent); }
.dpm-row:hover { background:var(--dsw-alias-surface-hover, rgba(128,128,128,.08)); }
.dpm-row-head { display:flex; align-items:center; gap:8px; }
.dpm-name { font:var(--dsw-font-sm-strong-13, 13px sans-serif); color:var(--dsw-alias-label-primary, inherit);
  flex:none; max-width:42%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dpm-ver { flex:none; font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888);
  padding:1px 6px; border-radius:4px; background:var(--dsw-alias-surface-hover, rgba(128,128,128,.12)); }
.dpm-state { flex:none; font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); }
.dpm-new { color:var(--dsw-alias-state-warn-primary, #c77); }
.dpm-desc { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-secondary, #666);
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.dpm-actions { display:flex; gap:6px; margin-top:4px; }
.dpm-btn { flex:none; height:24px; padding:0 10px; border-radius:5px; cursor:pointer;
  border:1px solid var(--dsw-alias-line-border-strong, rgba(128,128,128,.4));
  background:transparent; color:var(--dsw-alias-label-secondary, #666);
  font:var(--dsw-font-xxxs-11, 11px sans-serif); }
.dpm-btn:hover { background:var(--dsw-alias-surface-hover, rgba(128,128,128,.12)); }
.dpm-btn-danger { color:var(--dsw-alias-state-danger-primary, #d33);
  border-color:color-mix(in srgb, var(--dsw-alias-state-danger-primary, #d33) 45%, transparent); }
.dpm-btn-primary { color:var(--dsw-alias-accent, #4a7); }
.dpm-btn:disabled { opacity:.5; cursor:not-allowed; }
.dpm-searchbar { display:flex; gap:6px; align-items:center; }
.dpm-search-input { flex:1; min-width:0; height:28px; padding:0 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-hairline-strong, rgba(128,128,128,.35));
  background:var(--dsw-alias-bg-input, transparent); color:var(--dsw-alias-label-primary, inherit);
  font:var(--dsw-font-sm-13, 13px/1.4 sans-serif); }
.dpm-empty { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); padding:6px 0; }
`.trim()

    const STYLE_TAG = 'data-dsh-plugin-manager'
