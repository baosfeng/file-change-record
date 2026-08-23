/**
 * Build: inject the vendored mermaid.min.js (UMD) into lib/client.src.js
 * (the `__MERMAID_UMD_B64__` placeholder, base64-encoded so the payload is
 * a pure [A-Za-z0-9+/=] literal — JSON string injection breaks on the
 * minified source's control characters) and write lib/client.js — the file
 * DSH actually serves at /plugins/dsh-mermaid-render/client.js.
 *
 *   node scripts/build.mjs
 *
 * lib/client.js is the build artifact and MUST be committed (CI runs
 * node --check + tests against it; it does not run this build).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const umd = readFileSync(join(root, 'vendor/mermaid.min.js'), 'utf8')
const src = readFileSync(join(root, 'lib/client.src.js'), 'utf8')

if (!src.includes('__MERMAID_UMD_B64__')) {
  throw new Error('client.src.js is missing the __MERMAID_UMD_B64__ placeholder')
}
if (!umd.includes('window') && !umd.includes('globalThis')) {
  throw new Error('vendor/mermaid.min.js does not look like the UMD build')
}

const b64 = Buffer.from(umd, 'utf8').toString('base64')
const out = src.replaceAll('__MERMAID_UMD_B64__', JSON.stringify(b64))
writeFileSync(join(root, 'lib/client.js'), out)
console.log(`built lib/client.js (${out.length} bytes, mermaid ${umd.length} bytes embedded as base64)`)
