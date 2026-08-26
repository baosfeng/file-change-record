/**
 * dsh-guardian — client half (browser). SOURCE TEMPLATE.
 *
 * A dsh-better-sidebar tab ("插件守护 / Plugin Guardian") showing the staged
 * and promoted plugin entries managed by the server half:
 *  - per-entry status (running / pending / failed ×N / frozen),
 *  - the last error for failed entries (expandable),
 *  - actions: retry (unfreeze + remount), remove from the roster,
 *  - a safe-mode switch that unmounts everything the guardian mounted.
 *
 * Data source: GET/POST /guardian/api/* (server half), polled while the tab
 * is visible. Styling follows the better-sidebar design language: DSH
 * semantic tokens, flat surfaces, hairline borders.
 *
 * BUILD NOTE: this file is the SOURCE TEMPLATE. scripts/build.mjs splices the
 * `lib/parts/*.part.js` pieces into the PART placeholder markers below
 * (each piece is plain function-declaration text sharing this factory scope;
 * the browser ModuleLoader does not support relative-path require) and writes
 * lib/client.js — the file actually served by DSH, which MUST be committed
 * (CI runs node --check + tests against it, not against this template).
 */
window.__ModuleLoader__.load({
  id: 'bsfeng-dsh-guardian',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useEffect, useState } = require('react')

    const TAB_ID = 'dsh-guardian:panel'
    const POLL_MS = 5000

    // ── parts (injected by scripts/build.mjs; keep this exact order — the
    //    const initializers below run in splice order) ─────────────────────
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

        // ── i18n ──────────────────────────────────────────────────────────────
    function isZh() {
      try {
        return (navigator.language || 'en').toLowerCase().startsWith('zh')
      } catch {
        return false
      }
    }

    const strings = {
      title: () => (isZh() ? '插件守护' : 'Plugin Guardian'),
      safeMode: () => (isZh() ? '安全模式' : 'Safe mode'),
      safeModeDesc: () => (isZh() ? '开启后所有候选/已转正插件都不再加载，用于快速恢复环境' : 'Skips every staged/promoted plugin mount — fast recovery'),
      staged: () => (isZh() ? '候选' : 'staged'),
      promoted: () => (isZh() ? '转正' : 'promoted'),
      empty: () => (isZh() ? '暂无候选插件。新插件请写入 cordis.staged.json（与 cordis.patch.yml 同目录）' : 'No staged plugins. Add entries to cordis.staged.json next to cordis.patch.yml'),
      running: () => (isZh() ? '运行中' : 'running'),
      pending: () => (isZh() ? '待加载' : 'pending'),
      failed: () => (isZh() ? '失败' : 'failed'),
      frozen: () => (isZh() ? '冻结' : 'frozen'),
      retry: () => (isZh() ? '重试' : 'Retry'),
      remove: () => (isZh() ? '移除' : 'Remove'),
      loadError: () => (isZh() ? '加载失败' : 'Load failed'),
      loading: () => (isZh() ? '加载中…' : 'Loading…'),
      events: () => (isZh() ? '最近事件' : 'Recent events'),
    }

    // ── api ───────────────────────────────────────────────────────────────
    async function api(path, body) {
      const response = await fetch(`/guardian/api/${path}`, body === undefined
        ? { headers: { accept: 'application/json' } }
        : {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
      const payload = await response.json().catch(() => ({ ok: false, error: { message: 'bad response' } }))
      if (!payload.ok) throw new Error(payload.error?.message ?? 'request failed')
      return payload.value
    }

    function formatTime(time) {
      if (typeof time !== 'number' || !Number.isFinite(time)) return ''
      const date = new Date(time)
      const pad = (n) => String(n).padStart(2, '0')
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

    function statusLabel(status) {
      switch (status) {
        case 'running': return strings.running()
        case 'pending': return strings.pending()
        case 'failed': return strings.failed()
        case 'frozen': return strings.frozen()
        default: return status
      }
    }

        // ── row ────────────────────────────────────────────────────────────────
    function EntryRow({ entry, source, onAction }) {
      const [expanded, setExpanded] = useState(false)
      const hasError = typeof entry.lastError === 'string' && entry.lastError !== ''
      return createElement('div', { className: 'dsh-guardian-row' },
        createElement('div', { className: 'dsh-guardian-row-head' },
          createElement('span', { className: 'dsh-guardian-source' }, source === 'staged' ? strings.staged() : strings.promoted()),
          createElement('span', { className: 'dsh-guardian-name', title: entry.id }, entry.name),
          createElement('span', { className: `dsh-guardian-badge dsh-guardian-${entry.status}` }, statusLabel(entry.status)),
        ),
        createElement('div', { className: 'dsh-guardian-row-meta' },
          createElement('span', null, entry.id),
          entry.attempts > 0 ? createElement('span', { className: 'dsh-guardian-attempts' }, `×${entry.attempts}`) : null,
        ),
        hasError
          ? createElement('button', {
              className: 'dsh-guardian-link',
              onClick: () => setExpanded(!expanded),
            }, expanded ? '▾ 收起' : '▸ 错误详情')
          : null,
        expanded && hasError
          ? createElement('pre', { className: 'dsh-guardian-error' }, entry.lastError)
          : null,
        createElement('div', { className: 'dsh-guardian-actions' },
          entry.status === 'failed' || entry.status === 'frozen'
            ? createElement('button', {
                className: 'dsh-guardian-btn dsh-guardian-primary',
                onClick: () => onAction('retry', entry),
              }, strings.retry())
            : null,
          createElement('button', {
            className: 'dsh-guardian-btn',
            onClick: () => onAction('remove', entry),
          }, strings.remove()),
        ),
      )
    }

        // ── view ───────────────────────────────────────────────────────────────
    /** State + data loading + user actions for the panel. Polls /guardian/api
     *  while the tab is visible; actions re-fetch on success, flag the load
     *  error banner on failure. */
    function useGuardianState(visible) {
      const [state, setState] = useState({ safeMode: false, staged: [], promoted: [], events: [], loaded: false })
      const [loadFailed, setLoadFailed] = useState(false)

      const load = () => {
        api('state').then((value) => {
          setState({ ...value, loaded: true })
          setLoadFailed(false)
        }).catch(() => setLoadFailed(true))
      }

      useEffect(() => {
        load()
        if (visible === false) return
        const timer = window.setInterval(load, POLL_MS)
        return () => window.clearInterval(timer)
      }, [visible])

      const onAction = (kind, entry) => {
        const request = { id: entry.id }
        const path = kind === 'retry' ? 'retry' : 'remove'
        api(path, request).then(() => load()).catch(() => setLoadFailed(true))
      }

      const onSafeMode = (enabled) => {
        api('safemode', { enabled }).then(() => load()).catch(() => setLoadFailed(true))
      }

      return { state, loadFailed, onAction, onSafeMode }
    }

    /** Safe-mode switch header: checkbox + hint, wired to the host API. */
    function SafeModeBar({ safeMode, onSafeMode }) {
      return createElement('div', { className: 'dsh-guardian-safemode' },
        createElement('label', null,
          createElement('input', {
            type: 'checkbox',
            checked: safeMode === true,
            onChange: (event) => onSafeMode(event.target.checked),
          }),
          createElement('span', null, strings.safeMode()),
        ),
        createElement('div', { className: 'dsh-guardian-hint' }, strings.safeModeDesc()),
      )
    }

    /** Staged + promoted entries as rows; empty state when there are none. */
    function EntryList({ rows, onAction }) {
      if (rows.length === 0) {
        return createElement('div', { className: 'dsh-guardian-empty' }, strings.empty())
      }
      return createElement('div', { className: 'dsh-guardian-list' },
        rows.map(({ entry, source }) => createElement(EntryRow, {
          key: `${source}:${entry.id}`,
          entry,
          source,
          onAction,
        })),
      )
    }

    /** Recent guardian event log lines (time-stamped, one per entry). */
    function EventList({ events }) {
      if (events.length === 0) return null
      return createElement('div', { className: 'dsh-guardian-events' },
        createElement('div', { className: 'dsh-guardian-events-title' }, strings.events()),
        events.map((event, index) => createElement('div', {
          className: 'dsh-guardian-event',
          key: index,
          title: event.message,
        }, `${formatTime(event.time)} [${event.type}] ${event.message}`)),
      )
    }

    function GuardianView({ visible }) {
      const { state, loadFailed, onAction, onSafeMode } = useGuardianState(visible)

      if (!state.loaded && !loadFailed) {
        return createElement('div', { className: 'dsh-guardian-styles-placeholder' }, strings.loading())
      }

      const rows = [
        ...state.staged.map((entry) => ({ entry, source: 'staged' })),
        ...state.promoted.map((entry) => ({ entry, source: 'promoted' })),
      ]

      return createElement('div', { className: 'dsh-guardian-panel' },
        createElement(SafeModeBar, { safeMode: state.safeMode, onSafeMode }),
        loadFailed ? createElement('div', { className: 'dsh-guardian-error' }, strings.loadError()) : null,
        createElement(EntryList, { rows, onAction }),
        createElement(EventList, { events: state.events }),
      )
    }

        // ── plugin body ───────────────────────────────────────────────────────
    // 零第三方依赖：不 inject better-sidebar（那是第三方插件服务）。面板是
    // 可选增强——ctx.get('betterSidebar') 动态获取，服务不存在时静默跳过，
    // 核心治理能力（候选区/隔离/安全模式）纯 server 端，不受影响。
    exports.apply = function apply(ctx) {
      ctx.effect(() => {
        if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') return () => {}
        const style = document.createElement('style')
        style.setAttribute('data-dsh-guardian', 'styles')
        style.textContent = STYLES
        document.head.appendChild(style)
        return () => {
          if (style.parentNode) style.parentNode.removeChild(style)
        }
      }, 'dsh-guardian: styles')

      const service = ctx.get('betterSidebar')
      if (service === undefined) return

      ctx.effect(() => service.registerTab({
        id: TAB_ID,
        title: () => strings.title(),
        order: 80,
        single: true,
        component: ({ scope, visible }) => createElement(GuardianView, { sessionId: scope.sessionId, visible }),
      }), 'dsh-guardian: tab registration')
    }


    return module.exports
  },
})
