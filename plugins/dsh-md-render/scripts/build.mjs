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
const partsDir = join(root, 'lib/parts')
// 共享 client parts 位于 dsh-shared 包（issue #54 阶段 0）：图标集单一来源，
// 各插件构建时按文件系统路径拼接（不经过 package exports / require 解析）。
const sharedPartsDir = join(root, '..', 'dsh-shared', 'client-parts')

/** 占位符 → 片段文件（数组顺序即拼接后的声明顺序）。
 *  opts.shared: true 表示从 dsh-shared 的 client-parts 目录读取。 */
const PARTS = [
  ['/*__PART_ICONS__*/', 'icons.part.js', { shared: true }],
  ['/*__PART_COPY__*/', 'copy.part.js'],
  ['/*__PART_MARKDOWN__*/', 'markdown.part.js'],
  ['/*__PART_DETECT__*/', 'detect.part.js'],
  ['/*__PART_INLINE__*/', 'inline.part.js'],
  ['/*__PART_RENDER__*/', 'render.part.js'],
  ['/*__PART_SCANNER__*/', 'scanner.part.js'],
  ['/*__PART_STYLES__*/', 'styles.part.js'],
  ['/*__PART_APPLY__*/', 'apply.part.js'],
]

let out = readFileSync(join(root, 'lib/client.src.js'), 'utf8')
for (const [placeholder, file, opts = {}] of PARTS) {
  if (!out.includes(placeholder)) {
    throw new Error(`client.src.js is missing the ${placeholder} placeholder`)
  }
  const dir = opts.shared ? sharedPartsDir : partsDir
  const part = readFileSync(join(dir, file), 'utf8')
  // 函数式替换：替换串中的 $& / $1 不会被 replaceAll 特殊解释。
  out = out.replaceAll(placeholder, () => part)
}
const unresolved = PARTS.map(([placeholder]) => placeholder).filter((p) => out.includes(p))
if (unresolved.length > 0) {
  throw new Error(`client.src.js has unresolved placeholders: ${unresolved.join(', ')}`)
}
writeFileSync(join(root, 'lib/client.js'), out)
console.log(`built lib/client.js (${out.length} bytes, ${out.split('\n').length} lines)`)
