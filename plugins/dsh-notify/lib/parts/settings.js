    // ── 设置页视图：配置可视化（issue #27，官方 slots 扩展点）──────────
    const SETTINGS_STYLES = `
.dns-settings{display:flex;flex-direction:column;gap:10px;padding:12px}
.dns-section{display:flex;flex-direction:column;gap:8px}
.dns-section-title{font:var(--dsw-font-xs-strong-13);color:var(--dsw-alias-label-secondary)}
.dns-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.dns-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.dns-label{font:var(--dsw-font-xs-strong-13)}
.dns-hint{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);line-height:1.5}
.dns-toggle{flex:none;width:34px;height:20px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);position:relative;cursor:pointer;transition:background 120ms var(--ds-ease-in-out)}
.dns-toggle[data-on="true"]{background:var(--dsw-alias-state-info-primary);border-color:transparent}
.dns-toggle::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-primary);transition:transform 120ms var(--ds-ease-in-out)}
.dns-toggle[data-on="true"]::after{transform:translateX(12px)}
.dns-input{flex:none;width:180px;height:28px;padding:0 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12)}
.dns-actions{display:flex;align-items:center;gap:8px}
.dns-btn{height:28px;padding:0 14px;border-radius:6px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12)}
.dns-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dns-saved{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-success-primary)}
.dns-error{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-danger-primary)}
.dns-status{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary)}
`

    /** 开关行（布尔配置项）。 */
    function SwitchRow({ label, hint, on, onChange }) {
      return createElement('div', { className: 'dns-row' },
        createElement('div', { className: 'dns-info' },
          createElement('div', { className: 'dns-label' }, label),
          createElement('div', { className: 'dns-hint' }, hint),
        ),
        createElement('div', {
          className: 'dns-toggle',
          'data-on': String(on),
          role: 'switch',
          'aria-checked': String(on),
          onClick: () => onChange(!on),
        }),
      )
    }

    /** 输入行（文本/数字配置项）。 */
    function TextRow({ label, hint, value, onChange, type }) {
      return createElement('div', { className: 'dns-row' },
        createElement('div', { className: 'dns-info' },
          createElement('div', { className: 'dns-label' }, label),
          createElement('div', { className: 'dns-hint' }, hint),
        ),
        createElement('input', {
          className: 'dns-input',
          type: type ?? 'text',
          value,
          onChange: (event) => onChange(event.target.value),
        }),
      )
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

      const save = () => {
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

      if (loading) {
        return createElement('div', { className: 'dns-settings' }, createElement('div', { className: 'dns-status' }, strings.loading()))
      }
      if (config === null) {
        return createElement('div', { className: 'dns-settings' }, createElement('div', { className: 'dns-error' }, strings.loadError()))
      }
      const patch = (key, value) => setDraft({ ...draft, [key]: value })
      return createElement('div', { className: 'dns-settings' },
        createElement('div', { className: 'dns-section' },
          createElement('div', { className: 'dns-section-title' }, strings.settingsTriggers()),
          createElement(SwitchRow, { label: strings.settingsEnd(), hint: strings.settingsEndHint(), on: draft.end === true, onChange: (v) => patch('end', v) }),
          createElement(SwitchRow, { label: strings.settingsAsk(), hint: strings.settingsAskHint(), on: draft.ask === true, onChange: (v) => patch('ask', v) }),
          createElement(SwitchRow, { label: strings.settingsApproval(), hint: strings.settingsApprovalHint(), on: draft.approval === true, onChange: (v) => patch('approval', v) }),
          createElement(SwitchRow, { label: strings.settingsSubagentEnd(), hint: strings.settingsSubagentEndHint(), on: draft.subagentEnd === true, onChange: (v) => patch('subagentEnd', v) }),
        ),
        createElement('div', { className: 'dns-section' },
          createElement('div', { className: 'dns-section-title' }, strings.settingsAdvanced()),
          createElement(TextRow, { label: strings.settingsApiToken(), hint: strings.settingsApiTokenHint(), value: draft.apiToken ?? '', onChange: (v) => patch('apiToken', v) }),
          createElement(TextRow, { label: strings.settingsDedupeMs(), hint: strings.settingsDedupeMsHint(), value: String(draft.dedupeMs ?? 3000), type: 'number', onChange: (v) => patch('dedupeMs', Number(v)) }),
        ),
        createElement('div', { className: 'dns-actions' },
          createElement('button', { className: 'dns-btn', onClick: save }, strings.save()),
          saved ? createElement('span', { className: 'dns-saved' }, strings.saved()) : null,
          error ? createElement('span', { className: 'dns-error' }, strings.saveFailed()) : null,
        ),
      )
    }

    /** 设置页 tab 注册（官方 slots 扩展点；服务缺省时静默跳过）。 */
    function attachSettingsTab(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return
      ctx.effect(() => {
        if (typeof document === 'undefined' || typeof document.head === 'undefined') return () => {}
        const style = document.createElement('style')
        style.setAttribute('data-dsh-notify-settings', 'styles')
        style.textContent = SETTINGS_STYLES
        document.head.appendChild(style)
        return () => {
          if (style.parentNode !== null) style.parentNode.removeChild(style)
        }
      }, 'dsh-notify: settings styles')
      ctx.effect(() => slots.inject('settings.plugins.tab', () => slots.register({
        name: 'settings.plugins.tab',
        id: 'notify-settings',
        order: 91,
        label: () => strings.settingsTitle(),
      }, NotifySettingsView)), 'dsh-notify: settings tab registration')
    }
