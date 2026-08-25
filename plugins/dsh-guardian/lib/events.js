/**
 * dsh-guardian — diagnostic event log (ring buffer in state) and the loader
 * event listeners that feed it.
 */
import { ERROR_SNIP, EVENT_LIMIT } from './state.js'

/** Append a diagnostic event to the shared state's ring buffer. */
export function logEvent(shared, type, message) {
  shared.state.events.push({ time: Date.now(), type, message: String(message).slice(0, ERROR_SNIP) })
  if (shared.state.events.length > EVENT_LIMIT) shared.state.events.splice(0, shared.state.events.length - EVENT_LIMIT)
}

/** Register the loader/HMR diagnostic listeners (R9/R10). */
export function attachEventListeners(ctx, shared) {
  ctx.on('loader/entry-init', (entry) => {
    logEvent(shared, 'entry-init', `entry ${entry?.options?.id ?? '?'} initialized`)
  })
  ctx.on('loader/partial-dispose', (entry) => {
    logEvent(shared, 'entry-dispose', `entry ${entry?.options?.id ?? '?'} disposed`)
  })
  ctx.on('hmr/config-update-failed', (filename, error) => {
    logEvent(shared, 'update-failed', `${filename}: ${error instanceof Error ? error.message : String(error)}`)
    ctx.logger?.warn(`[dsh-guardian] config update failed (rolled back): ${filename}`)
    shared.persistSoon()
  })
}
