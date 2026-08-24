/**
 * dsh-mermaid-render — host half (empty shell).
 *
 * The plugin is client-only: it renders mermaid/mmd code blocks in the
 * conversation (see lib/client.js). This host half exists so the bundle row
 * mounts cleanly; nothing runs server-side.
 */
export const name = 'dsh-mermaid-render'

export function apply() {
  // client-only plugin: no host-side services, events, or routes.
}
