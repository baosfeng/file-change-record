// ── 设置页视图：配置可视化（issue #27，官方 slots 扩展点）──────────
const SETTINGS_STYLES = `
.dsh-my-notify-settings{display:flex;flex-direction:column;gap:10px;padding:12px}
.dsh-my-notify-section{display:flex;flex-direction:column;gap:8px}
.dsh-my-notify-section-title{font:var(--dsw-font-xs-strong-13);color:var(--dsw-alias-label-secondary)}
.dsh-my-notify-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.dsh-my-notify-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.dsh-my-notify-label{font:var(--dsw-font-xs-strong-13)}
.dsh-my-notify-hint{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);line-height:1.5}
/* issue #58: toggle 开关开/关一眼可分——关态用灰色轨道（tertiary 混合，
   浅色主题下不再白底融入设置面板背景），开态圆点换对比墨色（foreground），
   强化视觉差异；样式与 dsh-my-skill-manager-switch 的轨道/圆点方案一致 */
.dsh-my-notify-toggle{flex:none;width:34px;height:20px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb, var(--dsw-alias-label-tertiary) 30%, transparent);position:relative;cursor:pointer;transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out),border-color var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-my-notify-toggle[data-on="true"]{background:var(--dsw-alias-state-success-primary);border-color:transparent}
.dsh-my-notify-toggle::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-primary);transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out),background var(--ds-transition-duration-slow) var(--ds-ease-in-out)}
.dsh-my-notify-toggle[data-on="true"]::after{transform:translateX(12px);background:var(--dsw-alias-label-primary-foreground)}
.dsh-my-notify-input{flex:none;width:180px;height:28px;padding:0 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12)}
.dsh-my-notify-actions{display:flex;align-items:center;gap:8px}
.dsh-my-notify-btn{height:28px;padding:0 14px;border-radius:6px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12)}
.dsh-my-notify-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-my-notify-saved{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-success-primary)}
.dsh-my-notify-error{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-danger-primary)}
.dsh-my-notify-status{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary)}
`

/** 开关行（布尔配置项）。 */
function SwitchRow({ label, hint, on, onChange }) {
  return createElement(
    'div',
    { className: 'dsh-my-notify-row' },
    createElement(
      'div',
      { className: 'dsh-my-notify-info' },
      createElement('div', { className: 'dsh-my-notify-label' }, label),
      createElement('div', { className: 'dsh-my-notify-hint' }, hint),
    ),
    createElement('div', {
      className: 'dsh-my-notify-toggle',
      'data-on': String(on),
      role: 'switch',
      'aria-checked': String(on),
      onClick: () => onChange(!on),
    }),
  )
}

/** 输入行（文本/数字配置项）。 */
function TextRow({ label, hint, value, onChange, type }) {
  return createElement(
    'div',
    { className: 'dsh-my-notify-row' },
    createElement(
      'div',
      { className: 'dsh-my-notify-info' },
      createElement('div', { className: 'dsh-my-notify-label' }, label),
      createElement('div', { className: 'dsh-my-notify-hint' }, hint),
    ),
    createElement('input', {
      className: 'dsh-my-notify-input',
      type: type ?? 'text',
      value,
      onChange: (event) => onChange(event.target.value),
    }),
  )
}

/** 设置表单渲染（触发开关 + 高级项 + 保存动作）。 */
function renderSettingsForm(draft, patch, save, saved, error) {
  return createElement(
    'div',
    { className: 'dsh-my-notify-settings' },
    createElement(
      'div',
      { className: 'dsh-my-notify-section' },
      createElement('div', { className: 'dsh-my-notify-section-title' }, strings.settingsTriggers()),
      createElement(SwitchRow, {
        label: strings.settingsEnd(),
        hint: strings.settingsEndHint(),
        on: draft.end === true,
        onChange: (v) => patch('end', v),
      }),
      createElement(SwitchRow, {
        label: strings.settingsAsk(),
        hint: strings.settingsAskHint(),
        on: draft.ask === true,
        onChange: (v) => patch('ask', v),
      }),
      createElement(SwitchRow, {
        label: strings.settingsApproval(),
        hint: strings.settingsApprovalHint(),
        on: draft.approval === true,
        onChange: (v) => patch('approval', v),
      }),
      createElement(SwitchRow, {
        label: strings.settingsSubagentEnd(),
        hint: strings.settingsSubagentEndHint(),
        on: draft.subagentEnd === true,
        onChange: (v) => patch('subagentEnd', v),
      }),
    ),
    createElement(
      'div',
      { className: 'dsh-my-notify-section' },
      createElement('div', { className: 'dsh-my-notify-section-title' }, strings.settingsAdvanced()),
      createElement(TextRow, {
        label: strings.settingsApiToken(),
        hint: strings.settingsApiTokenHint(),
        value: draft.apiToken ?? '',
        onChange: (v) => patch('apiToken', v),
      }),
      createElement(TextRow, {
        label: strings.settingsDedupeMs(),
        hint: strings.settingsDedupeMsHint(),
        value: String(draft.dedupeMs ?? 3000),
        type: 'number',
        onChange: (v) => patch('dedupeMs', Number(v)),
      }),
    ),
    createElement(
      'div',
      { className: 'dsh-my-notify-actions' },
      createElement('button', { className: 'dsh-my-notify-btn', onClick: save }, strings.save()),
      saved ? createElement('span', { className: 'dsh-my-notify-saved' }, strings.saved()) : null,
      error ? createElement('span', { className: 'dsh-my-notify-error' }, strings.saveFailed()) : null,
    ),
  )
}

/** 保存配置（PUT /notify/api/config），成功/失败更新状态。 */
function saveConfig(draft, setSaved, setError) {
  setSaved(false)
  setError(false)
  fetch('/notify/api/config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(draft),
  })
    .then((res) => res.json())
    .then((body) => {
      if (body === null || body.ok !== true) throw new Error('save failed')
      setSaved(true)
    })
    .catch(() => setError(true))
}

/** 设置页主视图：加载当前配置 → 表单编辑 → 保存（PUT /notify/api/config）。 */
function NotifySettingsView() {
  const [config, setConfig] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/notify/api/config')
      .then((res) => res.json())
      .then((body) => {
        if (body === null || body.ok !== true) throw new Error('bad config response')
        setConfig(body.value)
        setDraft(body.value)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        setError(true)
      })
  }, [])

  if (loading) {
    return createElement(
      'div',
      { className: 'dsh-my-notify-settings' },
      createElement('div', { className: 'dsh-my-notify-status' }, strings.loading()),
    )
  }
  if (config === null) {
    return createElement(
      'div',
      { className: 'dsh-my-notify-settings' },
      createElement('div', { className: 'dsh-my-notify-error' }, strings.loadError()),
    )
  }
  const patch = (key, value) => setDraft({ ...draft, [key]: value })
  const save = () => saveConfig(draft, setSaved, setError)
  return renderSettingsForm(draft, patch, save, saved, error)
}

/** 设置页 tab 注册（官方 slots 扩展点；服务缺省时静默跳过）。 */
function attachSettingsTab(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return
  ctx.effect(() => {
    if (typeof document === 'undefined' || typeof document.head === 'undefined') return () => {}
    const style = document.createElement('style')
    style.setAttribute('data-dsh-my-notify-settings', 'styles')
    style.textContent = SETTINGS_STYLES
    document.head.appendChild(style)
    return () => {
      if (style.parentNode !== null) style.parentNode.removeChild(style)
    }
  }, 'dsh-my-notify: settings styles')
  ctx.effect(
    () =>
      slots.inject('settings.plugins.tab', () =>
        slots.register(
          {
            name: 'settings.plugins.tab',
            id: 'notify-settings',
            order: 91,
            label: () => strings.settingsTitle(),
          },
          NotifySettingsView,
        ),
      ),
    'dsh-my-notify: settings tab registration',
  )
}
