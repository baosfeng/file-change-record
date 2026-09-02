/**
 * Build: assemble lib/client.js from lib/client.src.js + part fragments.
 *
 * DSH 浏览器端 ModuleLoader 不支持相对路径 require，client 拆分必须走
 * 方案 B（子文件拼接，参考 dsh-mermaid-render 模式）：lib/parts/*.js 是
 * 无 import/export 的纯函数声明文本，build 将每个片段经 __PART_*__ 占位符
 * 拼接进 factory 作用域，写出 lib/client.js —— 仍是单一 ModuleLoader
 * bundle，运行时形态不变。
 *
 *   node scripts/build.mjs
 *
 * 占位符替换必须用函数式 replacer（src.replaceAll(ph, () => part)）：
 * 字符串 replacer 会把片段中的 $& / $1 等当作替换模式特殊解释而损坏源码。
 *
 * lib/client.js 是构建产物且必须提交（CI 只对产物执行 node --check +
 * 测试，不运行本 build）。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const partsDir = join(root, 'lib/parts')
// Shared client parts live in the dsh-shared package (issue #54 阶段 0):
// single source of truth for the icon set, spliced by every plugin's build.
const sharedPartsDir = join(root, '..', 'dsh-shared', 'client-parts')

const PARTS = [
  ['/*__PART_I18N__*/', 'i18n.js'],
  ['/*__PART_ICONS__*/', 'icons.part.js', { shared: true }],
  ['/*__PART_NOTIFY_RENDER__*/', 'render.js'],
  ['/*__PART_STREAM__*/', 'stream.js'],
  // 顺序重要：webhook-settings.js 必须先于 settings.js（顶层引用 WEBHOOK_STYLES，见 client.src.js 注释）。
  ['/*__PART_WEBHOOK_SETTINGS__*/', 'webhook-settings.js'],
  ['/*__PART_SETTINGS__*/', 'settings.js'],
]

let src = readFileSync(join(root, 'lib/client.src.js'), 'utf8')
for (const [placeholder, file, opts = {}] of PARTS) {
  if (!src.includes(placeholder)) {
    throw new Error(`client.src.js is missing the ${placeholder} placeholder`)
  }
  const dir = opts.shared ? sharedPartsDir : partsDir
  const part = readFileSync(join(dir, file), 'utf8')
  // 函数式替换：片段内容作为字面文本返回，$&/$1 不会被特殊解释。
  src = src.replaceAll(placeholder, () => part)
}
writeFileSync(join(root, 'lib/client.js'), src)
console.log(`built lib/client.js (${src.length} bytes, from client.src.js + ${PARTS.length} fragments)`)
