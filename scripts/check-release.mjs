#!/usr/bin/env node
/**
 * 发布状态检查——只检查我们自己的插件（npm 包名取自各插件 package.json 的 name 字段，
 * 绝不按目录名猜包名，避免查到别人的同名包，如 npm 上的 dsh-guardian / dsh-notify）。
 *
 * 检查项（任一失败 exit 1）：
 *   1. npm 发布：npm registry 上 <package.json name>@<version> 存在且为最新
 *   2. Git tag：本地存在 <目录名>@v<version> 且已推送到 origin
 *   3. GitHub Release：仓库存在对应 tag 的 Release 且带 tarball 附件
 *      （需 GH_TOKEN 环境变量；未配置时跳过并提示）
 *   4. 未发版提交：最新 tag 之后 plugins/<目录名>/ 无新提交
 *
 * 用法：
 *   node scripts/check-release.mjs            # 仅本地 + npm（无需 token）
 *   GH_TOKEN=xxx node scripts/check-release.mjs   # 含 GitHub Release 检查
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY = 'https://registry.npmjs.org/'
const GH_TOKEN = process.env.GH_TOKEN || ''
const errors = []
const warnings = []

function sh(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', ...opts }).trim()
  } catch {
    return null
  }
}

// 收集插件：目录名 + package.json（name/version）
const plugins = []
for (const entry of readdirSync(join(root, 'plugins'))) {
  const pkgPath = join(root, 'plugins', entry, 'package.json')
  if (!existsSync(pkgPath)) continue
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  plugins.push({ dir: entry, name: pkg.name, version: pkg.version })
}

if (plugins.length === 0) {
  console.error('✗ 未发现任何插件（plugins/*/package.json）')
  process.exit(1)
}

// 远程 tag 集合（一次拉取）
const remoteTags = new Set(
  (sh('git ls-remote --tags origin') || '')
    .split('\n')
    .map((l) => l.split('/').pop())
    .filter((t) => t && !t.endsWith('^{}')),
)

// GitHub Releases（一次拉取；无 token 时跳过）
let releases = []
if (GH_TOKEN) {
  const out = sh(`curl -sS -H "Authorization: Bearer ${GH_TOKEN}" "https://api.github.com/repos/baosfeng/my-dsh-plugins/releases?per_page=100"`)
  if (out) {
    try {
      releases = JSON.parse(out)
      if (!Array.isArray(releases)) releases = []
    } catch {
      warnings.push('GitHub Releases 解析失败，跳过 Release 检查')
    }
  } else {
    warnings.push('GitHub API 请求失败，跳过 Release 检查')
  }
} else {
  warnings.push('未配置 GH_TOKEN，跳过 GitHub Release 检查（npm + tag + 未发版提交仍检查）')
}

console.log('===== 发布状态检查（只查我们自己的插件）=====')
console.log('')

for (const p of plugins) {
  const tag = `${p.dir}@v${p.version}`
  const status = []

  // 1. npm 发布：包名取自 package.json name（绝不查别人的同名包）
  const npmLatest = sh(`npm view ${JSON.stringify(p.name)} version --registry ${REGISTRY}`)
  if (npmLatest === null) {
    status.push('❌ npm 未发布（registry 查无此包）')
    errors.push(`${p.dir}: npm 上不存在 ${p.name}`)
  } else if (npmLatest === p.version) {
    status.push(`✅ npm ${p.name}@${p.version}`)
  } else {
    status.push(`❌ npm 最新 ${npmLatest} ≠ 本地 ${p.version}`)
    errors.push(`${p.dir}: npm ${p.name} 最新 ${npmLatest} ≠ 本地 ${p.version}`)
  }

  // 2. Git tag：本地存在 + 已推送
  const localTag = sh(`git rev-parse -q --verify refs/tags/${tag}`) !== null
  if (!localTag) {
    status.push('❌ 本地无 tag')
    errors.push(`${p.dir}: 本地缺少 tag ${tag}`)
  } else if (!remoteTags.has(tag)) {
    status.push('❌ tag 未推送')
    errors.push(`${p.dir}: tag ${tag} 未推送到 origin`)
  } else {
    status.push(`✅ tag ${tag} 已推送`)
  }

  // 3. GitHub Release（有 token 时）
  if (GH_TOKEN) {
    const rel = releases.find((r) => r.tag_name === tag)
    if (!rel) {
      status.push('❌ 无 GitHub Release')
      errors.push(`${p.dir}: GitHub 无 Release ${tag}`)
    } else if (rel.assets.length === 0) {
      status.push('❌ Release 无 tarball 附件')
      errors.push(`${p.dir}: Release ${tag} 无附件`)
    } else {
      status.push(`✅ Release ${tag}（${rel.assets.length} 个附件）`)
    }
  }

  // 4. 未发版提交：最新 tag 之后 plugins/<dir>/ 无新提交
  if (localTag) {
    const cnt = sh(`git log --oneline ${tag}..HEAD -- plugins/${p.dir}/ | wc -l | tr -d ' '`)
    const n = parseInt(cnt || '0', 10)
    if (n > 0) {
      status.push(`❌ tag 后 ${n} 个提交未发版`)
      errors.push(`${p.dir}: tag ${tag} 之后有 ${n} 个提交未发版（git log ${tag}..HEAD -- plugins/${p.dir}/）`)
    } else {
      status.push('✅ 无未发版提交')
    }
  }

  console.log(`${p.dir} (${p.name} v${p.version})`)
  for (const s of status) console.log(`  ${s}`)
  console.log('')
}

for (const w of warnings) console.log(`⚠ ${w}`)
console.log('')

if (errors.length > 0) {
  console.error(`✗ 检查失败（${errors.length} 项）：`)
  for (const e of errors) console.error('  ' + e)
  process.exit(1)
}
console.log('✓ 全部插件发布状态正常（npm / tag / GitHub Release / 无未发版提交）')
