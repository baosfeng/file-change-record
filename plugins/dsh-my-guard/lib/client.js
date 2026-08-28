/**
 * dsh-my-guard — client half (browser). SOURCE TEMPLATE.
 *
 * 提供侧边栏页签「安全护栏」（dsh-my-guard:guard）：
 *  - 告警列表：破坏性命令 / 投毒扫描 / 提示注入三类告警（类型徽标 +
 *    严重度 + 时间 + 消息 + 详情），每条可「确认」（用户确认机制）；
 *  - 投毒扫描工具：输入包名/本地路径 → 扫描 → 显示发现项；
 *  - 提示注入检测工具：输入文本 → 检测 → 显示命中规则。
 *
 * 面板可见（visible）时轮询（GUARD_POLL_MS），隐藏时暂停（省请求）。
 * 样式走 DSH 语义 token（--dsw-alias-* / --dsw-font-*），随 activation
 * 注入、fiber teardown 卸载（HMR/禁用无残留）。
 *
 * BUILD NOTE: 本文件是模板源码，不是 DSH 实际服务的文件。scripts/build.mjs
 * 将三个片段文件（lib/parts/i18n.js / panel.js / styles.js，均为无
 * import/export 的纯函数声明文本）经下方 __PART_*__ 占位符（函数式
 * replaceAll，避免 $&/$1 特殊解释）拼接进 factory 作用域，写出
 * lib/client.js —— 即 DSH 实际服务的产物。产物必须提交；CI 只对产物执行
 * node --check（见 .github/workflows/ci.yml）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-my-guard',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useEffect, useState } = require('react')

    // ── parts（scripts/build.mjs 拼接；顺序固定）───────────────────────
        // ── i18n（浏览器语言判定）──────────────────────────────────────────
    function isZh() {
      try {
        const lang = (navigator.language || 'en').toLowerCase()
        return lang.startsWith('zh')
      } catch {
        return false
      }
    }

    const strings = {
      tabTitle: () => (isZh() ? '安全护栏' : 'Guard'),
      alertsTitle: () => (isZh() ? '告警记录' : 'Alerts'),
      scanTitle: () => (isZh() ? '投毒扫描' : 'Poison scan'),
      promptTitle: () => (isZh() ? '提示注入检测' : 'Injection check'),
      emptyAlerts: () => (isZh() ? '暂无告警——破坏性命令、投毒内容与提示注入命中会出现在这里' : 'No alerts yet — destructive commands, poisoned packages and injection hits will appear here'),
      loadError: () => (isZh() ? '加载失败' : 'Load failed'),
      loading: () => (isZh() ? '加载中…' : 'Loading…'),
      typeDestructive: () => (isZh() ? '破坏性命令' : 'Destructive'),
      typePoison: () => (isZh() ? '投毒扫描' : 'Poison'),
      typeInjection: () => (isZh() ? '提示注入' : 'Injection'),
      sevHigh: () => (isZh() ? '高' : 'high'),
      sevMedium: () => (isZh() ? '中' : 'medium'),
      sevLow: () => (isZh() ? '低' : 'low'),
      confirmed: () => (isZh() ? '已确认' : 'confirmed'),
      confirm: () => (isZh() ? '确认' : 'Confirm'),
      scanPlaceholder: () => (isZh() ? '包名或本地路径，如 dsh-my-guard' : 'package name or path, e.g. dsh-my-guard'),
      scan: () => (isZh() ? '扫描' : 'Scan'),
      scanResult: () => (isZh() ? '扫描结果' : 'Scan result'),
      scanClean: () => (isZh() ? '未发现可疑内容' : 'No suspicious content found'),
      scanError: () => (isZh() ? '扫描失败' : 'Scan failed'),
      findings: (count) => (isZh() ? `${count} 个发现项` : `${count} finding(s)`),
      promptPlaceholder: () => (isZh() ? '输入要检测的文本…' : 'text to check…'),
      check: () => (isZh() ? '检测' : 'Check'),
      checkResult: () => (isZh() ? '检测结果' : 'Result'),
      checkClean: () => (isZh() ? '未命中注入规则' : 'No injection rules hit'),
      checkHits: (count) => (isZh() ? `命中 ${count} 条规则` : `${count} rule(s) hit`),
      file: () => (isZh() ? '文件' : 'file'),
      rule: () => (isZh() ? '规则' : 'rule'),
      noTarget: () => (isZh() ? '请输入包名或路径' : 'Enter a package name or path'),
      noText: () => (isZh() ? '请输入要检测的文本' : 'Enter text to check'),
      modeLabel: () => (isZh() ? '护栏模式' : 'Guard mode'),
      modeObserve: () => (isZh() ? '观察（只告警）' : 'Observe'),
      modeAsk: () => (isZh() ? '确认（审批）' : 'Ask'),
      modeDeny: () => (isZh() ? '拦截' : 'Deny'),
    }

        // ── 安全护栏面板 ────────────────────────────────────────────────────
    const GUARD_POLL_MS = 5000

    /** 请求插件 API（非 2xx 抛错；返回响应 JSON 的 value 字段）。 */
    function apiJson(path, options) {
      return fetch(path, options).then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`)
        return data.value
      })
    }

    /** 时间戳 → HH:MM:SS。 */
    function timeText(time) {
      try {
        const date = new Date(time)
        const pad = (n) => String(n).padStart(2, '0')
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
      } catch {
        return ''
      }
    }

    /** 告警类型 → 中文标签。 */
    function alertTypeLabel(type) {
      if (type === 'destructive') return strings.typeDestructive()
      if (type === 'poison') return strings.typePoison()
      if (type === 'injection') return strings.typeInjection()
      return type
    }

    /** 严重度 → 中文标签。 */
    function severityLabel(severity) {
      if (severity === 'high') return strings.sevHigh()
      if (severity === 'medium') return strings.sevMedium()
      return strings.sevLow()
    }

    /** 告警类型 → 徽标样式类别。 */
    function badgeKind(alert) {
      if (alert.type === 'destructive') return 'danger'
      if (alert.type === 'poison') return 'warn'
      return 'info'
    }

    /** 单条告警行（徽标 + 时间 + 消息 + 确认按钮）。 */
    function AlertRow({ alert, onConfirm }) {
      const detail = alert.detail || {}
      const meta = detail.command !== undefined
        ? detail.command
        : detail.file !== undefined
          ? `${strings.file()} ${detail.file}`
          : detail.rule !== undefined
            ? `${strings.rule()} ${detail.rule}`
            : ''
      return createElement('div', { className: 'dso-alert' },
        createElement('div', { className: 'dso-alert-head' },
          createElement('span', { className: `dso-badge dso-badge-${badgeKind(alert)}` }, alertTypeLabel(alert.type)),
          createElement('span', { className: `dso-sev dso-sev-${alert.severity}` }, severityLabel(alert.severity)),
          createElement('span', { className: 'dso-time' }, timeText(alert.time)),
        ),
        createElement('div', { className: 'dso-alert-msg' }, alert.message),
        meta !== '' ? createElement('div', { className: 'dso-alert-meta' }, meta) : null,
        alert.confirmed
          ? createElement('div', { className: 'dso-alert-confirmed' }, strings.confirmed())
          : createElement('button', { className: 'dso-btn dso-btn-small', onClick: () => onConfirm(alert.id) }, strings.confirm()),
      )
    }

    /** 拉取告警列表。 */
    async function loadAlerts(setters) {
      try {
        setters.setAlerts(await apiJson('/guard/api/alerts?limit=200'))
        setters.setError('')
      } catch (err) {
        setters.setError(err instanceof Error ? err.message : String(err))
      } finally {
        setters.setLoading(false)
      }
    }

    /** 确认告警（用户确认机制）。 */
    async function confirmAlert(id, setAlerts) {
      try {
        await apiJson('/guard/api/alerts/confirm', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, confirmed: true } : a)))
      } catch {
        // 确认失败静默（下次轮询恢复真实状态）
      }
    }

    /** 扫描结果展示（发现项列表）。 */
    function ScanResult({ result }) {
      const findings = result?.findings || []
      return createElement('div', { className: 'dso-feedback' },
        findings.length === 0
          ? strings.scanClean()
          : `${strings.findings(findings.length)}：`,
        findings.length > 0
          ? findings.map((f, index) => createElement('div', { key: index, className: `dso-issue dso-issue-${f.severity}` },
            createElement('div', { className: 'dso-issue-sev' }, severityLabel(f.severity)),
            createElement('div', { className: 'dso-issue-msg' }, f.message),
            createElement('div', { className: 'dso-issue-rule' }, `${f.file} · ${f.pattern}`),
          ))
          : null,
      )
    }

    /** 执行投毒扫描（target 校验 + 请求 + 状态管理）。 */
    async function runScan(target, setters) {
      const value = target.trim()
      if (value === '') {
        setters.setError(strings.noTarget())
        return
      }
      setters.setBusy(true)
      setters.setError('')
      try {
        setters.setResult(await apiJson('/guard/api/scan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ target: value }),
        }))
      } catch (err) {
        setters.setError(err instanceof Error ? err.message : String(err))
        setters.setResult(null)
      } finally {
        setters.setBusy(false)
      }
    }

    /** 投毒扫描工具：输入包名/路径 → 扫描 → 显示发现项。 */
    function ScanTool() {
      const [target, setTarget] = useState('')
      const [result, setResult] = useState(null)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const run = () => runScan(target, { setResult, setBusy, setError })
      return createElement('div', { className: 'dso-section' },
        createElement('div', { className: 'dso-section-title' }, strings.scanTitle()),
        createElement('div', { className: 'dso-repo-row' },
          createElement('input', {
            className: 'dso-input dso-repo-input',
            value: target,
            placeholder: strings.scanPlaceholder(),
            onChange: (e) => setTarget(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Enter') void run() },
          }),
          createElement('button', { className: 'dso-btn dso-btn-primary', disabled: busy, onClick: () => void run() }, strings.scan()),
        ),
        error !== '' ? createElement('div', { className: 'dso-feedback dso-feedback-error' }, `${strings.scanError()}：${error}`) : null,
        result !== null ? createElement(ScanResult, { result }) : null,
      )
    }

    /** 注入检测结果展示（命中规则列表）。 */
    function PromptResult({ hits }) {
      return createElement('div', { className: 'dso-feedback' },
        hits.length === 0
          ? strings.checkClean()
          : `${strings.checkHits(hits.length)}：`,
        hits.length > 0
          ? hits.map((h, index) => createElement('div', { key: index, className: `dso-issue dso-issue-${h.severity}` },
            createElement('div', { className: 'dso-issue-sev' }, severityLabel(h.severity)),
            createElement('div', { className: 'dso-issue-msg' }, h.message),
            createElement('div', { className: 'dso-issue-rule' }, h.id),
          ))
          : null,
      )
    }

    /** 提示注入检测工具：输入文本 → 检测 → 显示命中规则。 */
    function PromptTool() {
      const [text, setText] = useState('')
      const [hits, setHits] = useState(null)
      const [error, setError] = useState('')
      const run = async () => {
        const value = text.trim()
        if (value === '') {
          setError(strings.noText())
          return
        }
        setError('')
        try {
          const result = await apiJson('/guard/api/scan-prompt', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: value }),
          })
          setHits(result.hits)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
          setHits(null)
        }
      }
      return createElement('div', { className: 'dso-section' },
        createElement('div', { className: 'dso-section-title' }, strings.promptTitle()),
        createElement('textarea', {
          className: 'dso-input dso-textarea',
          value: text,
          placeholder: strings.promptPlaceholder(),
          onChange: (e) => setText(e.target.value),
        }),
        createElement('button', { className: 'dso-btn dso-btn-primary', onClick: () => void run() }, strings.check()),
        error !== '' ? createElement('div', { className: 'dso-feedback dso-feedback-error' }, `${strings.loadError()}：${error}`) : null,
        hits !== null ? createElement(PromptResult, { hits }) : null,
      )
    }

    /** 安全护栏主面板：告警列表 + 扫描工具 + 注入检测工具（可见时轮询）。 */
    function GuardPanel(props) {
      const visible = props.visible !== false
      const [alerts, setAlerts] = useState([])
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')

      useEffect(() => {
        if (!visible) return undefined
        let alive = true
        const setters = { setAlerts, setError, setLoading }
        const tick = () => { if (alive) void loadAlerts(setters) }
        tick()
        const timer = setInterval(tick, GUARD_POLL_MS)
        return () => { alive = false; clearInterval(timer) }
      }, [visible])

      const rows = alerts.map((alert) => createElement(AlertRow, {
        key: alert.id,
        alert,
        onConfirm: (id) => void confirmAlert(id, setAlerts),
      }))

      return createElement('div', { className: 'dso-panel' },
        createElement('div', { className: 'dso-section-title' }, strings.alertsTitle()),
        error !== '' ? createElement('div', { className: 'dso-empty' }, `${strings.loadError()}：${error}`) : null,
        loading && error === '' ? createElement('div', { className: 'dso-empty' }, strings.loading()) : null,
        !loading && error === '' && alerts.length === 0
          ? createElement('div', { className: 'dso-empty' }, strings.emptyAlerts())
          : null,
        createElement('div', { className: 'dso-timeline' }, rows),
        createElement(ScanTool, null),
        createElement(PromptTool, null),
      )
    }

        // ── 样式（DSH 语义 token，随 activation 注入 / teardown 卸载）──────
    const STYLES = `
.dso-panel{display:flex;flex-direction:column;gap:10px;padding:12px;color:var(--dsw-alias-label-primary)}
.dso-timeline{display:flex;flex-direction:column;gap:6px;max-height:calc(100vh - 320px);overflow-y:auto}
.dso-alert{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px}
.dso-alert-head{display:flex;align-items:center;gap:8px;justify-content:space-between}
.dso-badge{flex:none;font:var(--dsw-font-xxxs-strong-11);border-radius:4px;padding:1px 6px}
.dso-badge-danger{color:var(--dsw-alias-state-danger-primary);background:color-mix(in srgb, var(--dsw-alias-state-danger-primary) 14%, transparent)}
.dso-badge-warn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent)}
.dso-badge-info{color:var(--dsw-alias-state-info-primary);background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 14%, transparent)}
.dso-sev{flex:none;font:var(--dsw-font-xxxs-strong-11);border-radius:4px;padding:1px 6px}
.dso-sev-high{color:var(--dsw-alias-state-danger-primary);background:color-mix(in srgb, var(--dsw-alias-state-danger-primary) 10%, transparent)}
.dso-sev-medium{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent)}
.dso-sev-low{color:var(--dsw-alias-state-info-primary);background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 10%, transparent)}
.dso-time{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}
.dso-alert-msg{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);line-height:1.5;margin-top:4px;word-break:break-word}
.dso-alert-meta{font:var(--dsw-font-mono-xxs);font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.5;margin-top:2px;word-break:break-all}
.dso-alert-confirmed{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-state-success-primary);margin-top:4px}
.dso-empty{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center;padding:16px 8px;line-height:1.7}
.dso-section{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:8px}
.dso-section-title{font:var(--dsw-font-xs-strong-13);color:var(--dsw-alias-label-primary)}
.dso-repo-row{display:flex;gap:8px;align-items:center}
.dso-repo-input{flex:1}
.dso-input{flex:1;min-width:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 8px}
.dso-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.dso-textarea{min-height:52px;resize:vertical;font:var(--dsw-font-xxs-12)}
.dso-btn{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);
  border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 12px;cursor:pointer}
.dso-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dso-btn:disabled{opacity:.5;cursor:default}
.dso-btn-small{padding:2px 8px;font:var(--dsw-font-xxxs-strong-11);margin-top:4px}
.dso-btn-primary{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-interactive-primary);
  background:color-mix(in srgb, var(--dsw-alias-interactive-primary) 16%, transparent)}
.dso-feedback{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);word-break:break-all;line-height:1.5}
.dso-feedback-error{color:var(--dsw-alias-state-danger-primary)}
.dso-issue{display:flex;flex-direction:column;gap:2px;border-radius:6px;padding:6px 8px;font:var(--dsw-font-xxs-12)}
.dso-issue-high{background:color-mix(in srgb, var(--dsw-alias-state-danger-primary) 12%, transparent)}
.dso-issue-medium{background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent)}
.dso-issue-low{background:color-mix(in srgb, var(--dsw-alias-state-info-primary) 10%, transparent)}
.dso-issue-sev{font:var(--dsw-font-xxxs-strong-11);text-transform:uppercase}
.dso-issue-high .dso-issue-sev{color:var(--dsw-alias-state-danger-primary)}
.dso-issue-medium .dso-issue-sev{color:var(--dsw-alias-state-warn-primary)}
.dso-issue-low .dso-issue-sev{color:var(--dsw-alias-state-info-primary)}
.dso-issue-rule{font:var(--dsw-font-mono-xxs);font-size:11px;color:var(--dsw-alias-label-secondary)}
.dso-issue-msg{color:var(--dsw-alias-label-primary);line-height:1.5}
`

    function injectStyles() {
      if (typeof document === 'undefined' || typeof document.head === 'undefined') return () => {}
      const style = document.createElement('style')
      style.setAttribute('data-dsh-my-guard', 'styles')
      style.textContent = STYLES
      document.head.appendChild(style)
      return () => {
        if (style.parentNode !== null) style.parentNode.removeChild(style)
      }
    }


    // ── 插件体：样式注入 + 页签注册 ─────────────────────────────────────
    exports.inject = ['betterSidebar']

    exports.apply = function apply(ctx) {
      ctx.effect(() => injectStyles(), 'dsh-my-guard: styles')
      const service = ctx.betterSidebar
      if (service === undefined) return
      ctx.effect(() => service.registerTab({
        id: 'dsh-my-guard:guard',
        title: () => strings.tabTitle(),
        order: 42,
        single: true,
        component: (props) => createElement(GuardPanel, props),
      }), 'dsh-my-guard: guard tab registration')
    }

    return module.exports
  },
})
