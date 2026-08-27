/**
 * dsh-my-skill-manager — client half (browser). SOURCE TEMPLATE.
 *
 * A Web Settings "Skill 管理 / Skill Manager" tab (official `slots`
 * extension point — no third-party dependency) showing:
 *  - the skill catalog grouped by 全局 / 项目 scope,
 *  - an enable/disable toggle per skill for the global scope and for the
 *    current project (project config lives in <projectRoot>/.dsh/skills.enabled.json),
 *  - a project-path input to pick which project's config is edited.
 *
 * Data source: GET /my-skill-manager/api/list + PUT /my-skill-manager/api/config
 * (server half). Styling follows the DSH design language: semantic tokens,
 * flat surfaces, hairline borders.
 *
 * BUILD NOTE: this file is the SOURCE TEMPLATE. scripts/build.mjs splices the
 * `lib/parts/*.part.js` pieces into the PART placeholder markers below
 * (each piece is plain function-declaration text sharing this factory scope;
 * the browser ModuleLoader does not support relative-path require) and writes
 * lib/client.js — the file actually served by DSH, which MUST be committed
 * (CI runs node --check + tests against it, not against this template).
 */
window.__ModuleLoader__.load({
  id: 'dsh-my-skill-manager',
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
      title: () => (isZh() ? 'Skill 管理' : 'Skill Manager'),
      globalSection: () => (isZh() ? '全局' : 'Global'),
      projectSection: () => (isZh() ? '项目' : 'Project'),
      projectHint: () => (isZh()
        ? '输入项目根路径以查看 / 编辑该项目级启用/禁用配置（写入 <项目根>/.dsh/skills.enabled.json，随仓库版本化）'
        : 'Enter a project root to view/edit its per-project skill config (stored in <projectRoot>/.dsh/skills.enabled.json)'),
      loadProject: () => (isZh() ? '加载' : 'Load'),
      refresh: () => (isZh() ? '刷新' : 'Refresh'),
      enabled: () => (isZh() ? '启用' : 'Enabled'),
      disabled: () => (isZh() ? '已禁用' : 'Disabled'),
      loading: () => (isZh() ? '加载中…' : 'Loading…'),
      loadError: () => (isZh() ? '加载失败' : 'Load failed'),
      empty: () => (isZh() ? '暂无 skill' : 'No skills yet'),
      sourceProject: (source) => (isZh() ? `项目（${source}）` : `project (${source})`),
      sourceGlobal: (source) => (isZh() ? `全局（${source}）` : `global (${source})`),
      notCataloged: () => (isZh() ? '未收录' : 'Not cataloged'),
      notCatalogedHint: () => (isZh()
        ? '该 skill 存在于目录但未被官方目录收录（不注入会话）；可能是 filesystem 发现未启用或扫描器跳过'
        : 'This skill exists on disk but is not in the official catalog (not injected); filesystem discovery may be disabled or the scanner skipped it'),
      disabledHint: () => (isZh()
        ? '禁用的 skill 不再注入本项目/全局会话：模型不可见、不可加载（占位覆盖）'
        : 'A disabled skill is no longer injected into this scope: the model cannot see or load it (placeholder override)'),
      projectRoot: () => (isZh() ? '项目根：' : 'Project root: '),
      projectConfigNote: () => (isZh()
        ? '项目配置随仓库提交，可版本化；全局配置存于 $DSH_HOME'
        : 'Project config travels with the repo; global config lives in $DSH_HOME'),
      saved: () => (isZh() ? '已保存' : 'Saved'),
      saveFailed: () => (isZh() ? '保存失败' : 'Save failed'),
      diagnosticsTitle: () => (isZh() ? '扫描诊断' : 'Scan diagnostics'),
      diagnosticsHint: () => (isZh()
        ? '以下条目存在于 skill 目录但未被收录（可能被官方扫描器跳过）：'
        : 'These entries exist in a skill directory but were not cataloged (likely skipped by the scanner):'),
      diagReason: (reason) => (isZh() ? ({
        'broken-symlink': '符号链接无法解析（目标不存在）',
        'missing-skills-md': '目录缺少 SKILL.md',
        'missing-frontmatter': '缺少 YAML frontmatter',
        'missing-name-description': 'frontmatter 缺少 name 或 description',
        'invalid-name': 'skill 名称不符合 kebab-case 规范',
        'unparseable': 'frontmatter 解析失败或字段异常（官方扫描器未收录）',
      }[reason] ?? reason) : reason),
    }

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

    const STYLE_TAG = 'data-dsh-my-skill-manager'

        // ── api: fetch helpers for the Skill Manager views ─────────────────────
    const API_BASE = '/my-skill-manager/api'

    /** One GET list payload into { skills, globalDisabled, projectDisabled, cwd, projectRoot, diagnostics }. */
    function normalizeList(value) {
      return {
        skills: Array.isArray(value.skills) ? value.skills : [],
        globalDisabled: value.global?.disabled ?? [],
        projectDisabled: Array.isArray(value.project) ? value.project : [],
        cwd: value.cwd ?? '',
        projectRoot: value.projectRoot ?? '',
        diagnostics: value.diagnostics ?? { missing: [] },
      }
    }

    /** GET /my-skill-manager/api/list → normalized value; rejects on bad responses. */
    function fetchList(cwd) {
      const query = cwd.trim() === '' ? '' : `?cwd=${encodeURIComponent(cwd.trim())}`
      return fetch(`${API_BASE}/list${query}`)
        .then((res) => res.json())
        .then((body) => {
          if (body === null || body.ok !== true) throw new Error('bad list response')
          return normalizeList(body.value)
        })
    }

    /** GET /my-skill-manager/api/rescan → invalidate + fresh normalized value. */
    function rescanCatalog(cwd) {
      const query = cwd.trim() === '' ? '' : `?cwd=${encodeURIComponent(cwd.trim())}`
      return fetch(`${API_BASE}/rescan${query}`)
        .then((res) => res.json())
        .then((body) => {
          if (body === null || body.ok !== true) throw new Error('rescan failed')
          return normalizeList(body.value)
        })
    }

    /** PUT /my-skill-manager/api/config; rejects on bad responses. */
    function saveConfig(scope, disabled, cwd) {
      return fetch(`${API_BASE}/config`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope, disabled, cwd }),
      })
        .then((res) => res.json())
        .then((body) => {
          if (body === null || body.ok !== true) throw new Error('save failed')
        })
    }

        // ── view: Skill Manager settings tab ───────────────────────────────────
    function isProjectSource(source) {
      return typeof source === 'string' && source.startsWith('project-')
    }

    /** Toggle one name in a disabled list (remove when disabling, add when enabling). */
    function flipDisabled(list, name, isDisabled) {
      return isDisabled ? list.filter((n) => n !== name) : [...new Set([...list, name])]
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
      const load = (cwd) => refreshWith(fetchList, cwd)
      const rescan = (cwd) => refreshWith(rescanCatalog, cwd)
      const save = (scope, disabled, cwd) => {
        setSaved(false)
        setError(false)
        saveConfig(scope, disabled, cwd)
          .then(() => {
            setSaved(true)
            load(scope === 'project' ? (cwd || '') : '')
          })
          .catch(() => setError(true))
      }
      return {
        load,
        rescan,
        toggle: (data, scope, name, isDisabled) => {
          if (scope === 'project' && data.cwd === '') return
          const list = scope === 'global' ? data.globalDisabled : data.projectDisabled
          save(scope, flipDisabled(list, name, isDisabled), scope === 'project' ? data.cwd : '')
        },
      }
    }

    function SkillManagerView() {
      const [data, setData] = useState(null)
      const [pathInput, setPathInput] = useState('')
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState(false)
      const [saved, setSaved] = useState(false)
      const actions = createActions({ setData, setLoading, setError, setSaved })

      useEffect(() => {
        actions.load('')
      }, [])

      return createElement('div', { className: 'dsm-root' },
        createElement(Toolbar, { pathInput, onInput: setPathInput, onLoad: actions.load, onRescan: actions.rescan }),
        error ? createElement('div', { className: 'dsm-error' }, strings.loadError()) : null,
        loading ? createElement('div', { className: 'dsm-status' }, strings.loading())
          : data === null ? null : createElement(Sections, {
            data,
            saved,
            onToggle: (scope, name, isDisabled) => actions.toggle(data, scope, name, isDisabled),
          }),
      )
    }

    /** Path input + refresh button + project config note. */
    function Toolbar({ pathInput, onInput, onLoad, onRescan }) {
      return createElement('div', null,
        createElement('div', { className: 'dsm-pathbar' },
          createElement('input', {
            className: 'dsm-path-input',
            placeholder: strings.projectHint(),
            value: pathInput,
            onChange: (event) => onInput(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') onLoad(pathInput)
            },
          }),
          createElement('button', {
            className: 'dsm-btn',
            'aria-label': strings.loadProject(),
            onClick: () => onLoad(pathInput),
          }, strings.loadProject()),
          createElement('button', {
            className: 'dsm-btn',
            'aria-label': strings.refresh(),
            onClick: () => onRescan(pathInput),
          }, strings.refresh()),
        ),
        createElement('div', { className: 'dsm-note' }, strings.projectConfigNote()),
      )
    }

    /** The toggle section for the current view (global or project) + diagnostics. */
    function Sections({ data, saved, onToggle }) {
      const projectMode = data.cwd !== ''
      return createElement('div', null,
        projectMode
          ? createElement(SectionBlock, {
            title: projectTitleOf(data),
            hint: strings.disabledHint(),
            skills: data.skills,
            disabledNames: data.projectDisabled,
            onToggle: (name, isDisabled) => onToggle('project', name, isDisabled),
          })
          : createElement(SectionBlock, {
            title: strings.globalSection(),
            hint: strings.disabledHint(),
            skills: data.skills,
            disabledNames: data.globalDisabled,
            onToggle: (name, isDisabled) => onToggle('global', name, isDisabled),
          }),
        createElement(DiagnosticsBlock, { diagnostics: data.diagnostics }),
        saved ? createElement('div', { className: 'dsm-status dsm-saved' }, strings.saved()) : null,
      )
    }

    /** Skipped skill entries reported by the server-side directory scan. */
    function DiagnosticsBlock({ diagnostics }) {
      const missing = diagnostics?.missing ?? []
      if (missing.length === 0) return null
      return createElement('div', { className: 'dsm-section' },
        createElement('div', { className: 'dsm-section-title' }, strings.diagnosticsTitle()),
        createElement('div', { className: 'dsm-hint' }, strings.diagnosticsHint()),
        missing.map((item) => createElement('div', { key: item.path, className: 'dsm-diag-row' },
          createElement('span', { className: 'dsm-name' }, item.name),
          createElement('span', { className: 'dsm-diag-reason' }, strings.diagReason(item.reason)),
          createElement('span', { className: 'dsm-diag-path' }, item.path),
        )),
      )
    }

    function projectTitleOf(data) {
      return data.projectRoot === ''
        ? strings.projectSection()
        : `${strings.projectSection()} · ${strings.projectRoot()}${data.projectRoot}`
    }

    function SectionBlock({ title, hint, skills, disabledNames, onToggle, locked }) {
      const rows = skills.map((skill) =>
        createElement(SkillRow, {
          key: skill.name,
          skill,
          disabled: disabledNames.includes(skill.name),
          locked,
          onToggle: () => onToggle(skill.name, disabledNames.includes(skill.name)),
        }),
      )
      return createElement('div', { className: 'dsm-section' },
        createElement('div', { className: 'dsm-section-title' }, title),
        createElement('div', { className: 'dsm-hint' }, hint),
        rows.length === 0 ? createElement('div', { className: 'dsm-empty' }, strings.empty())
          : rows,
      )
    }

    function SkillRow({ skill, disabled, locked, onToggle }) {
      return createElement('div', { className: `dsm-row${disabled ? ' dsm-row-disabled' : ''}` },
        createElement('div', { className: 'dsm-row-head' },
          createElement('span', { className: 'dsm-name' }, skill.name),
          skill.cataloged === false
            ? createElement('span', { className: 'dsm-src dsm-src-warn', title: strings.notCatalogedHint() }, strings.notCataloged())
            : null,
          createElement('span', { className: 'dsm-src' },
            isProjectSource(skill.source) ? strings.sourceProject(skill.source) : strings.sourceGlobal(skill.source)),
          createElement('button', {
            className: `dsm-toggle${disabled ? ' dsm-toggle-on' : ''}`,
            disabled: locked,
            onClick: onToggle,
            'aria-label': `${skill.name}: ${disabled ? strings.disabled() : strings.enabled()}`,
          }, disabled ? strings.disabled() : strings.enabled()),
        ),
        createElement('div', { className: 'dsm-desc' }, skill.description),
      )
    }

        // ── plugin body ───────────────────────────────────────────────────────
    // 零第三方依赖：面板挂在官方 slots 扩展点（设置 → 插件 → Skill 管理），
    // 不依赖 dsh-better-sidebar。slots 服务是官方 client 服务，通过
    // ctx.get 动态获取——服务缺省时静默跳过（不注册 tab，server 端禁用
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
      }, 'dsh-my-skill-manager: styles')

      const slots = ctx.get('slots')
      if (slots === undefined) return

      ctx.effect(() => slots.inject('settings.plugins.tab', () => slots.register({
        name: 'settings.plugins.tab',
        id: 'my-skill-manager',
        order: 90,
        label: () => strings.title(),
      }, SkillManagerView)), 'dsh-my-skill-manager: settings tab registration')
    }


    return module.exports
  },
})
