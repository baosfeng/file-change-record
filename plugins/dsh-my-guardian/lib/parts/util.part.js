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
  empty: () =>
    isZh()
      ? '暂无候选插件。新插件请写入 cordis.staged.json（与 cordis.patch.yml 同目录）'
      : 'No staged plugins. Add entries to cordis.staged.json next to cordis.patch.yml',
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
