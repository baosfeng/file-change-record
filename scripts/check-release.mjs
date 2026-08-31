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
 *   5. 本地 profile 安装同步（~/.dsh/profiles/web，可用 --profile-dir 覆盖；
 *      无 profile 时跳过）——防止「装完/改名后配置半同步」导致的启动/安装失败：
 *      - 悬空 link：link: 依赖目标目录存在（含 package.json）
 *      - 键名一致：link 目标的包 name 与依赖键一致（防改名残留，如 bsfeng-dsh-guardian）
 *      - node_modules 同步：声明了 link 依赖但 node_modules 无对应条目（未跑 pnpm install）
 *      - bundles 中仓库插件必须在 dependencies 声明（install/prune 后不丢）
 *      - cordis.patch.yml 手动行引用的仓库插件必须在 dependencies 声明
 *        （think-zh-expand/md-render 教训：只 patch 行没声明，prune 即丢）
 *      - 可挂载插件（包内含 cordis.patch.yml）已声明则必须挂在 bundles 或 patch 行（装而不生效）
 *      - node_modules 中指向本仓库的孤儿/悬空 symlink（半装状态，如 bsfeng-dsh-notify 残留）
 *
 * 用法：
 *   node scripts/check-release.mjs                  # 仅本地 + npm（无需 token）
 *   GH_TOKEN=xxx node scripts/check-release.mjs     # 含 GitHub Release 检查
 *   node scripts/check-release.mjs --profile-dir /tmp/mock-profile   # 指定 profile（测试用）
 */
import { readFileSync, existsSync, readdirSync, lstatSync, readlinkSync, realpathSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY = 'https://registry.npmjs.org/'
const GH_TOKEN = process.env.GH_TOKEN || ''
// mock 用：--profile-dir 覆盖默认生产 profile（默认取当前用户的 web profile）
const argProfileDir = process.argv.indexOf('--profile-dir')
const profileDir =
  argProfileDir > -1
    ? resolve(process.argv[argProfileDir + 1])
    : join(process.env.HOME || '', '.dsh', 'profiles', 'web')
const errors = []
const warnings = []

/**
 * 参数数组版命令执行：execFileSync 不经过 shell，杜绝命令注入
 * （CodeQL js/shell-command-injection-from-environment）；stdout trim，
 * 失败返回 null（与原 sh() 行为一致）。
 */
function shArgs(bin, args, opts = {}) {
  try {
    return execFileSync(bin, args, { encoding: 'utf8', ...opts }).trim()
  } catch {
    return null
  }
}

// ── 本地 profile 安装同步检查 ──────────────────────────────────────────────
// 防「装完/改名后配置半同步」导致的安装/启动失败：package.json(dependencies/bundles)
// ↔ node_modules ↔ cordis.patch.yml 三方一致性 + link 目标存在性。
function checkLocalProfileSync(pluginByPkg) {
  const pkgPath = join(profileDir, 'package.json')
  if (!existsSync(pkgPath)) {
    warnings.push(`未找到本地 profile（${pkgPath}），跳过本地安装同步检查`)
    return
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const deps = pkg.dependencies || {}
  const bundles = pkg.dsh?.profile?.bundles || []
  const patchPath = join(profileDir, 'cordis.patch.yml')
  const patchText = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : ''
  const mountName = (name) => new RegExp(`name:\\s*['"]?${name}['"]?`).test(patchText)

  console.log('')
  console.log(`===== 本地安装同步检查（${profileDir}）=====`)
  console.log('')

  checkLinkDeps(deps)
  checkBundleSync(bundles, deps, pluginByPkg)
  checkPatchSync(patchText, deps, pluginByPkg)
  checkMountSync(deps, bundles, mountName, pluginByPkg)
  checkOrphanLinks(deps)
  if (!errors.some((e) => e.startsWith('profile:'))) {
    console.log('✓ 本地 profile 同步一致（dependencies / bundles / patch / node_modules / link 目标）')
  }
}

/** link 依赖：目标存在 + 键名一致 + node_modules 有对应条目 */
function checkLinkDeps(deps) {
  for (const [key, spec] of Object.entries(deps)) {
    if (typeof spec !== 'string' || !spec.startsWith('link:')) continue
    const target = resolve(profileDir, spec.slice('link:'.length))
    if (!existsSync(join(target, 'package.json'))) {
      errors.push(`profile: 依赖 ${key} 的 link 目标不存在（悬空 link，改名残留？）: ${target}`)
      continue
    }
    const targetName = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).name
    if (targetName !== key) {
      errors.push(`profile: 依赖键 ${key} ≠ link 目标包名 ${targetName}（改名未同步）`)
    }
    if (!existsSync(join(profileDir, 'node_modules', key))) {
      errors.push(`profile: ${key} 已声明但 node_modules 无条目（未跑 pnpm install？）`)
    }
  }
}

/** bundles 中的仓库插件必须在 dependencies（install/prune 后不丢） */
function checkBundleSync(bundles, deps, pluginByPkg) {
  for (const name of bundles) {
    if (pluginByPkg.has(name) && !deps[name]) {
      errors.push(`profile: bundle ${name} 未在 dependencies 声明（install/prune 后启动缺插件）`)
    }
  }
}

/** patch 手动行引用的仓库插件必须在 dependencies（think-zh-expand/md-render 教训） */
function checkPatchSync(patchText, deps, pluginByPkg) {
  for (const name of pluginByPkg.keys()) {
    if (deps[name]) continue
    if (new RegExp(`name:\\s*['"]?${name}['"]?`).test(patchText)) {
      errors.push(`profile: patch 行引用 ${name} 但 dependencies 未声明（prune 即丢）`)
    }
  }
}

/** 反向：可挂载插件（包内含 cordis.patch.yml）已声明则必须已挂载（bundles 或 patch 行） */
function checkMountSync(deps, bundles, mountName, pluginByPkg) {
  for (const [name, pl] of pluginByPkg) {
    if (!deps[name] || !existsSync(join(root, 'plugins', pl.dir, 'cordis.patch.yml'))) continue
    const mounted = bundles.includes(name) || mountName(name)
    if (!mounted) {
      errors.push(`profile: 插件 ${name} 已声明但未挂载（bundles 与 patch 行均无）——装而不生效`)
    }
  }
}

// node_modules 中指向本仓库的孤儿或悬空 symlink（手动 ln 半装状态的残留）
function checkOrphanLinks(deps) {
  const nm = join(profileDir, 'node_modules')
  if (!existsSync(nm)) return
  const isRepoLink = (entry) => {
    try {
      return realpathSync(join(nm, entry)).includes(`${root}/plugins/`)
    } catch {
      try {
        return resolve(join(nm, entry), readlinkSync(join(nm, entry))).includes(`${root}/plugins/`)
      } catch {
        return false
      }
    }
  }
  for (const entry of readdirSync(nm)) {
    if (!lstatSync(join(nm, entry)).isSymbolicLink()) continue
    if (!isRepoLink(entry)) continue
    if (!existsSync(join(nm, entry))) {
      errors.push(`profile: node_modules 悬空 symlink ${entry}（指向已不存在的仓库目录）`)
    } else if (!deps[entry]) {
      errors.push(`profile: node_modules 孤儿链接 ${entry}（有链接但 dependencies 未声明——半装状态）`)
    }
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
  (shArgs('git', ['ls-remote', '--tags', 'origin']) || '')
    .split('\n')
    .map((l) => l.split('/').pop())
    .filter((t) => t && !t.endsWith('^{}')),
)

// GitHub Releases（一次拉取；无 token 时跳过）
let releases = []
if (GH_TOKEN) {
  const out = shArgs('curl', [
    '-sS',
    '-H',
    `Authorization: Bearer ${GH_TOKEN}`,
    'https://api.github.com/repos/baosfeng/my-dsh-plugins/releases?per_page=100',
  ])
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
  const npmLatest = shArgs('npm', ['view', p.name, 'version', '--registry', REGISTRY])
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
  const localTag = shArgs('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]) !== null
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
    // 原 `| wc -l | tr -d ' '` 管道无法参数化，改为数输出行数（行为等价）
    const log = shArgs('git', ['log', '--oneline', `${tag}..HEAD`, '--', `plugins/${p.dir}/`])
    const n = log === null ? 0 : log.split('\n').filter((l) => l !== '').length
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

// 本地安装同步检查（可能产生 profile: 前缀错误）
checkLocalProfileSync(new Map(plugins.map((p) => [p.name, p])))

for (const w of warnings) console.log(`⚠ ${w}`)
console.log('')

if (errors.length > 0) {
  console.error(`✗ 检查失败（${errors.length} 项）：`)
  for (const e of errors) console.error('  ' + e)
  process.exit(1)
}
console.log('✓ 全部插件发布状态正常（npm / tag / GitHub Release / 无未发版提交）')
