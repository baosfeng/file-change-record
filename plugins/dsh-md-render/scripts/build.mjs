/**
 * Build: splice the lib/parts/*.part.js fragment files into the
 * lib/client.src.js template (at the /*__PART_X__*\/ placeholders) and write
 * lib/client.js — the file DSH actually serves at
 * /plugins/dsh-md-render/client.js.
 *
 *   node scripts/build.mjs
 *
 * lib/client.js is the build artifact and MUST be committed (CI runs
 * node --check + tests against it; it does not run this build).
 *
 * NOTE: replaceAll uses a FUNCTION replacer — a string replacer would
 * interpret $& / $1 special patterns inside the fragment source.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 占位符 → 片段文件（数组顺序即拼接后的声明顺序）。 */
const PARTS = [
  ['/*__PART_DETECT__*/', 'lib/parts/detect.part.js'],
  ['/*__PART_INLINE__*/', 'lib/parts/inline.part.js'],
  ['/*__PART_RENDER__*/', 'lib/parts/render.part.js'],
  ['/*__PART_SCANNER__*/', 'lib/parts/scanner.part.js'],
  ['/*__PART_STYLES__*/', 'lib/parts/styles.part.js'],
  ['/*__PART_APPLY__*/', 'lib/parts/apply.part.js'],
]

let out = readFileSync(join(root, 'lib/client.src.js'), 'utf8')
for (const [placeholder, file] of PARTS) {
  if (!out.includes(placeholder)) {
    throw new Error(`client.src.js is missing the ${placeholder} placeholder`)
  }
  const part = readFileSync(join(root, file), 'utf8')
  // 函数式替换：替换串中的 $& / $1 不会被 replaceAll 特殊解释。
  out = out.replaceAll(placeholder, () => part)
}
const unresolved = PARTS.map(([placeholder]) => placeholder).filter((p) => out.includes(p))
if (unresolved.length > 0) {
  throw new Error(`client.src.js has unresolved placeholders: ${unresolved.join(', ')}`)
}
writeFileSync(join(root, 'lib/client.js'), out)
console.log(`built lib/client.js (${out.length} bytes, ${out.split('\n').length} lines)`)
