/**
 * dsh-my-plugin-manager — client half (browser). SOURCE TEMPLATE.
 *
 * A Web Settings "插件管理 / Plugin Manager" tab (official `slots` extension
 * point — no third-party dependency) with two sections:
 *  - 已安装: loader inventory (name / version / state) + uninstall per row
 *    + an update check (`pnpm outdated`) with a one-click hint;
 *  - 市场: npm registry search with one-click install (installs land in the
 *    profile via `dsh plugin add`; a restart loads them).
 *
 * Data source: GET/POST /my-plugin-manager/api/* (server half). Styling follows
 * the DSH design language: semantic tokens, flat surfaces, hairline borders.
 *
 * BUILD NOTE: this file is the SOURCE TEMPLATE. scripts/build.mjs splices the
 * `lib/parts/*.part.js` pieces into the PART placeholder markers below
 * (each piece is plain function-declaration text sharing this factory scope;
 * the browser ModuleLoader does not support relative-path require) and writes
 * lib/client.js — the file actually served by DSH, which MUST be committed
 * (CI runs node --check + tests against it, not against this template).
 */
window.__ModuleLoader__.load({
  id: 'dsh-my-plugin-manager',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useEffect, useState } = require('react')

    // ── parts (injected by scripts/build.mjs; keep this exact order — the
    //    const initializers below run in splice order) ─────────────────────
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
      title: () => (isZh() ? '插件管理' : 'Plugin Manager'),
      installed: () => (isZh() ? '已安装' : 'Installed'),
      market: () => (isZh() ? '市场' : 'Market'),
      searchPlaceholder: () => (isZh() ? '搜索 npm 插件（如 dsh-file-activity）…' : 'Search npm plugins (e.g. dsh-file-activity)…'),
      search: () => (isZh() ? '搜索' : 'Search'),
      install: () => (isZh() ? '安装' : 'Install'),
      uninstall: () => (isZh() ? '卸载' : 'Uninstall'),
      checkUpdates: () => (isZh() ? '检查更新' : 'Check updates'),
      noUpdates: () => (isZh() ? '全部为最新版本' : 'All up to date'),
      updatesAvailable: (n) => (isZh() ? `${n} 个插件可更新` : `${n} update(s) available`),
      loading: () => (isZh() ? '加载中…' : 'Loading…'),
      loadError: () => (isZh() ? '加载失败' : 'Load failed'),
      emptyInstalled: () => (isZh() ? '暂无已安装插件' : 'No plugins installed'),
      emptySearch: () => (isZh() ? '输入关键词搜索 npm 插件市场' : 'Type a query to search the npm plugin market'),
      noResults: () => (isZh() ? '没有匹配的插件' : 'No matching plugins'),
      running: () => (isZh() ? '运行中' : 'running'),
      disabled: () => (isZh() ? '已禁用' : 'disabled'),
      version: () => (isZh() ? '版本' : 'version'),
      installHint: () => (isZh()
        ? '安装/卸载通过 `dsh plugin` 写入 profile（npm 包或 link 路径）；新插件在下次重启 DSH 后加载。'
        : 'Install/uninstall writes through `dsh plugin` (npm package or link: path); new plugins load on the next DSH restart.'),
      installDone: () => (isZh() ? '安装完成（重启后加载）' : 'Installed (loads on restart)'),
      uninstallDone: () => (isZh() ? '已卸载（重启后移除）' : 'Uninstalled (removed on restart)'),
      actionFailed: () => (isZh() ? '操作失败' : 'Action failed'),
      noVersion: () => (isZh() ? '—' : '—'),
    }

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

    const STYLE_TAG = 'data-dsh-my-plugin-manager'

        // ── api: fetch helpers for the Plugin Manager views ────────────────────
    const API_BASE = '/my-plugin-manager/api'

    /** GET /installed → { entries: [{ moduleName, enabled, fiberPhase, version }] }. */
    function fetchInstalled() {
      return fetchJson(`${API_BASE}/installed`)
    }

    /** GET /search?q= → { results: [{ name, version, description, author }] }. */
    function fetchSearch(query) {
      return fetchJson(`${API_BASE}/search?q=${encodeURIComponent(query.trim())}`)
    }

    /** GET /updates → { outdated: [{ name, current, latest }], error? }. */
    function fetchUpdates() {
      return fetchJson(`${API_BASE}/updates`)
    }

    /** POST /install { source } → { ok, error? }. */
    function postInstall(source) {
      return fetchJson(`${API_BASE}/install`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source }),
      })
    }

    /** POST /uninstall { name } → { ok, error? }. */
    function postUninstall(name) {
      return fetchJson(`${API_BASE}/uninstall`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
    }

    function fetchJson(url, options) {
      return fetch(url, options)
        .then((res) => res.json())
        .then((body) => {
          if (body === null || body.ok !== true) throw new Error(body?.error?.message ?? 'bad response')
          return body.value ?? {}
        })
    }

        // ── view: Plugin Manager settings tab ──────────────────────────────────
    function createActions({ setInstalled, setUpdates, setNotice, setError }) {
      const reloadInstalled = () => {
        fetchInstalled()
          .then((value) => setInstalled(value.entries ?? []))
          .catch(() => setError(true))
      }
      const runUpdates = () => {
        setError(false)
        fetchUpdates()
          .then((value) => setUpdates(value.outdated ?? []))
          .catch(() => setError(true))
      }
      const install = (source) => {
        setError(false)
        postInstall(source)
          .then(() => {
            setNotice(strings.installDone())
            reloadInstalled()
          })
          .catch((error) => setError(error.message ?? true))
      }
      const uninstall = (name) => {
        setError(false)
        postUninstall(name)
          .then(() => {
            setNotice(strings.uninstallDone())
            reloadInstalled()
          })
          .catch((error) => setError(error.message ?? true))
      }
      return { reloadInstalled, runUpdates, install, uninstall }
    }

    function PluginManagerView() {
      const [installed, setInstalled] = useState(null)
      const [updates, setUpdates] = useState(null)
      const [notice, setNotice] = useState('')
      const [error, setError] = useState(false)
      const actions = createActions({ setInstalled, setUpdates, setNotice, setError })

      useEffect(() => {
        actions.reloadInstalled()
      }, [])

      return createElement('div', { className: 'dpm-root' },
        createElement('div', { className: 'dpm-hint' }, strings.installHint()),
        error ? createElement('div', { className: 'dpm-error' },
          typeof error === 'string' ? `${strings.actionFailed()}：${error}` : strings.loadError()) : null,
        notice !== '' ? createElement('div', { className: 'dpm-status dpm-saved' }, notice) : null,
        createElement(InstalledSection, { installed, updates, actions }),
        createElement(MarketSection, { actions }),
      )
    }

    /** 已安装清单 + 更新检查。 */
    function InstalledSection({ installed, updates, actions }) {
      const rows = installed === null
        ? null
        : installed.length === 0
          ? createElement('div', { className: 'dpm-empty' }, strings.emptyInstalled())
          : installed.map((entry) =>
            createElement(InstalledRow, {
              key: entry.moduleName,
              entry,
              outdated: outdatedOf(updates, entry.moduleName),
              onUninstall: () => actions.uninstall(entry.moduleName),
            }))
      return createElement('div', { className: 'dpm-section' },
        createElement('div', { className: 'dpm-section-title' }, strings.installed()),
        installed === null ? createElement('div', { className: 'dpm-status' }, strings.loading())
          : rows,
        createElement('div', { className: 'dpm-actions' },
          createElement('button', { className: 'dpm-btn', onClick: actions.runUpdates }, strings.checkUpdates()),
        ),
        updates !== null && updates.length > 0
          ? createElement('div', { className: 'dpm-status dpm-new' }, strings.updatesAvailable(updates.length))
          : updates !== null
            ? createElement('div', { className: 'dpm-status' }, strings.noUpdates())
            : null,
      )
    }

    /** One installed plugin row: name / version / state + uninstall. */
    function InstalledRow({ entry, outdated, onUninstall }) {
      return createElement('div', { className: 'dpm-row' },
        createElement('div', { className: 'dpm-row-head' },
          createElement('span', { className: 'dpm-name' }, entry.moduleName),
          createElement('span', { className: 'dpm-ver' },
            `${strings.version()} ${entry.version === '' ? strings.noVersion() : entry.version}`),
          outdated !== null ? createElement('span', { className: 'dpm-ver dpm-new' },
            `${outdated.current} → ${outdated.latest}`) : null,
          createElement('span', { className: 'dpm-state' },
            entry.enabled ? strings.running() : strings.disabled()),
        ),
        createElement('div', { className: 'dpm-actions' },
          createElement('button', { className: 'dpm-btn dpm-btn-danger', onClick: onUninstall }, strings.uninstall()),
        ),
      )
    }

    /** 市场: npm 搜索 + 一键安装。 */
    function MarketSection({ actions }) {
      const [query, setQuery] = useState('')
      const [results, setResults] = useState(null)
      const [searching, setSearching] = useState(false)
      const runSearch = () => {
        if (query.trim() === '') return
        setSearching(true)
        fetchSearch(query)
          .then((value) => {
            setResults(value.results ?? [])
            setSearching(false)
          })
          .catch(() => setSearching(false))
      }
      return createElement('div', { className: 'dpm-section' },
        createElement('div', { className: 'dpm-section-title' }, strings.market()),
        createElement('div', { className: 'dpm-searchbar' },
          createElement('input', {
            className: 'dpm-search-input',
            placeholder: strings.searchPlaceholder(),
            value: query,
            onChange: (event) => setQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') runSearch()
            },
          }),
          createElement('button', { className: 'dpm-btn dpm-btn-primary', onClick: runSearch }, strings.search()),
        ),
        searching ? createElement('div', { className: 'dpm-status' }, strings.loading())
          : marketRows(results, actions.install),
      )
    }

    /** Market rows: placeholder / empty / result list. */
    function marketRows(results, install) {
      if (results === null) return createElement('div', { className: 'dpm-empty' }, strings.emptySearch())
      if (results.length === 0) return createElement('div', { className: 'dpm-empty' }, strings.noResults())
      return results.map((item) =>
        createElement(MarketRow, {
          key: item.name,
          item,
          onInstall: () => install(item.name),
        }))
    }

    /** One market search result row with an install button. */
    function MarketRow({ item, onInstall }) {
      return createElement('div', { className: 'dpm-row' },
        createElement('div', { className: 'dpm-row-head' },
          createElement('span', { className: 'dpm-name' }, item.name),
          createElement('span', { className: 'dpm-ver' }, item.version),
          item.author !== '' ? createElement('span', { className: 'dpm-state' }, item.author) : null,
        ),
        createElement('div', { className: 'dpm-desc' }, item.description),
        createElement('div', { className: 'dpm-actions' },
          createElement('button', { className: 'dpm-btn dpm-btn-primary', onClick: onInstall }, strings.install()),
        ),
      )
    }

    /** The matching update entry for a module, if any. */
    function outdatedOf(updates, moduleName) {
      if (!Array.isArray(updates)) return null
      const hit = updates.find((entry) => entry.name === moduleName)
      return hit === undefined ? null : hit
    }

        // ── plugin body ───────────────────────────────────────────────────────
    // 零第三方依赖：面板挂在官方 slots 扩展点（设置 → 插件 → 插件管理），
    // 不依赖 dsh-better-sidebar。slots 服务通过 ctx.get 动态获取——服务
    // 缺省时静默跳过（不注册 tab，server 端 API 不受影响）。
    exports.apply = function apply(ctx) {
      ctx.effect(() => {
        if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') return () => {}
        const style = document.createElement('style')
        style.setAttribute(STYLE_TAG, 'styles')
        style.textContent = STYLES
        document.head.appendChild(style)
        return () => {
          if (style.parentNode) style.parentNode.removeChild(style)
        }
      }, 'dsh-my-plugin-manager: styles')

      const slots = ctx.get('slots')
      if (slots === undefined) return

      ctx.effect(() => slots.inject('settings.plugins.tab', () => slots.register({
        name: 'settings.plugins.tab',
        id: 'my-plugin-manager',
        order: 100,
        label: () => strings.title(),
      }, PluginManagerView)), 'dsh-my-plugin-manager: settings tab registration')
    }


    return module.exports
  },
})
