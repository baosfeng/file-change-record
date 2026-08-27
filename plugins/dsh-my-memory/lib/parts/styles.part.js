    // ── styles (DSH semantic tokens, injected on activate, removed on teardown) ──
    const STYLES = `
.dmm-root { display:flex; flex-direction:column; gap:12px; padding:12px; }
.dmm-pathbar { display:flex; gap:6px; align-items:center; }
.dmm-path-input { flex:1; min-width:0; height:28px; padding:0 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-hairline-strong, rgba(128,128,128,.35));
  background:var(--dsw-alias-bg-input, transparent); color:var(--dsw-alias-label-primary, inherit);
  font:var(--dsw-font-sm-13, 13px/1.4 sans-serif); }
.dmm-btn { flex:none; height:28px; padding:0 10px; border-radius:6px; cursor:pointer;
  border:1px solid var(--dsw-alias-line-border-strong, rgba(128,128,128,.4));
  background:var(--dsw-alias-surface-hover, rgba(128,128,128,.12)); color:var(--dsw-alias-label-primary, inherit);
  font:var(--dsw-font-sm-13, 13px sans-serif); }
.dmm-btn:hover { background:var(--dsw-alias-surface-press, rgba(128,128,128,.2)); }
.dmm-btn:disabled { opacity:.45; cursor:not-allowed; }
.dmm-status { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); }
.dmm-saved { color:var(--dsw-alias-state-success-primary, #2e9e5b); }
.dmm-error { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-state-danger-primary, #d33); }
.dmm-sections { display:flex; flex-direction:column; gap:12px; }
.dmm-section { display:flex; flex-direction:column; gap:6px; padding:10px; border-radius:8px;
  border:1px solid var(--dsw-alias-line-border-soft, rgba(128,128,128,.18));
  background:var(--dsw-alias-surface, transparent); }
.dmm-section-project { border-color:color-mix(in srgb, var(--dsw-alias-state-info-primary, #3a7bd5) 45%, transparent);
  background:color-mix(in srgb, var(--dsw-alias-state-info-primary, #3a7bd5) 5%, transparent); }
.dmm-section-head { display:flex; align-items:center; gap:8px; }
.dmm-section-title { font:var(--dsw-font-sm-strong-13, 600 13px sans-serif);
  color:var(--dsw-alias-label-primary, inherit); }
.dmm-badge { flex:none; font:var(--dsw-font-xxxs-11, 11px sans-serif); padding:1px 6px; border-radius:4px;
  color:var(--dsw-alias-state-info-primary, #3a7bd5);
  border:1px solid color-mix(in srgb, var(--dsw-alias-state-info-primary, #3a7bd5) 45%, transparent);
  background:var(--dsw-alias-surface-hover, rgba(128,128,128,.12)); }
.dmm-note { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); }
.dmm-empty { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); padding:4px 0; }
.dmm-row { display:flex; flex-direction:column; gap:4px; padding:6px 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-line-border-soft, rgba(128,128,128,.18));
  background:var(--dsw-alias-surface, transparent); }
.dmm-row-head { display:flex; align-items:center; gap:8px; }
.dmm-desc { flex:1; min-width:0; font:var(--dsw-font-sm-13, 13px sans-serif);
  color:var(--dsw-alias-label-primary, inherit); word-break:break-word; }
.dmm-meta { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-tertiary, #888); }
.dmm-actions { display:flex; align-items:center; gap:6px; flex:none; }
.dmm-btn-edit { height:24px; padding:0 8px; border-radius:5px; cursor:pointer;
  border:1px solid var(--dsw-alias-line-border-strong, rgba(128,128,128,.4));
  background:transparent; color:var(--dsw-alias-label-secondary, #666);
  font:var(--dsw-font-xxxs-11, 11px sans-serif); }
.dmm-btn-edit:hover { background:var(--dsw-alias-surface-hover, rgba(128,128,128,.12)); }
.dmm-btn-danger { height:24px; padding:0 8px; border-radius:5px; cursor:pointer;
  border:1px solid color-mix(in srgb, var(--dsw-alias-state-danger-primary, #d33) 55%, transparent);
  background:transparent; color:var(--dsw-alias-state-danger-primary, #d33);
  font:var(--dsw-font-xxxs-11, 11px sans-serif); }
.dmm-btn-danger:hover { background:color-mix(in srgb, var(--dsw-alias-state-danger-primary, #d33) 12%, transparent); }
.dmm-addbar { display:flex; gap:6px; align-items:center; }
.dmm-add-input { flex:1; min-width:0; height:28px; padding:0 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-hairline-strong, rgba(128,128,128,.35));
  background:var(--dsw-alias-bg-input, transparent); color:var(--dsw-alias-label-primary, inherit);
  font:var(--dsw-font-sm-13, 13px/1.4 sans-serif); }
.dmm-btn-save { height:28px; padding:0 14px; border-radius:6px; cursor:pointer;
  border:1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary, #2e9e5b) 55%, transparent);
  background:color-mix(in srgb, var(--dsw-alias-state-success-primary, #2e9e5b) 10%, transparent);
  color:var(--dsw-alias-state-success-primary, #2e9e5b); font:var(--dsw-font-xxxs-11, 11px sans-serif); }
.dmm-btn-save:hover { background:color-mix(in srgb, var(--dsw-alias-state-success-primary, #2e9e5b) 18%, transparent); }
.dmm-confirm { display:flex; flex-direction:column; gap:6px; padding:8px 10px; border-radius:6px;
  border:1px solid var(--dsw-alias-line-border-strong, rgba(128,128,128,.4)); }
.dmm-confirm-save { border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary, #2e9e5b) 55%, transparent);
  background:color-mix(in srgb, var(--dsw-alias-state-success-primary, #2e9e5b) 8%, transparent); }
.dmm-confirm-delete { border-color:color-mix(in srgb, var(--dsw-alias-state-danger-primary, #d33) 60%, transparent);
  background:color-mix(in srgb, var(--dsw-alias-state-danger-primary, #d33) 10%, transparent); }
.dmm-confirm-text { font:var(--dsw-font-xxxs-11, 11px sans-serif); color:var(--dsw-alias-label-primary, inherit); }
.dmm-confirm-desc { font:var(--dsw-font-sm-13, 13px sans-serif); color:var(--dsw-alias-label-primary, inherit);
  word-break:break-word; }
.dmm-confirm-actions { display:flex; gap:6px; align-items:center; }
.dmm-confirm-ok { height:26px; padding:0 12px; border-radius:5px; cursor:pointer;
  font:var(--dsw-font-xxxs-11, 11px sans-serif); }
.dmm-confirm-ok-save { border:1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary, #2e9e5b) 60%, transparent);
  background:var(--dsw-alias-state-success-primary, #2e9e5b); color:#fff; }
.dmm-confirm-ok-delete { border:1px solid color-mix(in srgb, var(--dsw-alias-state-danger-primary, #d33) 60%, transparent);
  background:var(--dsw-alias-state-danger-primary, #d33); color:#fff; }
.dmm-confirm-ok:hover { filter:brightness(1.1); }
.dmm-confirm-cancel { height:26px; padding:0 12px; border-radius:5px; cursor:pointer;
  border:1px solid var(--dsw-alias-line-border-strong, rgba(128,128,128,.4));
  background:transparent; color:var(--dsw-alias-label-secondary, #666);
  font:var(--dsw-font-xxxs-11, 11px sans-serif); }
`.trim()

    const STYLE_TAG = 'data-dsh-my-memory'
