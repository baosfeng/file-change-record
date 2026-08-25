    // ── styles ─────────────────────────────────────────────────────────────
    const STYLES = `
.dsh-guardian-panel { padding: 8px 10px; font-size: 12px; color: var(--dsw-alias-text-primary, #d6d6d6); display: flex; flex-direction: column; gap: 8px; }
.dsh-guardian-safemode { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border: 1px solid var(--dsw-alias-border, rgba(128,128,128,.3)); border-radius: 8px; background: var(--dsw-alias-bg-soft, rgba(128,128,128,.08)); }
.dsh-guardian-safemode label { display: flex; align-items: center; gap: 6px; font-weight: 600; cursor: pointer; }
.dsh-guardian-hint { color: var(--dsw-alias-text-secondary, #9a9a9a); font-size: 11px; }
.dsh-guardian-list { display: flex; flex-direction: column; gap: 6px; }
.dsh-guardian-row { border: 1px solid var(--dsw-alias-border, rgba(128,128,128,.25)); border-radius: 8px; padding: 6px 8px; background: var(--dsw-alias-bg, transparent); }
.dsh-guardian-row-head { display: flex; align-items: center; gap: 6px; }
.dsh-guardian-source { font-size: 10px; color: var(--dsw-alias-text-secondary, #9a9a9a); border: 1px solid currentColor; border-radius: 4px; padding: 0 4px; }
.dsh-guardian-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-guardian-badge { margin-left: auto; font-size: 10px; padding: 1px 6px; border-radius: 999px; white-space: nowrap; }
.dsh-guardian-running { background: rgba(52, 211, 153, .15); color: #34d399; }
.dsh-guardian-pending { background: rgba(250, 204, 21, .15); color: #facc15; }
.dsh-guardian-failed { background: rgba(248, 113, 113, .15); color: #f87171; }
.dsh-guardian-frozen { background: rgba(148, 163, 184, .2); color: #94a3b8; }
.dsh-guardian-row-meta { display: flex; gap: 6px; margin-top: 2px; color: var(--dsw-alias-text-secondary, #9a9a9a); font-size: 11px; }
.dsh-guardian-attempts { color: #f87171; }
.dsh-guardian-error { white-space: pre-wrap; word-break: break-all; font-family: var(--dsw-font-mono, monospace); font-size: 11px; margin: 4px 0 0; padding: 4px 6px; border-radius: 6px; background: rgba(248, 113, 113, .08); color: #f87171; max-height: 120px; overflow: auto; }
.dsh-guardian-actions { display: flex; gap: 6px; margin-top: 6px; }
.dsh-guardian-btn { font-size: 11px; padding: 2px 10px; border-radius: 6px; border: 1px solid var(--dsw-alias-border, rgba(128,128,128,.4)); background: transparent; color: var(--dsw-alias-text-primary, #d6d6d6); cursor: pointer; }
.dsh-guardian-btn:hover { background: var(--dsw-alias-bg-soft, rgba(128,128,128,.12)); }
.dsh-guardian-primary { border-color: #34d399; color: #34d399; }
.dsh-guardian-empty { color: var(--dsw-alias-text-secondary, #9a9a9a); padding: 12px 4px; }
.dsh-guardian-events { border-top: 1px solid var(--dsw-alias-border, rgba(128,128,128,.25)); padding-top: 6px; display: flex; flex-direction: column; gap: 2px; }
.dsh-guardian-events-title { font-weight: 600; font-size: 11px; color: var(--dsw-alias-text-secondary, #9a9a9a); }
.dsh-guardian-event { font-size: 10px; color: var(--dsw-alias-text-secondary, #9a9a9a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`
