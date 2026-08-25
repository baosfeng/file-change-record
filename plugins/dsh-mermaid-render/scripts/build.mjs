/**
 * Build: splice the `lib/parts/*.part.js` pieces into the PART placeholders
 * of lib/client.src.js, then inject the vendored mermaid.min.js (UMD,
 * base64-encoded) into the __MERMAID_UMD_B64__ placeholder — it lives
 * inside engine.part.js, so base64 injection MUST run AFTER part splicing —
 * and write lib/client.js, the single __ModuleLoader__ bundle DSH actually
 * serves at /plugins/dsh-mermaid-render/client.js.
 *
 *   node scripts/build.mjs
 *
 * Why splicing: the DSH browser ModuleLoader does not support relative-path
 * require inside a factory (`require('./x.js')` misses the module table), so
 * the client half must ship as ONE bundle; the parts are plain function
 * declaration texts sharing the factory scope (no import/export).
 *
 * lib/client.js is the build artifact and MUST be committed (CI runs
 * node --check + tests against it; it does not run this build).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const partsDir = join(root, 'lib/parts')
const src = readFileSync(join(root, 'lib/client.src.js'), 'utf8')

/** (placeholder, part file) in splice order — parts share one scope. */
const pieces = [
  ['__PART_ENGINE__', 'engine.part.js'],
  ['__PART_CARD__', 'card.part.js'],
  ['__PART_SCANNER__', 'scanner.part.js'],
  ['__PART_STYLES__', 'styles.part.js'],
  ['__PART_APPLY__', 'apply.part.js'],
]

let out = src
for (const [placeholder, file] of pieces) {
  if (!out.includes(placeholder)) {
    throw new Error(`client.src.js is missing the ${placeholder} placeholder`)
  }
  const part = readFileSync(join(partsDir, file), 'utf8')
  // Function-style replacement: the part text may contain `$&` / `$1` style
  // sequences that a string replacement would interpret specially.
  out = out.replaceAll(placeholder, () => part)
}

if (out.includes('__PART_')) {
  throw new Error('build left an unresolved __PART_*__ placeholder in client.js')
}

// ── vendored engine injection (AFTER part splicing) ──────────────────────
// base64 keeps the payload a pure [A-Za-z0-9+/=] literal — JSON string
// injection breaks on the minified source's control characters.
if (!out.includes('__MERMAID_UMD_B64__')) {
  throw new Error('client.js is missing the __MERMAID_UMD_B64__ placeholder')
}
const umd = readFileSync(join(root, 'vendor/mermaid.min.js'), 'utf8')
if (!umd.includes('window') && !umd.includes('globalThis')) {
  throw new Error('vendor/mermaid.min.js does not look like the UMD build')
}
const b64 = Buffer.from(umd, 'utf8').toString('base64')
out = out.replaceAll('__MERMAID_UMD_B64__', () => JSON.stringify(b64))

if (out.includes('__MERMAID_UMD_B64__')) {
  throw new Error('build left an unresolved __MERMAID_UMD_B64__ placeholder in client.js')
}

writeFileSync(join(root, 'lib/client.js'), out)
const lines = out.split('\n').length
console.log(`built lib/client.js (${out.length} bytes, ${lines} lines, mermaid ${umd.length} bytes embedded as base64)`)
