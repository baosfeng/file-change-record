/**
 * Build: splice the lib/parts/*.part.js fragment files into the
 * lib/client.src.js template (at the /*__PART_X__*\/ placeholders) and write
 * lib/client.js — the file DSH actually serves at
 * /plugins/dsh-think-zh-expand/client.js.
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
// issue #31 渲染职责迁移：markdown.part.js 已迁至 dsh-md-render
// （lib/parts/markdown.part.js），本插件不再拼接渲染片段。
const PARTS = [
  ['/*__PART_ASSISTANT__*/', 'lib/parts/assistant.part.js'],
  ['/*__PART_ZH_TABLES__*/', 'lib/parts/zh-tables.part.js'],
  ['/*__PART_ZH_LOCALIZE__*/', 'lib/parts/zh-localize.part.js'],
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
// 剔除仅供 src 模板静态 lint 使用的注释（模板看不到片段内容，需声明
// /* global */ 与 eslint-disable；产物中片段已展开、函数定义齐全，这些
// 注释会让 no-unused-vars 把函数声明误判为「遮蔽未用的全局」，或触发
// unused eslint-disable-directive 警告）。对产物中不存在的串是安全 no-op。
out = out.replaceAll('/* global AssistantStepView, installUiLocalize */\n', '')
out = out.replaceAll('    // eslint-disable-next-line no-unused-vars\n', '')
writeFileSync(join(root, 'lib/client.js'), out)
console.log(`built lib/client.js (${out.length} bytes, ${out.split('\n').length} lines)`)
