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
  safeModeDesc: () =>
    isZh()
      ? '开启后所有候选/已转正插件都不再加载，用于快速恢复环境'
      : 'Skips every staged/promoted plugin mount — fast recovery',
  staged: () => (isZh() ? '候选' : 'staged'),
  promoted: () => (isZh() ? '转正' : 'promoted'),
  entries: () => (isZh() ? '插件条目' : 'Plugin entries'),
  empty: () => (isZh() ? '暂无候选插件' : 'No staged plugins'),
  emptyHint: () =>
    isZh()
      ? '新插件请写入 cordis.staged.json（与 cordis.patch.yml 同目录），启动后自动加载'
      : 'Add entries to cordis.staged.json next to cordis.patch.yml — they load on startup',
  running: () => (isZh() ? '运行中' : 'running'),
  pending: () => (isZh() ? '待加载' : 'pending'),
  failed: () => (isZh() ? '失败' : 'failed'),
  frozen: () => (isZh() ? '冻结' : 'frozen'),
  retry: () => (isZh() ? '重试' : 'Retry'),
  remove: () => (isZh() ? '移除' : 'Remove'),
  removeConfirm: () => (isZh() ? '移除该插件条目？' : 'Remove this plugin entry?'),
  removeConfirmDesc: () =>
    isZh()
      ? '将从名册中卸载并移除，候选区文件不受影响'
      : 'Unmounts and drops it from the roster; the staged file is untouched',
  cancel: () => (isZh() ? '取消' : 'Cancel'),
  confirmRemove: () => (isZh() ? '确认移除' : 'Remove'),
  expandError: () => (isZh() ? '错误详情' : 'Error details'),
  collapseError: () => (isZh() ? '收起' : 'Collapse'),
  loadError: () => (isZh() ? '加载失败' : 'Load failed'),
  loading: () => (isZh() ? '加载中…' : 'Loading…'),
  events: () => (isZh() ? '最近事件' : 'Recent events'),
  attempts: (n) => (isZh() ? `失败 ${n} 次` : `failed ×${n}`),
}

// ── api ───────────────────────────────────────────────────────────────
async function api(path, body) {
  const response = await fetch(
    `/guardian/api/${path}`,
    body === undefined
      ? { headers: { accept: 'application/json' } }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  )
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
    case 'running':
      return strings.running()
    case 'pending':
      return strings.pending()
    case 'failed':
      return strings.failed()
    case 'frozen':
      return strings.frozen()
    default:
      return status
  }
}

// ── event log ─────────────────────────────────────────────────────────
// Event type → badge label + color variant (mirrors the dfa-op chip style).
const EVENT_LABELS = {
  promote: () => (isZh() ? '转正' : 'Promoted'),
  'entry-init': () => (isZh() ? '初始化' : 'Init'),
  'entry-dispose': () => (isZh() ? '释放' : 'Disposed'),
  quarantine: () => (isZh() ? '隔离' : 'Quarantined'),
  freeze: () => (isZh() ? '冻结' : 'Frozen'),
  'update-failed': () => (isZh() ? '更新失败' : 'Update failed'),
  safe: () => (isZh() ? '安全模式' : 'Safe mode'),
  'safe-mode': () => (isZh() ? '安全模式' : 'Safe mode'),
  skip: () => (isZh() ? '跳过' : 'Skipped'),
}

/** Badge color variant for an event type; unknown types fall back to the
 *  neutral tertiary chip. */
function eventVariant(type) {
  switch (type) {
    case 'promote':
      return 'success'
    case 'entry-init':
      return 'accent'
    case 'quarantine':
    case 'update-failed':
      return 'danger'
    case 'freeze':
    case 'safe':
    case 'safe-mode':
      return 'warn'
    default:
      return 'neutral'
  }
}

function eventLabel(type) {
  return (EVENT_LABELS[type] ?? (() => type))()
}
