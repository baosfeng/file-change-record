/**
 * dsh-md-render — host half (empty shell).
 *
 * The plugin is client-only: it enhances markdown table rendering in the
 * conversation (see lib/client.js). This host half exists so the bundle row
 * mounts cleanly; nothing runs server-side.
 */
export const name = 'dsh-md-render'

export function apply() {
  // client-only plugin: no host-side services, events, or routes.
}
