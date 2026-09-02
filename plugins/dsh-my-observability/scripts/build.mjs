/**
 * Build: assemble lib/client.js from lib/client.src.js + part fragments.
 *
 * DSH 浏览器端 ModuleLoader 不支持相对路径 require，client 拆分必须走
 * 方案 B（子文件拼接，参考 dsh-my-notify 模式）：lib/parts/*.js 是
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
// 共享 client parts 位于 dsh-shared 包（issue #54 阶段 0）：图标集单一来源，
// 各插件构建时经 shared: true 标记从此目录拼接。
const sharedPartsDir = join(root, '..', 'dsh-shared', 'client-parts')

/** (placeholder, part file, opts?) — 拼接顺序固定（const 初始化器依赖）。
 *  file 相对 partsDir（本地）或 sharedPartsDir（shared: true）。
 *  opts.root 覆盖片段根目录（如 'lib'）；opts.stripExport 逐行剥离行首
 *  `export ` 前缀（用于把可单测的 ESM 模块作为片段拼进 client 作用域）。 */
const PARTS = [
  ['/*__PART_I18N__*/', 'i18n.js'],
  ['/*__PART_ICONS__*/', 'icons.part.js', { shared: true }],
  ['/*__PART_AUDIT_VIEW__*/', 'audit-view.js', { root: 'lib', stripExport: true }],
  ['/*__PART_REPLAY__*/', 'replay.js'],
  ['/*__PART_REPLAY_EXT__*/', 'replay-ext.js'],
  ['/*__PART_GIT__*/', 'git.js'],
  ['/*__PART_STYLES__*/', 'styles.js'],
]

let src = readFileSync(join(root, 'lib/client.src.js'), 'utf8')
for (const [placeholder, file, opts = {}] of PARTS) {
  if (!src.includes(placeholder)) {
    throw new Error(`client.src.js is missing the ${placeholder} placeholder`)
  }
  const dir = opts.shared ? sharedPartsDir : opts.root ? join(root, opts.root) : partsDir
  let part = readFileSync(join(dir, file), 'utf8')
  if (opts.stripExport) part = part.replace(/^export /gm, '')
  // 函数式替换：片段内容作为字面文本返回，$&/$1 不会被特殊解释。
  src = src.replaceAll(placeholder, () => part)
}
writeFileSync(join(root, 'lib/client.js'), src)
console.log(`built lib/client.js (${src.length} bytes, from client.src.js + ${PARTS.length} fragments)`)
