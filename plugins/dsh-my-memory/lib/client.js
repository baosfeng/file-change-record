/**
 * dsh-my-memory — client half (browser). SOURCE TEMPLATE.
 *
 * A Web Settings "记忆 / Memory" tab (official `slots` extension point — no
 * third-party dependency) showing the GLOBAL and PROJECT memory scopes side
 * by side, with add / edit / delete. Every write goes through a custom
 * confirmation UI (built on the ask pattern, NOT the native browser
 * confirm): delete is a red, eye-catching two-step confirm; save/add is
 * green. The project scope is visually distinct (project-root badge +
 * different section accent) so the two scopes never blur together.
 *
 * Data source: GET /my-memory/api/memory + POST /my-memory/api/memory
 * (server half). Writes carry `confirmed: true` — the server refuses any
 * write without the user-consent marker.
 *
 * BUILD NOTE: this file is the SOURCE TEMPLATE. scripts/build.mjs splices
 * the `lib/parts/*.part.js` pieces into the PART placeholder markers below
 * (each piece is plain function-declaration text sharing this factory scope;
 * the browser ModuleLoader does not support relative-path require) and writes
 * lib/client.js — the file actually served by DSH, which MUST be committed
 * (CI runs node --check + tests against it, not against this template).
 */
window.__ModuleLoader__.load({
  id: 'dsh-my-memory',
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
      title: () => (isZh() ? '记忆' : 'Memory'),
      globalSection: () => (isZh() ? '全局记忆' : 'Global memory'),
      projectSection: () => (isZh() ? '项目记忆' : 'Project memory'),
      projectHint: () => (isZh()
        ? '输入项目根路径以查看 / 编辑该项目记忆（写入 <项目根>/.dsh/memory.json）'
        : 'Enter a project root to view/edit its project memory (stored in <projectRoot>/.dsh/memory.json)'),
      loadProject: () => (isZh() ? '加载' : 'Load'),
      refresh: () => (isZh() ? '刷新' : 'Refresh'),
      loading: () => (isZh() ? '加载中…' : 'Loading…'),
      loadError: () => (isZh() ? '加载失败' : 'Load failed'),
      empty: () => (isZh() ? '暂无记忆' : 'No memories yet'),
      addPlaceholder: () => (isZh() ? '输入要记住的内容（如：回复使用中文）' : 'Type what to remember (e.g. reply in Chinese)'),
      add: () => (isZh() ? '新增' : 'Add'),
      save: () => (isZh() ? '保存' : 'Save'),
      cancel: () => (isZh() ? '取消' : 'Cancel'),
      edit: () => (isZh() ? '编辑' : 'Edit'),
      delete: () => (isZh() ? '删除' : 'Delete'),
      confirmAdd: () => (isZh() ? '确认新增这条记忆？' : 'Add this memory?'),
      confirmUpdate: () => (isZh() ? '确认保存这条记忆的修改？' : 'Save this memory change?'),
      confirmDelete: () => (isZh() ? '确定删除这条记忆？此操作不可撤销。' : 'Delete this memory? This cannot be undone.'),
      confirmSave: () => (isZh() ? '确认保存' : 'Confirm save'),
      confirmDeleteBtn: () => (isZh() ? '确认删除' : 'Confirm delete'),
      saved: () => (isZh() ? '已保存' : 'Saved'),
      saveFailed: () => (isZh() ? '操作失败' : 'Operation failed'),
      projectRoot: () => (isZh() ? '项目根：' : 'Project root: '),
      globalNote: () => (isZh()
        ? '全局记忆在会话开始时注入系统提示词（agent 始终携带）；存于 $DSH_HOME/memory.json'
        : 'Global memories are injected into the system prompt at session start; stored in $DSH_HOME/memory.json'),
      projectNote: () => (isZh()
        ? '项目记忆按项目隔离，仅该项目会话可见；存于 <项目根>/.dsh/memory.json'
        : 'Project memories are scoped to this project only; stored in <projectRoot>/.dsh/memory.json'),
      confirmHint: () => (isZh() ? '所有新增 / 修改 / 删除都需要你确认' : 'Every add / edit / delete needs your confirmation'),
      updatedAt: (ts) => (isZh() ? `更新于 ${new Date(ts).toLocaleString()}` : `Updated ${new Date(ts).toLocaleString()}`),
    }

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

        // ── api: fetch helpers for the Memory views ────────────────────────────
    const API_BASE = '/my-memory/api'

    /** One GET memory payload into { scope, cwd, projectRoot, items }. */
    function normalizeMemory(value) {
      return {
        scope: value.scope ?? 'global',
        cwd: value.cwd ?? '',
        projectRoot: value.projectRoot ?? '',
        items: Array.isArray(value.items) ? value.items : [],
      }
    }

    /** GET /my-memory/api/memory?scope=…&cwd=… → normalized value; rejects on bad responses. */
    function fetchMemory(scope, cwd) {
      const query = cwd.trim() === '' ? `?scope=${scope}` : `?scope=${scope}&cwd=${encodeURIComponent(cwd.trim())}`
      return fetch(`${API_BASE}/memory${query}`)
        .then((res) => res.json())
        .then((body) => {
          if (body === null || body.ok !== true) throw new Error('bad memory response')
          return normalizeMemory(body.value)
        })
    }

    /** POST /my-memory/api/memory — a write gated on the user-consent marker. */
    function writeMemory({ action, scope, cwd, id, desc }) {
      return fetch(`${API_BASE}/memory`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, scope, cwd, id, desc, confirmed: true }),
      })
        .then((res) => res.json())
        .then((body) => {
          if (body === null || body.ok !== true) throw new Error('write failed')
          return normalizeMemory({ ...body.value, scope })
        })
    }

        // ── view: Memory settings tab ─────────────────────────────────────────
    /** Load both scopes: global always; project only when a cwd is given. */
    function fetchAll(cwd) {
      const projectCwd = cwd.trim()
      const globalP = fetchMemory('global', '')
      const projectP = projectCwd === ''
        ? Promise.resolve({ scope: 'project', cwd: '', projectRoot: '', items: [] })
        : fetchMemory('project', projectCwd)
      return Promise.all([globalP, projectP]).then(([global, project]) => ({ global, project }))
    }

    /** Replace one scope's data inside the two-scope state. */
    function mergeScope(data, scope, value) {
      return scope === 'global' ? { ...data, global: value } : { ...data, project: value }
    }

    /** Data actions bound to the state setters (created once per component). */
    function createActions({ setData, setLoading, setError, setSaved }) {
      const applyValue = (value) => {
        setData(value)
        setLoading(false)
      }
      const refreshWith = (fetcher, cwd) => {
        setLoading(true)
        setError(false)
        setSaved(false)
        fetcher(cwd)
          .then(applyValue)
          .catch(() => {
            setLoading(false)
            setError(true)
          })
      }
      return {
        load: (cwd) => refreshWith(fetchAll, cwd),
        refresh: (cwd) => refreshWith(fetchAll, cwd),
      }
    }

    function MemoryView() {
      const [data, setData] = useState(null)
      const [pathInput, setPathInput] = useState('')
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState(false)
      const [saved, setSaved] = useState(false)
      const [drafts, setDrafts] = useState({ global: '', project: '' })
      const [editing, setEditing] = useState(null)
      const [confirming, setConfirming] = useState(null)
      const actions = createActions({ setData, setLoading, setError, setSaved })

      useEffect(() => {
        actions.load('')
      }, [])

      const commit = createCommitHandler({ data, setData, setSaved, setError, setDrafts, setEditing, setConfirming })

      return createElement('div', { className: 'dmm-root' },
        createElement(Toolbar, { pathInput, onInput: setPathInput, onLoad: actions.load, onRefresh: actions.refresh }),
        error ? createElement('div', { className: 'dmm-error' }, strings.loadError()) : null,
        loading ? createElement('div', { className: 'dmm-status' }, strings.loading())
          : data === null ? null : createElement(Sections, {
            data,
            saved,
            drafts,
            editing,
            confirming,
            onDraft: (scope, value) => setDrafts({ ...drafts, [scope]: value }),
            onEdit: (scope, id, desc) => setEditing({ scope, id, desc }),
            onEditDesc: (value) => setEditing({ ...editing, desc: value }),
            onCancelEdit: () => setEditing(null),
            onConfirm: (confirm) => setConfirming(confirm),
            onCancelConfirm: () => setConfirming(null),
            onCommit: commit,
          }),
      )
    }

    /** One confirmed write (add / update / delete) → POST + refresh the scope. */
    function createCommitHandler({ data, setData, setSaved, setError, setDrafts, setEditing, setConfirming }) {
      return (confirm) => {
        setSaved(false)
        setError(false)
        writeMemory({
          action: confirm.kind,
          scope: confirm.scope,
          cwd: confirm.scope === 'project' ? data.project.cwd : '',
          id: confirm.id,
          desc: confirm.desc,
        })
          .then((value) => {
            setSaved(true)
            setDrafts((d) => ({ ...d, [confirm.scope]: '' }))
            setEditing(null)
            setConfirming(null)
            setData((d) => mergeScope(d, confirm.scope, value))
          })
          .catch(() => setError(true))
      }
    }

    /** Path input + load/refresh buttons + consent note. */
    function Toolbar({ pathInput, onInput, onLoad, onRefresh }) {
      return createElement('div', null,
        createElement('div', { className: 'dmm-pathbar' },
          createElement('input', {
            className: 'dmm-path-input',
            placeholder: strings.projectHint(),
            value: pathInput,
            onChange: (event) => onInput(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') onLoad(pathInput)
            },
          }),
          createElement('button', {
            className: 'dmm-btn',
            'aria-label': strings.loadProject(),
            onClick: () => onLoad(pathInput),
          }, strings.loadProject()),
          createElement('button', {
            className: 'dmm-btn',
            'aria-label': strings.refresh(),
            onClick: () => onRefresh(pathInput),
          }, strings.refresh()),
        ),
        createElement('div', { className: 'dmm-note' }, strings.confirmHint()),
      )
    }

    /** The two scopes side by side: global (default) + project (accented). */
    function Sections({ data, saved, drafts, editing, confirming, onDraft, onEdit, onEditDesc, onCancelEdit, onConfirm, onCancelConfirm, onCommit }) {
      return createElement('div', { className: 'dmm-sections' },
        createElement(SectionBlock, {
          scope: 'global',
          title: strings.globalSection(),
          badge: strings.globalSection(),
          note: strings.globalNote(),
          data: data.global,
          drafts,
          editing,
          confirming,
          onDraft,
          onEdit,
          onEditDesc,
          onCancelEdit,
          onConfirm,
          onCancelConfirm,
          onCommit,
        }),
        createElement(SectionBlock, {
          scope: 'project',
          title: strings.projectSection(),
          badge: data.project.cwd !== '' ? strings.projectRoot() + data.project.projectRoot : strings.projectSection(),
          note: strings.projectNote(),
          data: data.project,
          drafts,
          editing,
          confirming,
          onDraft,
          onEdit,
          onEditDesc,
          onCancelEdit,
          onConfirm,
          onCancelConfirm,
          onCommit,
        }),
        saved ? createElement('div', { className: 'dmm-status dmm-saved' }, strings.saved()) : null,
      )
    }

    /** One scope's section: rows + add bar + inline confirmation panel. */
    function SectionBlock({ scope, title, badge, note, data, drafts, editing, confirming, onDraft, onEdit, onEditDesc, onCancelEdit, onConfirm, onCancelConfirm, onCommit }) {
      const isProject = scope === 'project'
      const rows = buildRows(data.items, scope, editing, onEdit, onEditDesc, onCancelEdit, onConfirm)
      return createElement('div', { className: `dmm-section${isProject ? ' dmm-section-project' : ''}` },
        createElement('div', { className: 'dmm-section-head' },
          createElement('span', { className: 'dmm-section-title' }, title),
          createElement('span', { className: 'dmm-badge' }, badge),
        ),
        createElement('div', { className: 'dmm-note' }, note),
        rows.length === 0 ? createElement('div', { className: 'dmm-empty' }, strings.empty()) : rows,
        createElement('div', { className: 'dmm-addbar' },
          createElement('input', {
            className: 'dmm-add-input',
            placeholder: strings.addPlaceholder(),
            value: drafts[scope],
            onChange: (event) => onDraft(scope, event.target.value),
          }),
          createElement('button', {
            className: 'dmm-btn-save',
            'aria-label': `${strings.add()} ${scope}`,
            onClick: () => onConfirm({ kind: 'add', scope, desc: drafts[scope] }),
          }, strings.add()),
        ),
        confirming !== null && confirming.scope === scope
          ? createElement(ConfirmPanel, { confirm: confirming, onCancel: onCancelConfirm, onOk: () => onCommit(confirming) })
          : null,
      )
    }

    /** Build the memory rows of one scope (edit mode swaps in an input). */
    function buildRows(items, scope, editing, onEdit, onEditDesc, onCancelEdit, onConfirm) {
      return items.map((item) => {
        const isEditing = editing !== null && editing.scope === scope && editing.id === item.id
        return createElement(MemoryRow, {
          key: item.id,
          item,
          isEditing,
          editingDesc: isEditing ? editing.desc : '',
          onEdit: () => onEdit(scope, item.id, item.desc),
          onEditDesc,
          onCancelEdit,
          onSaveEdit: () => onConfirm({ kind: 'update', scope, id: item.id, desc: editing.desc }),
          onDelete: () => onConfirm({ kind: 'delete', scope, id: item.id, desc: item.desc }),
        })
      })
    }

    /** One memory row: desc + meta + edit/delete; edit mode swaps in an input. */
    function MemoryRow({ item, isEditing, editingDesc, onEdit, onEditDesc, onCancelEdit, onSaveEdit, onDelete }) {
      if (isEditing) {
        return createElement('div', { className: 'dmm-row' },
          createElement('input', {
            className: 'dmm-add-input',
            value: editingDesc,
            onChange: (event) => onEditDesc(event.target.value),
          }),
          createElement('div', { className: 'dmm-actions' },
            createElement('button', { className: 'dmm-btn-save', onClick: onSaveEdit }, strings.save()),
            createElement('button', { className: 'dmm-btn-edit', onClick: onCancelEdit }, strings.cancel()),
          ),
        )
      }
      return createElement('div', { className: 'dmm-row' },
        createElement('div', { className: 'dmm-row-head' },
          createElement('span', { className: 'dmm-desc' }, item.desc),
          createElement('div', { className: 'dmm-actions' },
            createElement('button', {
              className: 'dmm-btn-edit',
              'aria-label': `${strings.edit()} ${item.id}`,
              onClick: onEdit,
            }, strings.edit()),
            createElement('button', {
              className: 'dmm-btn-danger',
              'aria-label': `${strings.delete()} ${item.id}`,
              onClick: onDelete,
            }, strings.delete()),
          ),
        ),
        createElement('div', { className: 'dmm-meta' }, strings.updatedAt(item.updatedAt)),
      )
    }

    /** Custom confirmation panel (ask-style, not the native confirm): delete is red, save is green. */
    function ConfirmPanel({ confirm, onCancel, onOk }) {
      const isDelete = confirm.kind === 'delete'
      const text = confirm.kind === 'add' ? strings.confirmAdd()
        : confirm.kind === 'update' ? strings.confirmUpdate()
        : strings.confirmDelete()
      return createElement('div', { className: `dmm-confirm dmm-confirm-${isDelete ? 'delete' : 'save'}` },
        createElement('div', { className: 'dmm-confirm-text' }, text),
        createElement('div', { className: 'dmm-confirm-desc' }, confirm.desc),
        createElement('div', { className: 'dmm-confirm-actions' },
          createElement('button', {
            className: `dmm-confirm-ok dmm-confirm-ok-${isDelete ? 'delete' : 'save'}`,
            onClick: onOk,
          }, isDelete ? strings.confirmDeleteBtn() : strings.confirmSave()),
          createElement('button', { className: 'dmm-confirm-cancel', onClick: onCancel }, strings.cancel()),
        ),
      )
    }

        // ── plugin body ───────────────────────────────────────────────────────
    // 零第三方依赖：面板挂在官方 slots 扩展点（设置 → 插件 → 记忆），
    // 不依赖 dsh-better-sidebar。slots 服务是官方 client 服务，通过
    // ctx.get 动态获取——服务缺省时静默跳过（不注册 tab，server 端记忆
    // 能力不受影响）。
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
      }, 'dsh-my-memory: styles')

      const slots = ctx.get('slots')
      if (slots === undefined) return

      ctx.effect(() => slots.inject('settings.plugins.tab', () => slots.register({
        name: 'settings.plugins.tab',
        id: 'my-memory',
        order: 92,
        label: () => strings.title(),
      }, MemoryView)), 'dsh-my-memory: settings tab registration')
    }


    return module.exports
  },
})
