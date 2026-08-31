// ── styles (DSH semantic tokens, injected on activate, removed on teardown) ──
// Mirrors the dsh-file-activity design language (issue #54): tight 2px 6px 8px
// body, 26px rows with hover fills, 24px circular icon buttons, two-line empty
// states, and motion on every state change. All colors ride the DSH semantic
// tokens (--dsw-alias-*), typography rides the font roles (--dsw-font-*).
const STYLES = `
.dsh-my-memory-root { display:flex; flex-direction:column; gap:8px; padding:2px 6px 8px;
  font:var(--dsw-font-s-14); color:var(--dsw-alias-label-primary); }
.dsh-my-memory-toolbar { display:flex; flex-direction:column; gap:4px; }
.dsh-my-memory-pathbar { display:flex; gap:6px; align-items:center; }
.dsh-my-memory-path-input { flex:1; min-width:0; height:28px; padding:0 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-primary); font:var(--dsw-font-s-14); }
.dsh-my-memory-path-input:focus { outline:none; border-color:var(--dsw-alias-accent); }
.dsh-my-memory-btn { display:inline-flex; align-items:center; gap:5px; flex:none; height:28px; padding:0 10px; border-radius:6px; cursor:pointer;
  border:1px solid var(--dsw-alias-border-l1); background:transparent; color:var(--dsw-alias-label-secondary);
  font:var(--dsw-font-xxs-12);
  transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out), border-color var(--ds-transition-duration-slow) var(--ds-ease-in-out); }
.dsh-my-memory-btn svg { display:block; flex:none; }
.dsh-my-memory-btn:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
.dsh-my-memory-btn:disabled { opacity:.4; cursor:default; }
.dsh-my-memory-iconbtn { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; padding:0;
  border:none; border-radius:50%; background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; flex:none;
  transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out); }
.dsh-my-memory-iconbtn svg { display:block; }
.dsh-my-memory-iconbtn:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
.dsh-my-memory-iconbtn:disabled { opacity:.4; cursor:default; }
.dsh-my-memory-iconbtn-danger:hover:not(:disabled) { color:var(--dsw-alias-state-error-primary); }
.dsh-my-memory-status { display:flex; align-items:center; gap:5px; font:var(--dsw-font-xxs-12); color:var(--dsw-alias-label-tertiary); }
.dsh-my-memory-status svg { display:block; flex:none; }
.dsh-my-memory-saved { color:var(--dsw-alias-state-success-primary); }
.dsh-my-memory-error { display:flex; align-items:center; gap:6px; font:var(--dsw-font-xxs-12);
  color:var(--dsw-alias-state-error-primary); white-space:pre-wrap; }
.dsh-my-memory-sections { display:flex; flex-direction:column; gap:8px; }
.dsh-my-memory-section { display:flex; flex-direction:column; gap:6px; padding:8px; border-radius:8px;
  border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-2); }
/* The project scope gets the brand accent so the two scopes never blur. */
.dsh-my-memory-section-project { border-color:color-mix(in srgb, var(--dsw-alias-accent) 45%, transparent);
  background:color-mix(in srgb, var(--dsw-alias-accent) 5%, transparent); }
.dsh-my-memory-section-head { display:flex; align-items:center; gap:8px; }
.dsh-my-memory-section-title { font:var(--dsw-font-s-strong-14); color:var(--dsw-alias-label-primary); }
.dsh-my-memory-badge { flex:none; display:inline-flex; align-items:center; height:17px; padding:0 5px; border-radius:4px;
  font:var(--dsw-font-xxxs-strong-11); color:var(--dsw-alias-accent);
  background:color-mix(in srgb, var(--dsw-alias-accent) 12%, transparent); }
.dsh-my-memory-note { font:var(--dsw-font-xxxs-11); color:var(--dsw-alias-label-tertiary); line-height:1.7; }
.dsh-my-memory-empty { padding:8px 6px; font:var(--dsw-font-xxs-12); color:var(--dsw-alias-label-tertiary); line-height:1.7; }
.dsh-my-memory-empty-icon { display:inline-flex; vertical-align:-3px; margin-right:6px; color:var(--dsw-alias-label-dimmed); }
.dsh-my-memory-empty-hint { display:block; margin-top:2px; color:var(--dsw-alias-label-dimmed); font:var(--dsw-font-xxxs-11); }
.dsh-my-memory-row { display:flex; flex-direction:column; gap:2px; box-sizing:border-box; width:100%; min-height:26px;
  margin:0; padding:4px 8px; border:none; background:transparent; border-radius:8px;
  animation:dsh-my-memory-row-in 150ms var(--ds-ease-in-out); }
.dsh-my-memory-row:hover { background:var(--dsw-alias-interactive-bg-hover); }
.dsh-my-memory-row-head { display:flex; align-items:center; gap:8px; }
.dsh-my-memory-desc { flex:1; min-width:0; font:var(--dsw-font-s-14); color:var(--dsw-alias-label-primary); word-break:break-word; }
.dsh-my-memory-meta { font:var(--dsw-font-xxxs-11); color:var(--dsw-alias-label-tertiary); }
.dsh-my-memory-actions { display:flex; align-items:center; gap:2px; flex:none; }
.dsh-my-memory-addbar { display:flex; gap:6px; align-items:center; }
.dsh-my-memory-add-input { flex:1; min-width:0; height:28px; padding:0 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-primary); font:var(--dsw-font-s-14); }
.dsh-my-memory-add-input:focus { outline:none; border-color:var(--dsw-alias-accent); }
.dsh-my-memory-btn-save { display:inline-flex; align-items:center; gap:5px; height:28px; padding:0 12px; border-radius:6px; cursor:pointer;
  border:1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary) 55%, transparent);
  background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent);
  color:var(--dsw-alias-state-success-primary); font:var(--dsw-font-xxs-12);
  transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out), border-color var(--ds-transition-duration-slow) var(--ds-ease-in-out); }
.dsh-my-memory-btn-save svg { display:block; flex:none; }
.dsh-my-memory-btn-save:hover:not(:disabled) { background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 18%, transparent); }
.dsh-my-memory-btn-save:disabled { opacity:.4; cursor:default; }
.dsh-my-memory-confirm { display:flex; flex-direction:column; gap:6px; padding:8px 10px; border-radius:8px;
  border:1px solid var(--dsw-alias-border-l1); animation:dsh-my-memory-row-in 150ms var(--ds-ease-in-out); }
.dsh-my-memory-confirm-save { border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 55%, transparent);
  background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 8%, transparent); }
.dsh-my-memory-confirm-delete { border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 60%, transparent);
  background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent); }
.dsh-my-memory-confirm-head { display:flex; align-items:center; gap:6px; }
.dsh-my-memory-confirm-head svg { display:block; flex:none; }
.dsh-my-memory-confirm-text { font:var(--dsw-font-xxs-12); color:var(--dsw-alias-label-primary); }
.dsh-my-memory-confirm-desc { font:var(--dsw-font-s-14); color:var(--dsw-alias-label-primary); word-break:break-word; }
.dsh-my-memory-confirm-actions { display:flex; gap:6px; align-items:center; }
.dsh-my-memory-confirm-ok { display:inline-flex; align-items:center; gap:5px; height:26px; padding:0 12px; border-radius:6px; cursor:pointer;
  font:var(--dsw-font-xxs-12);
  transition:filter var(--ds-transition-duration-slow) var(--ds-ease-in-out); }
.dsh-my-memory-confirm-ok svg { display:block; flex:none; }
.dsh-my-memory-confirm-ok-save { border:1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary) 60%, transparent);
  background:var(--dsw-alias-state-success-primary); color:var(--dsw-alias-label-primary-foreground); }
.dsh-my-memory-confirm-ok-delete { border:1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 60%, transparent);
  background:var(--dsw-alias-state-error-primary); color:var(--dsw-alias-label-primary-foreground); }
.dsh-my-memory-confirm-ok:hover { filter:brightness(1.1); }
.dsh-my-memory-confirm-cancel { display:inline-flex; align-items:center; gap:5px; height:26px; padding:0 12px; border-radius:6px; cursor:pointer;
  border:1px solid var(--dsw-alias-border-l1); background:transparent; color:var(--dsw-alias-label-secondary);
  font:var(--dsw-font-xxs-12);
  transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out); }
.dsh-my-memory-confirm-cancel svg { display:block; flex:none; }
.dsh-my-memory-confirm-cancel:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
@keyframes dsh-my-memory-row-in { from { opacity:0; transform:translateY(1px); } to { opacity:1; transform:none; } }
`.trim()

const STYLE_TAG = 'data-dsh-my-memory'
