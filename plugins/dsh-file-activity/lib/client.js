/**
 * dsh-file-activity — client half (browser).
 *
 * Extends dsh-better-sidebar with a "文件活动 / File Activity" tab:
 *  - recent file access history (agent + sidebar operations),
 *  - per-file create/modify/read counts flattened by folder, with multi-level
 *    folders shown as dotted paths (a.b.c.d) and their files indented below,
 *  - clicking any file opens a FLOATING preview that reuses the sidebar's
 *    NATIVE viewer via `ctx.betterSidebar.matchFileViewer(path)` — its own
 *    `component` is mounted (built-in markdown / code / image / pdf / html
 *    renderers), so code gets syntax highlighting and markdown gets rendered
 *    with no hand-rolled preview; clicking outside / Esc / × closes it,
 *  - auto-opens once per session by default (toggleable in the sidebar
 *    settings, enabled by default).
 *
 * Data source: the plugin host half (fs/observed for agent tools) + this
 * half's fetch interception for sidebar file operations (fs.read / fs.write /
 * /sidebar/file media opens), both persisted host-side; the tab polls
 * /file-activity/api/stats.
 *
 * Styling follows the dsh-better-sidebar design language: all colors ride the
 * DSH semantic tokens (--dsw-alias-*), typography rides the font roles
 * (--dsw-font-*), motion rides --ds-*. Flat surfaces (no box-shadow), hairline
 * borders, 28px circular icon controls with hover fills, and 8px-radius rows
 * with hover fills. The stylesheet is injected once per activation and torn
 * down with the fiber, so HMR/disable leaves no residue.
 */
window.__ModuleLoader__.load({
  id: 'dsh-file-activity',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useEffect, useMemo, useState, useSyncExternalStore } = require('react')

    const TAB_ID = 'file-activity:recent'
    const AUTO_OPEN_KEY = 'dsh-file-activity:auto-opened:'
    const POLL_MS = 6000

    // ── i18n ──────────────────────────────────────────────────────────────
    function isZh() {
      try {
        const lang = (navigator.language || 'en').toLowerCase()
        return lang.startsWith('zh')
      } catch {
        return false
      }
    }

    const strings = {
      title: () => (isZh() ? '文件活动' : 'File Activity'),
      recent: () => (isZh() ? '最近访问' : 'Recent'),
      stats: () => (isZh() ? '文件统计' : 'File Stats'),
      empty: () => (isZh() ? '暂无文件活动记录' : 'No file activity yet'),
      emptyHint: () => (isZh()
        ? '在侧边栏打开文件、编辑保存，或让 agent 读写文件（创建/读取/修改），都会记录在这里。点击任意文件将在侧边栏内用原生预览打开（代码高亮 / Markdown 渲染 / 图片 / PDF…）。'
        : 'Opening files in the sidebar, editing, or agent file operations (create/read/modify) are recorded here. Click any file to open it in the sidebar with native preview (syntax highlighting / Markdown rendering / images / PDF…).'),
      refresh: () => (isZh() ? '刷新' : 'Refresh'),
      clear: () => (isZh() ? '清空' : 'Clear'),
      clearConfirm: () => (isZh() ? '确定清空当前会话的全部文件活动记录？' : 'Clear all file activity for this session?'),
      read: () => (isZh() ? '读取' : 'read'),
      create: () => (isZh() ? '新增' : 'create'),
      modify: () => (isZh() ? '修改' : 'modify'),
      readShort: () => (isZh() ? '读' : 'R'),
      createShort: () => (isZh() ? '增' : 'C'),
      modifyShort: () => (isZh() ? '改' : 'M'),
      loadError: () => (isZh() ? '加载失败' : 'Load failed'),
      created: () => (isZh() ? '创建' : 'Created'),
      lastSeen: () => (isZh() ? '最近访问' : 'Last seen'),
      justNow: () => (isZh() ? '刚刚' : 'just now'),
      minutesAgo: (m) => (isZh() ? `${m} 分钟前` : `${m}m ago`),
      hoursAgo: (h) => (isZh() ? `${h} 小时前` : `${h}h ago`),
      daysAgo: (d) => (isZh() ? `${d} 天前` : `${d}d ago`),
      closePreview: () => (isZh() ? '关闭预览' : 'Close preview'),
      loading: () => (isZh() ? '加载中…' : 'Loading…'),
      previewUnsupported: () => (isZh() ? '该文件类型暂不支持预览' : 'This file type cannot be previewed yet'),
      previewFailed: () => (isZh() ? '预览加载失败' : 'Preview failed to load'),
      downloadToView: () => (isZh() ? '下载查看' : 'download to view'),
    }

    // ── path helpers ──────────────────────────────────────────────────────
    function basenameOf(path) {
      const norm = path.split('\\').join('/')
      const idx = norm.lastIndexOf('/')
      return idx === -1 ? norm : norm.slice(idx + 1)
    }

    /** Compact relative time: 刚刚 / N 分钟前 / N 小时前 / N 天前 / MM/DD. */
    function formatRelative(time) {
      if (typeof time !== 'number' || !Number.isFinite(time)) return ''
      const diff = Date.now() - time
      if (diff < 30_000) return strings.justNow()
      const minutes = Math.floor(diff / 60_000)
      if (minutes < 60) return strings.minutesAgo(minutes)
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return strings.hoursAgo(hours)
      const days = Math.floor(hours / 24)
      if (days < 7) return strings.daysAgo(days)
      const date = new Date(time)
      return `${date.getMonth() + 1}/${date.getDate()}`
    }

    /** Local wall-clock HH:MM:SS (used in tooltips; full precision). */
    function formatTime(time) {
      const date = new Date(time)
      const pad = (n) => String(n).padStart(2, '0')
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

    /**
     * Collapse chain directories: a directory whose only child is another
     * directory merges into it (a → a.b → a.b.c …). Deep single-child paths
     * render as one dotted label with the file(s) directly beneath.
     * `root` itself is never collapsed (its name is '' and would drop the
     * top-level directory).
     */
    function compressChains(node, isRoot) {
      for (const child of node.children) {
        if (child.type === 'dir') compressChains(child, false)
      }
      if (isRoot) return
      while (node.children.length === 1 && node.children[0].type === 'dir') {
        const only = node.children[0]
        node.name = `${node.name}.${only.name}`
        node.children = only.children
        node.compressed = true
      }
    }

    /**
     * Build a nested directory tree from per-file counts, keyed by the file's
     * absolute path. Every directory node aggregates its subtree counters and
     * sorts directories first (alphabetically), then files (by activity).
     */
    function buildTree(counts) {
      const root = { type: 'dir', name: '', path: '', children: [], read: 0, create: 0, modify: 0 }
      for (const [abs, counter] of Object.entries(counts)) {
        const parts = abs.split('/').filter((part) => part !== '')
        if (parts.length === 0) continue
        const name = parts[parts.length - 1]
        let node = root
        for (const dir of parts.slice(0, -1)) {
          let child = node.children.find((c) => c.type === 'dir' && c.name === dir)
          if (child === undefined) {
            child = { type: 'dir', name: dir, path: `${node.path}/${dir}`, children: [], read: 0, create: 0, modify: 0 }
            node.children.push(child)
          }
          node = child
          node.read += counter.read
          node.create += counter.create
          node.modify += counter.modify
        }
        node.children.push({
          type: 'file', name, abs,
          read: counter.read, create: counter.create, modify: counter.modify,
          firstSeen: counter.firstSeen, lastSeen: counter.lastSeen,
        })
      }
      const sortNode = (node) => {
        node.children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
          if (a.type === 'dir') return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
          const ta = a.read + a.create + a.modify
          const tb = b.read + b.create + b.modify
          return tb - ta || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
        })
        for (const child of node.children) {
          if (child.type === 'dir') sortNode(child)
        }
      }
      sortNode(root)
      compressChains(root, true)
      return root
    }

    // ── tiny external store ───────────────────────────────────────────────
    function createStore(initial) {
      let state = initial
      const listeners = new Set()
      return {
        getSnapshot: () => state,
        set(patch) {
          state = { ...state, ...patch }
          for (const listener of [...listeners]) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    }

    // ── data access (host routes) ─────────────────────────────────────────
    async function fetchStats(sessionId) {
      const response = await fetch(`/file-activity/api/stats?sessionId=${encodeURIComponent(sessionId)}`)
      const json = await response.json()
      if (json === null || typeof json !== 'object' || json.ok !== true) return null
      return json.value
    }

    /** Resolve the session working directory through the sidebar's native API. */
    async function fetchSessionCwd(sessionId) {
      try {
        const response = await fetch('/sidebar/api/session.cwd', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const json = await response.json()
        const cwd = json?.value?.cwd
        return typeof cwd === 'string' && cwd !== '' ? cwd : ''
      } catch {
        return ''
      }
    }

    function postRecord(sessionId, path, op) {
      if (typeof sessionId !== 'string' || sessionId === '' || typeof path !== 'string' || path === '') return
      void fetch('/file-activity/api/record', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, path, op }),
      }).catch(() => {})
    }

    function postClear(sessionId) {
      void fetch('/file-activity/api/clear', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {})
    }

    // ── fetch interception: sidebar file operations ───────────────────────
    function installFetchInterceptor() {
      const original = window.fetch.bind(window)
      window.fetch = (input, init) => {
        const result = original(input, init)
        let url
        try {
          if (typeof input === 'string') url = new URL(input, window.location.href)
          else if (input instanceof URL) url = input
          else return result // Request instances: skip observation
        } catch {
          return result
        }
        try {
          const pathname = url.pathname
          const method = (init?.method ?? 'GET').toUpperCase()
          if (pathname === '/sidebar/api/fs.read' || pathname === '/sidebar/api/fs.write') {
            if (method === 'POST') {
              const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
              const sessionId = body.sessionId
              const path = body.path
              if (typeof sessionId === 'string' && typeof path === 'string') {
                postRecord(sessionId, path, pathname === '/sidebar/api/fs.write' ? 'write' : 'read')
              }
            }
          } else if (pathname === '/sidebar/file' && method === 'GET') {
            const sessionId = url.searchParams.get('sessionId')
            const path = url.searchParams.get('path')
            if (sessionId !== null && path !== null) postRecord(sessionId, path, 'read')
          }
        } catch {
          // observation must never break the underlying call
        }
        return result
      }
      return () => {
        window.fetch = original
      }
    }

    // ── auto-open (enabled by default) ────────────────────────────────────
    function findTabIn(state, tabId) {
      const leaves = (node) => (node.kind === 'leaf' ? [node] : (node.children ?? []).flatMap(leaves))
      for (const node of [state?.splits, state?.bottomSplits]) {
        if (node === undefined || node === null) continue
        for (const leaf of leaves(node)) {
          if ((leaf.tabs ?? []).some((tab) => tab.type === tabId)) return true
        }
      }
      return false
    }

    function installAutoOpen(ctx, tabId) {
      const service = ctx.betterSidebar
      const tryOpen = () => {
        let snapshot
        try {
          snapshot = service.getSnapshot?.()
        } catch {
          return
        }
        if (snapshot === undefined || snapshot === null || snapshot.sessionId === undefined || snapshot.state === undefined) return
        const sessionId = snapshot.sessionId
        const settings = snapshot.prefs?.pluginSettings?.[tabId]
        if (settings !== undefined && settings.autoOpen === false) return
        try {
          if (window.localStorage.getItem(AUTO_OPEN_KEY + sessionId)) return
        } catch {
          return
        }
        if (findTabIn(snapshot.state, tabId)) {
          try {
            window.localStorage.setItem(AUTO_OPEN_KEY + sessionId, '1')
          } catch {
            // ignore
          }
          return
        }
        try {
          service.openTab({ type: tabId, title: strings.title(), path: '' })
          window.localStorage.setItem(AUTO_OPEN_KEY + sessionId, '1')
        } catch (error) {
          console.error('[dsh-file-activity] auto-open failed:', error)
        }
      }
      tryOpen()
      let off = () => {}
      try {
        off = service.subscribeState?.(() => tryOpen()) ?? off
      } catch {
        // service may lack subscribeState on older versions
      }
      return off
    }

    // ── icons (inline, stroke=currentColor, matching better-sidebar) ──────
    const ICON_STROKE = 1.8
    const iconSvg = (children, size) =>
      createElement('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: ICON_STROKE, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true',
      }, children.map((child, i) => (child === null || child === undefined || typeof child === 'boolean')
        ? child
        : createElement(child.type, { key: i, ...child.props })))

    const icon = {
      clock: (size = 16) => iconSvg([
        createElement('circle', { cx: 12, cy: 12, r: 9 }),
        createElement('path', { d: 'M12 7v5l3 2' }),
      ], size),
      refresh: (size = 16) => iconSvg([
        createElement('path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }),
        createElement('polyline', { points: '21 3 21 9 15 9' }),
      ], size),
      trash: (size = 16) => iconSvg([
        createElement('path', { d: 'M3 6h18' }),
        createElement('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }),
        createElement('path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
      ], size),
      chevronRight: (size = 14) => iconSvg([
        createElement('polyline', { points: '9 6 15 12 9 18' }),
      ], size),
      chevronDown: (size = 14) => iconSvg([
        createElement('polyline', { points: '6 9 12 15 18 9' }),
      ], size),
      file: (size = 16) => iconSvg([
        createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        createElement('path', { d: 'M14 2v6h6' }),
      ], size),
      folder: (size = 16) => iconSvg([
        createElement('path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
      ], size),
      external: (size = 15) => iconSvg([
        createElement('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
        createElement('polyline', { points: '15 3 21 3 21 9' }),
        createElement('line', { x1: 10, y1: 14, x2: 21, y2: 3 }),
      ], size),
      close: (size = 15) => iconSvg([
        createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
        createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 }),
      ], size),
    }

    // ── themed stylesheet (injected once per activation) ──────────────────
    // Mirrors the better-sidebar explorer surface: tight 2px 6px 8px body,
    // 30px rows, box-sizing border-box indentation, folder rows use the
    // strong type face to read as directories, files stay regular.
    const STYLES = `
.dfa { display:flex; flex-direction:column; height:100%; overflow-y:auto; overflow-x:hidden;
  padding:2px 6px 8px; gap:2px; font:var(--dsw-font-s-14); color:var(--dsw-alias-label-primary); }
.dfa-iconbtn { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; padding:0;
  border:none; border-radius:50%; background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; flex:none;
  transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out); }
.dfa-iconbtn svg { display:block; }
.dfa-iconbtn:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
.dfa-iconbtn:disabled { opacity:.4; cursor:default; }
.dfa-iconbtn-danger:hover:not(:disabled) { color:var(--dsw-alias-state-error-primary); }
.dfa-iconbtn-xs { width:20px; height:20px; }
.dfa-section-head-actions { display:flex; align-items:center; gap:2px; flex:none; }
.dfa-section { margin-top:4px; }
.dfa-section-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:2px 6px 2px;
  font:var(--dsw-font-xxxs-strong-11); color:var(--dsw-alias-label-tertiary); text-transform:uppercase; letter-spacing:.04em; }
.dfa-section-head-toggle { display:flex; align-items:center; gap:5px; cursor:pointer; color:var(--dsw-alias-label-secondary); border:none; background:transparent; padding:0;
  font:var(--dsw-font-xxxs-strong-11); text-transform:uppercase; letter-spacing:.04em; }
.dfa-section-head-toggle:hover { color:var(--dsw-alias-label-primary); }
.dfa-section-head-toggle svg { display:block; flex:none; }
.dfa-empty { padding:8px 6px; font:var(--dsw-font-xxs-12); color:var(--dsw-alias-label-tertiary); line-height:1.7; }
.dfa-empty-hint { display:block; margin-top:2px; color:var(--dsw-alias-label-dimmed); font:var(--dsw-font-xxxs-11); }
.dfa-list { display:flex; flex-direction:column; gap:0; }
.dfa-row { display:flex; align-items:center; gap:6px; box-sizing:border-box; width:100%; min-height:26px;
  margin:0; padding:0 8px; border:none; background:transparent; border-radius:8px; cursor:pointer; text-align:left;
  animation:dfa-row-in 150ms var(--ds-ease-in-out); font:var(--dsw-font-s-14); color:var(--dsw-alias-label-primary); }
.dfa-row:hover { background:var(--dsw-alias-interactive-bg-hover); }
.dfa-row-dir { font:var(--dsw-font-s-strong-14); color:var(--dsw-alias-label-primary); }
.dfa-chevron { flex:none; display:flex; align-items:center; color:var(--dsw-alias-label-tertiary); }
.dfa-row-icon { flex:none; display:flex; align-items:center; color:var(--dsw-alias-label-secondary); }
/* Strong folder-vs-file separation: folders get the brand accent ink so the
   directory rows read as the colorful navigation spine; files stay neutral
   and faint, so the eye separates them instantly. */
.dfa-icon-folder { color:var(--dsw-alias-accent); }
.dfa-icon-file { color:var(--dsw-alias-label-tertiary); }
.dfa-row-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dfa-name-file { color:var(--dsw-alias-label-secondary); }
.dfa-time { flex:none; font:var(--dsw-font-xxxs-11); color:var(--dsw-alias-label-tertiary); white-space:nowrap; }
.dfa-op { flex:none; display:inline-flex; align-items:center; justify-content:center; height:17px; padding:0 5px; border-radius:4px;
  font:var(--dsw-font-xxxs-strong-11); }
.dfa-op-create { color:var(--dsw-alias-state-success-primary); background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent); }
.dfa-op-modify { color:var(--dsw-alias-state-warn-primary); background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent); }
.dfa-op-read { color:var(--dsw-alias-accent); background:color-mix(in srgb, var(--dsw-alias-accent) 12%, transparent); }
.dfa-counts { flex:none; display:flex; align-items:center; gap:3px; }
.dfa-count { flex:none; display:inline-flex; align-items:center; justify-content:center; height:15px; padding:0 4px; border-radius:4px;
  font:var(--dsw-font-xxxs-strong-11); }
.dfa-count-create { color:var(--dsw-alias-state-success-primary); background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent); }
.dfa-count-modify { color:var(--dsw-alias-state-warn-primary); background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent); }
.dfa-count-read { color:var(--dsw-alias-accent); background:color-mix(in srgb, var(--dsw-alias-accent) 10%, transparent); }
/* ── floating preview window (uses the sidebar's native viewer rendering) ──
   A transparent-ish scrim fills the viewport and closes the window on any
   outside click / Escape; the window itself stops propagation. Its body is a
   scroll container so large files scroll inside. */
.dfa-fp-overlay { position:fixed; inset:0; z-index:1990; background:rgba(0,0,0,0.12); }
.dfa-fp { position:fixed; top:56px; right:340px; width:min(720px, calc(100vw - 376px)); height:76vh; max-height:860px;
  background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary);
  border:1px solid var(--dsw-alias-border-l2); border-radius:10px; box-shadow:var(--dsw-shadow-lv2); z-index:2000;
  display:flex; flex-direction:column; overflow:hidden; }
.dfa-fp-head { display:flex; align-items:center; gap:6px; padding:6px 8px; border-bottom:1px solid var(--dsw-alias-border-l1); flex:none; }
.dfa-fp-title { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:var(--dsw-font-s-strong-14); color:var(--dsw-alias-label-primary); }
.dfa-fp-actions { display:flex; align-items:center; gap:2px; flex:none; }
.dfa-fp-body { flex:1; overflow:auto; padding:10px 12px; min-height:0; }
.dfa-fp-note { color:var(--dsw-alias-label-tertiary); font:var(--dsw-font-xxs-12); }
.dfa-fp-err { color:var(--dsw-alias-state-error-primary); font:var(--dsw-font-xxs-12); white-space:pre-wrap; word-break:break-all; }
/* PDF preview: a native browser PDF frame filled from the plugin's own media
   route, with a download fallback in the toolbar. */
.dfa-pdf { display:flex; flex-direction:column; width:100%; height:100%; }
.dfa-pdf-toolbar { flex:none; display:flex; justify-content:flex-end; padding:2px 4px 6px; }
.dfa-pdf-download { font:var(--dsw-font-xxs-12); color:var(--dsw-alias-accent); text-decoration:none; }
.dfa-pdf-download:hover { text-decoration:underline; }
.dfa-pdf-frame { flex:1; min-height:0; width:100%; border:none; border-radius:6px; background:transparent; }
@keyframes dfa-row-in { from { opacity:0; transform:translateY(1px); } to { opacity:1; transform:none; } }
`

    // ── view component ────────────────────────────────────────────────────
    /** Shared empty bucket for sessions that have never loaded data (stable ref). */
    const EMPTY_SESSION = { recent: [], counts: {}, loading: true }

    function FileActivityView({ ctx, store, scope, visible, dataStore }) {
      const data = useSyncExternalStore(dataStore.subscribe, dataStore.getSnapshot)
      const [, setCwd] = useState(scope?.cwd || '')
      const [error, setError] = useState(false)
      const [recentOpen, setRecentOpen] = useState(true)
      const [collapsedDirs, setCollapsedDirs] = useState(() => new Set())

      const sessionId = scope?.sessionId ?? ''
      // Each session renders only its own bucket: a fresh conversation shows
      // an empty list immediately, no residue from the previous session.
      const sessionData = (data.bySession ?? {})[sessionId] ?? EMPTY_SESSION

      useEffect(() => {
        if (scope?.cwd) setCwd(scope.cwd)
      }, [scope?.cwd])

      useEffect(() => {
        if (!visible || sessionId === '') return
        let cancelled = false
        const load = () => {
          void fetchStats(sessionId).then((value) => {
            if (cancelled || value === null) return
            setCwd((prev) => prev || value.cwd || '')
            const current = dataStore.getSnapshot()
            dataStore.set({
              bySession: {
                ...(current.bySession ?? {}),
                [sessionId]: { recent: value.recent ?? [], counts: value.counts ?? {}, loading: false },
              },
            })
            setError(false)
          }).catch(() => {
            if (!cancelled) setError(true)
          })
        }
        load()
        // Prefer the sidebar's authoritative session.cwd for relative display.
        void fetchSessionCwd(sessionId).then((cwd) => {
          if (!cancelled && cwd !== '') setCwd(cwd)
        })
        const timer = window.setInterval(load, POLL_MS)
        return () => {
          cancelled = true
          window.clearInterval(timer)
        }
      }, [visible, sessionId, dataStore])

      // Switching conversations closes any floating preview left open by the
      // previous session (preview is shared UI state; the session data itself
      // never crosses sessions anymore).
      useEffect(() => {
        dataStore.set({ preview: null })
      }, [sessionId, dataStore])

      const tree = useMemo(() => buildTree(sessionData.counts ?? {}), [sessionData.counts])

      const toggleDir = (path) => {
        setCollapsedDirs((prev) => {
          const next = new Set(prev)
          if (next.has(path)) next.delete(path)
          else next.add(path)
          return next
        })
      }

      /** Default file action: open a floating preview that reuses the
       *  sidebar's NATIVE viewer (built-in syntax highlighting / Markdown
       *  rendering / images / PDF / HTML). */
      const openPreview = (path) => {
        dataStore.set({ preview: { abs: path, name: basenameOf(path) } })
      }
      const closePreview = () => dataStore.set({ preview: null })

      const onClear = () => {
        if (window.confirm(strings.clearConfirm())) {
          postClear(sessionId)
          const current = dataStore.getSnapshot()
          dataStore.set({
            bySession: {
              ...(current.bySession ?? {}),
              [sessionId]: { recent: [], counts: {}, loading: false },
            },
          })
        }
      }

      const onRefresh = () => {
        if (sessionId === '') return
        void fetchStats(sessionId).then((value) => {
          if (value === null) return
          setCwd((prev) => prev || value.cwd || '')
          const current = dataStore.getSnapshot()
          dataStore.set({
            bySession: {
              ...(current.bySession ?? {}),
              [sessionId]: { recent: value.recent ?? [], counts: value.counts ?? {}, loading: false },
            },
          })
          setError(false)
        }).catch(() => setError(true))
        void fetchSessionCwd(sessionId).then((cwd) => {
          if (cwd !== '') setCwd(cwd)
        })
      }

      const recent = sessionData.recent ?? []

      /** Three colored count pills for a file/dir node (read/create/modify). */
      const countPills = (node) =>
        createElement('span', { className: 'dfa-counts', style: { paddingLeft: '6px' } },
          createElement('span', { className: 'dfa-count dfa-count-read' }, `${strings.readShort()} ${node.read}`),
          createElement('span', { className: 'dfa-count dfa-count-create' }, `${strings.createShort()} ${node.create}`),
          createElement('span', { className: 'dfa-count dfa-count-modify' }, `${strings.modifyShort()} ${node.modify}`),
        )

      const fileRow = (file, depth) =>
        createElement(
          'div',
          {
            key: file.abs,
            className: 'dfa-row',
            onClick: () => openPreview(file.abs),
            style: { paddingLeft: 8 + depth * 20 },
            title: fileTitle(file.abs, file.firstSeen, file.lastSeen),
          },
          createElement('span', { className: 'dfa-row-icon dfa-icon-file' }, icon.file(14)),
          createElement('span', { className: 'dfa-row-name dfa-name-file' }, file.name),
          countPills(file),
          file.lastSeen
            ? createElement('span', { className: 'dfa-time' }, formatRelative(file.lastSeen))
            : null,
        )

      const renderTreeNode = (node, depth) => {
        if (node.type === 'file') return fileRow(node, depth)
        const collapsed = collapsedDirs.has(node.path)
        return createElement(
          'div',
          { key: node.path },
          createElement(
            'div',
            {
              className: 'dfa-row dfa-row-dir',
              onClick: () => toggleDir(node.path),
              style: { paddingLeft: 8 + depth * 20 },
              title: `${node.path}/`,
            },
            createElement('span', { className: 'dfa-chevron' },
              collapsed ? icon.chevronRight(13) : icon.chevronDown(13),
            ),
            createElement('span', { className: 'dfa-row-icon dfa-icon-folder' }, icon.folder(14)),
            createElement('span', { className: 'dfa-row-name' },
              node.compressed ? node.name : node.name + '/',
            ),
            countPills(node),
          ),
          collapsed ? null : node.children.map((child) => renderTreeNode(child, depth + 1)),
        )
      }

      return createElement(
        'div',
        { className: 'dfa' },
        error
          ? createElement('div', { style: { color: 'var(--dsw-alias-state-error-primary)', padding: '4px 6px', font: 'var(--dsw-font-xxs-12)' } }, strings.loadError())
          : null,
        // ── recent ──
        createElement(
          'div',
          { className: 'dfa-section' },
          createElement(
            'div',
            { className: 'dfa-section-head' },
            createElement(
              'button',
              { className: 'dfa-section-head-toggle', onClick: () => setRecentOpen((v) => !v) },
              recentOpen ? icon.chevronDown(13) : icon.chevronRight(13),
              strings.recent(),
            ),
            createElement('span', { className: 'dfa-section-head-actions' },
              createElement('button', { className: 'dfa-iconbtn dfa-iconbtn-xs', onClick: onRefresh, title: strings.refresh(), 'aria-label': strings.refresh() }, icon.refresh(14)),
              createElement('button', { className: 'dfa-iconbtn dfa-iconbtn-xs dfa-iconbtn-danger', onClick: onClear, title: strings.clear(), 'aria-label': strings.clear() }, icon.trash(14)),
            ),
          ),
          !recentOpen ? null : recent.length === 0
            ? createElement(
                'div',
                { className: 'dfa-empty' },
                strings.empty(),
                createElement('span', { className: 'dfa-empty-hint' }, strings.emptyHint()),
              )
            : createElement(
                'div',
                { className: 'dfa-list' },
                recent.map((entry) =>
                  createElement(
                    'div',
                    {
                      key: `${entry.path}:${entry.time}:${entry.op}`,
                      className: 'dfa-row',
                      onClick: () => openPreview(entry.path),
                      title: entry.path,
                    },
                    createElement('span', { className: `dfa-op ${opClass(entry.op)}` }, opLabel(entry.op)),
                    createElement('span', { className: 'dfa-row-name' }, basenameOf(entry.path)),
                    createElement('span', { className: 'dfa-time' }, formatRelative(entry.time)),
                  ),
                ),
              ),
        ),
        // ── stats as a directory tree ──
        createElement(
          'div',
          { className: 'dfa-section' },
          createElement('div', { className: 'dfa-section-head' }, strings.stats()),
          tree.children.length === 0
            ? createElement('div', { className: 'dfa-empty' }, strings.empty())
            : createElement('div', { className: 'dfa-list' }, tree.children.map((child) => renderTreeNode(child, 0))),
        ),
        data.preview
          ? createElement(FloatingPreview, { ctx, store, scope, preview: data.preview, onClose: closePreview })
          : null,
      )
    }

    // ── floating preview window (reuses the sidebar's native viewer) ──────
    /** Resolve a possibly-relative path against the session cwd. */
    function resolvePath(path, cwd) {
      if (typeof path !== 'string' || path === '') return path
      if (path.startsWith('/')) return path
      if (typeof cwd === 'string' && cwd !== '') return `${cwd.replace(/\/+$/, '')}/${path}`
      return path
    }

    /**
     * A floating preview window. Instead of re-implementing rendering, it
     * asks the sidebar registry for the file's viewer (`matchFileViewer`),
     * fetches the bytes the viewer's fetchStrategy needs (fsRead text /
     * mediaUrl / customData), then mounts that viewer's own component — so
     * code gets syntax highlighting and markdown gets rendered by the SAME
     * built-in renderers the sidebar's editor tab uses.
     *
     * Media caveat: the sidebar's own media route (/sidebar/file) only serves
     * files inside the session working directory, while file activity records
     * files the agent touched anywhere (/tmp scratch files, sibling repos…).
     * Media bytes therefore come from OUR route (/file-activity/file), which
     * authorizes exactly the paths this session recorded; PDF is the one
     * built-in viewer that fetches its own URL internally (it ignores the
     * `mediaUrl` prop), so it gets a small iframe preview instead.
     */
    function FloatingPreview({ ctx, store, scope, preview, onClose }) {
      const sessionId = scope?.sessionId ?? ''
      const path = preview.abs
      const title = preview.name
      const service = ctx.betterSidebar
      const [load, setLoad] = useState({ status: 'loading', viewer: null })
      const mediaUrlOf = () => `/file-activity/file?${new URLSearchParams({ sessionId, path })}`

      useEffect(() => {
        let cancelled = false
        const viewer = service?.matchFileViewer?.(path)
        if (!viewer) {
          setLoad({ status: 'error', viewer: null, message: strings.previewUnsupported() })
          return () => { cancelled = true }
        }
        const strategy = viewer.fetchStrategy
        setLoad({ status: 'loading', viewer })
        if (strategy === 'fsRead') {
          const target = resolvePath(path, scope?.cwd ?? '')
          void fetch('/sidebar/api/fs.read', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId, path: target }),
          }).then((response) => response.json())
            .then((json) => {
              if (cancelled) return
              if (json !== null && typeof json === 'object' && json.ok === true && typeof json.value?.content === 'string') {
                setLoad({ status: 'ready', viewer, content: json.value.content })
              } else {
                setLoad({ status: 'error', viewer, message: json?.error?.message ?? strings.previewFailed() })
              }
            }).catch((error) => {
              if (!cancelled) setLoad({ status: 'error', viewer, message: error instanceof Error ? error.message : String(error) })
            })
          return () => { cancelled = true }
        }
        if (strategy === 'mediaUrl') {
          setLoad({ status: 'ready', viewer, mediaUrl: mediaUrlOf() })
          return () => { cancelled = true }
        }
        if (strategy === 'custom') {
          void (viewer.load?.(path, scope) ?? Promise.resolve(undefined)).then((data) => {
            if (!cancelled) setLoad({ status: 'ready', viewer, customData: data })
          }).catch((error) => {
            if (!cancelled) setLoad({ status: 'error', viewer, message: error instanceof Error ? error.message : String(error) })
          })
          return () => { cancelled = true }
        }
        // 'binary-download' and anything else: mount the viewer's own
        // component (it handles the download / media itself).
        setLoad({ status: 'ready', viewer })
        return () => { cancelled = true }
      }, [path, sessionId, scope])

      // Clicking outside is the primary dismiss (the overlay's onClick);
      // Escape is a keyboard affordance. Both call onClose.
      useEffect(() => {
        if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return () => {}
        const handler = (event) => { if (event && event.key === 'Escape') onClose() }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
      }, [onClose])

      let body
      if (load.status === 'loading') {
        body = createElement('div', { className: 'dfa-fp-note' }, strings.loading())
      } else if (load.status === 'error') {
        body = createElement('div', { className: 'dfa-fp-err' },
          strings.previewFailed(),
          load.message
            ? createElement('div', { style: { marginTop: '6px', fontSize: '11px', opacity: 0.85 } }, load.message)
            : null,
        )
      } else {
        body = load.viewer.id === 'pdf'
          ? createElement(PdfPreview, {
              src: mediaUrlOf(),
              download: `${mediaUrlOf()}&download=1`,
              title,
            })
          : createElement(load.viewer.component, {
              ctx, store, scope, path, title,
              viewerId: load.viewer.id,
              content: load.content,
              mediaUrl: load.mediaUrl,
              customData: load.customData,
            })
      }

      return createElement(
        'div',
        { className: 'dfa-fp-overlay', onClick: onClose },
        createElement(
          'div',
          { className: 'dfa-fp', onClick: (event) => { if (event && event.stopPropagation) event.stopPropagation() } },
          createElement(
            'div',
            { className: 'dfa-fp-head' },
            createElement('span', { className: 'dfa-fp-title' }, title),
            createElement(
              'span',
              { className: 'dfa-fp-actions' },
              createElement('button', { className: 'dfa-iconbtn', title: strings.closePreview(), 'aria-label': strings.closePreview(), onClick: () => onClose() },
                icon.close(15),
              ),
            ),
          ),
          createElement('div', { className: 'dfa-fp-body' }, body),
        ),
      )
    }

    /**
     * Lightweight PDF preview. better-sidebar's built-in PdfView fetches
     * `/sidebar/file` internally (it ignores any injected `mediaUrl` prop),
     * and that route refuses files outside the session working directory — so
     * a recorded /tmp PDF would never load. This tiny view embeds the bytes
     * from OUR media route in a native browser PDF frame, with a download
     * fallback in its toolbar.
     */
    function PdfPreview({ src, download, title }) {
      return createElement('div', { className: 'dfa-pdf' },
        createElement('div', { className: 'dfa-pdf-toolbar' },
          createElement('a', { className: 'dfa-pdf-download', href: download, download: true, title: strings.downloadToView() },
            strings.downloadToView()),
        ),
        createElement('iframe', { className: 'dfa-pdf-frame', src, title }),
      )
    }

    // helpers used by the view
    const opClass = (op) => (op === 'create' ? 'dfa-op-create' : op === 'modify' ? 'dfa-op-modify' : 'dfa-op-read')
    const opLabel = (op) => (op === 'create' ? strings.create() : op === 'modify' ? strings.modify() : strings.read())
    /** Tooltip for a stats file row: absolute path + created / last-seen times. */
    const fileTitle = (abs, firstSeen, lastSeen) => {
      const times = []
      if (typeof firstSeen === 'number') times.push(`${strings.created()} ${formatTime(firstSeen)}`)
      if (typeof lastSeen === 'number') times.push(`${strings.lastSeen()} ${formatTime(lastSeen)}`)
      return times.length > 0 ? `${abs}\n${times.join(' · ')}` : abs
    }

    // ── plugin body ───────────────────────────────────────────────────────
    exports.inject = ['betterSidebar']

    exports.apply = function apply(ctx) {
      // The stylesheet is pure static CSS and must NOT depend on the
      // betterSidebar service: inject it first, unconditionally. If it lived
      // behind the `service === undefined` early return, an HMR rebuild or
      // service reload could leave the already-rendered tab WITHOUT its
      // stylesheet — the raw white-text list you see when the CSS is gone.
      // Each fiber owns its own <style> element and the disposer removes
      // only that element, so a rebuild always keeps at least one copy.
      ctx.effect(() => {
        if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') return () => {}
        const style = document.createElement('style')
        style.setAttribute('data-dsh-file-activity', 'styles')
        style.textContent = STYLES
        document.head.appendChild(style)
        return () => {
          if (style.parentNode) style.parentNode.removeChild(style)
        }
      }, 'dsh-file-activity: styles')

      const service = ctx.betterSidebar
      if (service === undefined) return

      // Per-session data store: { bySession: { [sessionId]: { recent, counts, loading } }, preview }
      // Each conversation reads/writes only its own bucket, so switching
      // sessions never leaks another session's file activity into the view.
      const dataStore = createStore({ bySession: {}, preview: null })

      // Mount probe: report client activation to the host state (synthetic
      // session id, invisible in the UI — used to confirm the client half
      // actually loaded after a page refresh).
      void fetch('/file-activity/api/record', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: '__probe__', path: 'mounted', op: 'read' }),
      }).catch(() => {})

      // sidebar operations → host record route
      ctx.effect(() => installFetchInterceptor(), 'dsh-file-activity: sidebar fetch observation')

      // register the tab (enabled by default in the Side card settings)
      ctx.effect(() => service.registerTab({
        id: TAB_ID,
        title: () => strings.title(),
        icon: (size) => icon.clock(size),
        order: 15,
        single: true,
        settings: {
          pluginToggles: [{
            key: 'autoOpen',
            title: () => (isZh() ? '会话开始时自动打开' : 'Auto-open on session start'),
            desc: () => (isZh() ? '每个会话首次打开时自动显示本页（可在侧边栏设置中关闭）' : 'Opens this tab once per session by default (turn off here)'),
            type: 'switch',
          }],
        },
        component: (props) => createElement(FileActivityView, { ...props, dataStore }),
      }), 'dsh-file-activity: tab registration')

      // auto-open once per session (default on)
      ctx.effect(() => installAutoOpen(ctx, TAB_ID), 'dsh-file-activity: auto-open')
    }

    return module.exports
  },
})
