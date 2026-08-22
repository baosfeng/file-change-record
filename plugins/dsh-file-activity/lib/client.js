/**
 * dsh-file-activity — client half (browser).
 *
 * Extends dsh-better-sidebar with a "文件活动 / File Activity" tab:
 *  - recent file access history (agent + sidebar operations),
 *  - per-file create/modify/read counts flattened by folder, with multi-level
 *    folders shown as dotted paths (a.b.c.d) and their files indented below,
 *  - clicking any file opens it in the sidebar's native viewer (image / pdf /
 *    html / code / markdown ... via ctx.betterSidebar.openFile),
 *  - auto-opens once per session by default (toggleable in the sidebar
 *    settings, enabled by default).
 *
 * Data source: the plugin host half (fs/observed for agent tools) + this
 * half's fetch interception for sidebar file operations (fs.read / fs.write /
 * /sidebar/file media opens), both persisted host-side; the tab polls
 * /file-activity/api/stats.
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
        ? '在侧边栏打开文件、编辑保存，或让 agent 读写文件，都会记录在这里。'
        : 'Opening files in the sidebar, editing, or agent file operations are recorded here.'),
      refresh: () => (isZh() ? '刷新' : 'Refresh'),
      clear: () => (isZh() ? '清空' : 'Clear'),
      clearConfirm: () => (isZh() ? '确定清空当前会话的全部文件活动记录？' : 'Clear all file activity for this session?'),
      read: () => (isZh() ? '读取' : 'read'),
      create: () => (isZh() ? '新增' : 'create'),
      modify: () => (isZh() ? '修改' : 'modify'),
      readShort: () => (isZh() ? '读' : 'R'),
      createShort: () => (isZh() ? '增' : 'C'),
      modifyShort: () => (isZh() ? '改' : 'M'),
      justNow: () => (isZh() ? '刚刚' : 'just now'),
      minAgo: (n) => (isZh() ? `${n} 分钟前` : `${n}m ago`),
      hourAgo: (n) => (isZh() ? `${n} 小时前` : `${n}h ago`),
      dayAgo: (n) => (isZh() ? `${n} 天前` : `${n}d ago`),
      root: () => (isZh() ? '根目录' : '(root)'),
      loadError: () => (isZh() ? '加载失败' : 'Load failed'),
      created: () => (isZh() ? '创建' : 'Created'),
      lastSeen: () => (isZh() ? '最近访问' : 'Last seen'),
      unknown: () => (isZh() ? '未知' : 'unknown'),
    }

    // ── path helpers ──────────────────────────────────────────────────────
    function toRelative(path, cwd) {
      if (!cwd || typeof path !== 'string') return path
      const norm = path.split('\\').join('/')
      const base = cwd.split('\\').join('/').replace(/\/+$/, '')
      if (norm === base) return ''
      if (norm.startsWith(base + '/')) return norm.slice(base.length + 1)
      return norm
    }

    function basenameOf(path) {
      const norm = path.split('\\').join('/')
      const idx = norm.lastIndexOf('/')
      return idx === -1 ? norm : norm.slice(idx + 1)
    }

    function dirLabel(dir) {
      if (dir === '') return strings.root()
      return dir.split('/').filter(Boolean).join('.')
    }

    function relativeTime(time) {
      const diff = Date.now() - time
      if (diff < 60 * 1000) return strings.justNow()
      const min = Math.floor(diff / 60000)
      if (min < 60) return strings.minAgo(min)
      const hour = Math.floor(min / 60)
      if (hour < 24) return strings.hourAgo(hour)
      return strings.dayAgo(Math.floor(hour / 24))
    }

    /** Group per-file counts by folder; folder labels are dotted multi-level paths. */
    function buildFolders(counts, cwd) {
      const folders = new Map()
      for (const [abs, counter] of Object.entries(counts)) {
        const rel = toRelative(abs, cwd)
        const idx = rel.lastIndexOf('/')
        const dir = idx === -1 ? '' : rel.slice(0, idx)
        const name = idx === -1 ? rel : rel.slice(idx + 1)
        let entry = folders.get(dir)
        if (entry === undefined) {
          entry = { files: [], read: 0, create: 0, modify: 0 }
          folders.set(dir, entry)
        }
        entry.files.push({ abs, name, read: counter.read, create: counter.create, modify: counter.modify, firstSeen: counter.firstSeen, lastSeen: counter.lastSeen })
        entry.read += counter.read
        entry.create += counter.create
        entry.modify += counter.modify
      }
      const list = []
      for (const [dir, entry] of folders) list.push({ dir, label: dirLabel(dir), ...entry })
      list.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
      for (const folder of list) {
        folder.files.sort((a, b) => {
          const ta = a.read + a.create + a.modify
          const tb = b.read + b.create + b.modify
          return tb - ta || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
        })
      }
      return list
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
          // A content-style open (path seed) makes better-sidebar expand the
          // panel natively when it is collapsed, so the tab always lands in
          // sight ("available by default"). The empty path is inert for this
          // tab type.
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

    // ── view component ────────────────────────────────────────────────────
    function FileActivityView({ ctx, scope, visible, dataStore }) {
      const data = useSyncExternalStore(dataStore.subscribe, dataStore.getSnapshot)
      const [cwd, setCwd] = useState(scope?.cwd || '')
      const [error, setError] = useState(false)

      const sessionId = scope?.sessionId ?? ''

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
            dataStore.set({ recent: value.recent ?? [], counts: value.counts ?? {}, loading: false })
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

      const folders = useMemo(() => buildFolders(data.counts ?? {}, cwd), [data.counts, cwd])

      const openFile = (path) => {
        try {
          if (ctx.betterSidebar.features?.includes('openFile')) {
            ctx.betterSidebar.openFile(scope, path)
          } else {
            ctx.betterSidebar.openTab({ type: 'editor', path, title: basenameOf(path) })
          }
        } catch (error) {
          console.error('[dsh-file-activity] open failed:', error)
        }
      }

      const onClear = () => {
        if (window.confirm(strings.clearConfirm())) {
          postClear(sessionId)
          dataStore.set({ recent: [], counts: {} })
        }
      }

      const onRefresh = () => {
        if (sessionId === '') return
        void fetchStats(sessionId).then((value) => {
          if (value === null) return
          setCwd((prev) => prev || value.cwd || '')
          dataStore.set({ recent: value.recent ?? [], counts: value.counts ?? {} })
          setError(false)
        }).catch(() => setError(true))
        void fetchSessionCwd(sessionId).then((cwd) => {
          if (cwd !== '') setCwd(cwd)
        })
      }

      const recent = data.recent ?? []

      return createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', padding: '8px', gap: '10px', fontSize: '12px' } },
        // header
        createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' } },
          createElement('span', { style: { fontWeight: 600, fontSize: '12px' } }, strings.title()),
          createElement(
            'span',
            { style: { display: 'flex', gap: '6px' } },
            createElement('button', { onClick: onRefresh, style: buttonStyle }, strings.refresh()),
            createElement('button', { onClick: onClear, style: { ...buttonStyle, color: '#e06c5a' } }, strings.clear()),
          ),
        ),
        error
          ? createElement('div', { style: { color: '#e06c5a', padding: '4px 0' } }, strings.loadError())
          : null,
        // ── recent ──
        createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          createElement('div', { style: sectionTitleStyle }, strings.recent()),
          recent.length === 0
            ? createElement(
                'div',
                { style: { color: 'var(--dsh-color-text-secondary, #888)', padding: '6px 0', lineHeight: 1.6 } },
                strings.empty(),
                createElement('div', { style: { color: 'var(--dsh-color-text-tertiary, #999)', fontSize: '11px' } }, strings.emptyHint()),
              )
            : recent.map((entry) =>
                createElement(
                  'div',
                  {
                    key: `${entry.path}:${entry.time}:${entry.op}`,
                    onClick: () => openFile(entry.path),
                    style: rowStyle,
                    title: entry.path,
                  },
                  createElement('span', { style: opBadgeStyle(entry.op) }, opLabel(entry.op)),
                  createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' } }, toRelative(entry.path, cwd)),
                  createElement('span', { style: { color: 'var(--dsh-color-text-tertiary, #999)', flexShrink: 0 } }, relativeTime(entry.time)),
                ),
              ),
        ),
        // ── stats by folder ──
        createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          createElement('div', { style: sectionTitleStyle }, strings.stats()),
          folders.length === 0
            ? createElement('div', { style: { color: 'var(--dsh-color-text-secondary, #888)', padding: '6px 0' } }, strings.empty())
            : folders.map((folder) =>
                createElement(
                  'div',
                  { key: folder.dir, style: { marginBottom: '6px' } },
                  createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' } },
                    createElement('span', { style: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, folder.label),
                    createElement('span', { style: { display: 'flex', gap: '4px', flexShrink: 0 } },
                      countPill(folder.read, strings.read(), '#4a90d9'),
                      countPill(folder.create, strings.create(), '#4caf7d'),
                      countPill(folder.modify, strings.modify(), '#e6a23c'),
                    ),
                  ),
                  folder.files.map((file) =>
                    createElement(
                      'div',
                      {
                        key: file.abs,
                        onClick: () => openFile(file.abs),
                        style: { ...rowStyle, paddingLeft: '22px' },
                        title: fileTitle(file.abs, file.firstSeen, file.lastSeen),
                      },
                      createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, file.name),
                      createElement('span', { style: { display: 'flex', gap: '4px', flexShrink: 0 } },
                        countPill(file.read, strings.readShort(), '#4a90d9'),
                        countPill(file.create, strings.createShort(), '#4caf7d'),
                        countPill(file.modify, strings.modifyShort(), '#e6a23c'),
                        file.lastSeen
                          ? createElement('span', { style: { color: 'var(--dsh-color-text-tertiary, #999)', fontSize: '10px', flexShrink: 0 } }, relativeTime(file.lastSeen))
                          : null,
                      ),
                    ),
                  ),
                ),
              ),
        ),
      )
    }

    // helper styles and small pieces
    const buttonStyle = {
      border: '1px solid var(--dsh-color-border, #444)', background: 'transparent', color: 'inherit',
      borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer',
    }
    const sectionTitleStyle = { fontWeight: 600, fontSize: '12px', padding: '2px 0', color: 'var(--dsh-color-text-secondary, #888)' }
    const rowStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 4px', borderRadius: '4px', cursor: 'pointer' }
    const opBadgeStyle = (op) => ({
      borderRadius: '3px', padding: '1px 5px', fontSize: '10px', color: '#fff', flexShrink: 0,
      background: op === 'create' ? '#4caf7d' : op === 'modify' ? '#e6a23c' : '#4a90d9',
    })
    const countPill = (count, label, color) =>
      createElement('span', { style: { fontSize: '10px', color, background: color + '22', borderRadius: '3px', padding: '0 4px', flexShrink: 0 } }, `${label} ${count}`)
    const opLabel = (op) => (op === 'create' ? strings.create() : op === 'modify' ? strings.modify() : strings.read())
    /** Tooltip for a stats file row: absolute path + created / last-seen times. */
    const fileTitle = (abs, firstSeen, lastSeen) => {
      const times = []
      if (typeof firstSeen === 'number') times.push(`${strings.created()} ${relativeTime(firstSeen)}`)
      if (typeof lastSeen === 'number') times.push(`${strings.lastSeen()} ${relativeTime(lastSeen)}`)
      return times.length > 0 ? `${abs}\n${times.join(' · ')}` : abs
    }

    // ── plugin body ───────────────────────────────────────────────────────
    exports.inject = ['betterSidebar']

    exports.apply = function apply(ctx) {
      const service = ctx.betterSidebar
      if (service === undefined) return

      const dataStore = createStore({ recent: [], counts: {}, loading: true })

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
        icon: (size) => createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
          createElement('circle', { cx: 12, cy: 12, r: 9 }),
          createElement('path', { d: 'M12 7v5l3 2' }),
        ),
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
