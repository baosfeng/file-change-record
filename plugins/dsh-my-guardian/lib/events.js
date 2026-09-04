/**
 * dsh-my-guardian — diagnostic event log (ring buffer in state) and the loader
 * event listeners that feed it.
 */
import { ERROR_SNIP, EVENT_LIMIT } from './state.js'

/** Append a diagnostic event to the shared state's ring buffer. */
export function logEvent(shared, type, message) {
  shared.state.events.push({
    time: Date.now(),
    type,
    message: String(message).slice(0, ERROR_SNIP),
  })
  if (shared.state.events.length > EVENT_LIMIT) shared.state.events.splice(0, shared.state.events.length - EVENT_LIMIT)
}

/** Register the loader/HMR diagnostic listeners (R9/R10). */
export function attachEventListeners(ctx, shared) {
  ctx.on('loader/entry-init', (entry) => {
    logEvent(shared, 'entry-init', `entry ${entryLabelOf(entry)} initialized`)
  })
  ctx.on('loader/partial-dispose', (entry) => {
    logEvent(shared, 'entry-dispose', `entry ${entryLabelOf(entry)} disposed`)
  })
  ctx.on('hmr/config-update-failed', (filename, error) => {
    logEvent(shared, 'update-failed', `${filename}: ${error instanceof Error ? error.message : String(error)}`)
    ctx.logger?.warn(`[dsh-my-guardian] config update failed (rolled back): ${filename}`)
    shared.persistSoon()
  })
}

/**
 * entry 可读标识：优先 entry.id（Entry 类 getter，含父级前缀；真实 DSH
 * loader 事件参数是 Entry 实例）。旧实现读 `entry?.options?.id`——Entry
 * 实例的 options.id 经常为空，导致日志全部显示 "entry ? initialized"。
 */
function entryLabelOf(entry) {
  if (entry === null || typeof entry !== 'object') return '?'
  if (typeof entry.id === 'string' && entry.id !== '') return entry.id
  if (entry.options !== null && typeof entry.options === 'object' && entry.options.id !== undefined) {
    return String(entry.options.id)
  }
  return '?'
}
