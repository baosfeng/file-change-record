#!/usr/bin/env node
/**
 * Release automation for a plugin in this repo.
 *
 *   node scripts/release.mjs <plugin-name> [--bump patch|minor|major] [--push] [--skip-real-verify]
 *
 * Steps (dry-run by default; --push performs git commit + tag + push):
 *   1.  validate plugins/<name> exists and package.json version parses
 *   1b. validate peerDependencies.cordis declared and consistent across plugins
 *   1c. cross-plugin dependency check (issue #39): client require('dsh-*') must
 *       be declared in peerDependencies; in-repo dsh-* deps published + tagged
 *   2.  validate CHANGELOG.md has a "## [<version>]" section at the top
 *   3.  run the plugin's tests (npm test)
 *   3b. validate README screenshot references under assets/
 *   3c. real-environment verification (issue #39): verify-real-profile.mjs
 *       --addons plugins/<name> (local only; CI / --skip-real-verify skip)
 *   4.  sync the version in root README.md plugin table and AGENTS.md
 *   5.  --push: commit doc sync, tag <name>@v<version>, push tag (triggers
 *       the release workflow), then verify Release + npm
 *
 * Exit codes: 0 ok, 1 validation/test failure (nothing changed).
 */
import { execSync, execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  extractDshRequires,
  findUndeclaredPeers,
  findUnpublishedDeps,
  collectClientSources,
  buildPluginIndex,
  findFreePort,
  versionGte,
  rangeMin,
} from './lib/release-checks.mjs'
import { verifyPostRelease } from './lib/post-release.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const name = args.find((a) => !a.startsWith('--'))
const push = args.includes('--push')
const skipRealVerify = args.includes('--skip-real-verify')
const bumpIdx = args.indexOf('--bump')
const bump = bumpIdx >= 0 ? args[bumpIdx + 1] || '' : ''
const BUMP_TYPES = new Set(['patch', 'minor', 'major'])

/**
 * Escape a user-supplied string for safe use inside a RegExp constructor.
 * `name` comes from the command line and must never alter the match grammar.
 */
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

if (!name) {
  console.error('usage: node scripts/release.mjs <plugin-name> [--bump patch|minor|major] [--push]')
  process.exit(2)
}
// name 会拼入多个 shell 命令（git tag --list / git log / git add 等），
// 严格校验字符集（CodeQL js/shell-command-injection-from-environment）。
if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
  console.error(`✗ 非法插件名: ${name}（仅允许 [a-zA-Z0-9._-] 且首字符为字母/数字）`)
  process.exit(2)
}
if (bump !== '' && !BUMP_TYPES.has(bump)) {
  console.error(`✗ --bump 必须是 patch | minor | major，收到: ${bump}`)
  process.exit(2)
}

const pluginDir = join(root, 'plugins', name)
if (!existsSync(pluginDir)) {
  console.error(`✗ plugins/${name} does not exist`)
  process.exit(1)
}

// 0. --bump：自动升级版本 + 生成 CHANGELOG 段（提交信息从 git log 提取）
const pkgPath = join(pluginDir, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
let bumped = false
let version = pkg.version
// version 会拼入 git tag/push 命令，先严格校验（CodeQL
// js/shell-command-injection-from-environment；bump 生成的 next 必为 x.y.z）
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`✗ invalid version in plugins/${name}/package.json: ${version}`)
  process.exit(1)
}
if (bump !== '') {
  const [maj, min, pat] = version.split('.').map(Number)
  const next =
    bump === 'major' ? `${maj + 1}.0.0` : bump === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`
  // 最近一个 <name>@v* tag（按版本倒序），用于提取自上次发版以来的提交
  const tags = execSync(`git tag --list "${name}@v*" --sort=-v:refname`, {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
  const prevTag = tags[0] || null
  let logLines = []
  if (prevTag) {
    logLines = execSync(`git log ${prevTag}..HEAD --oneline -- plugins/${name}/`, {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  }
  if (logLines.length === 0) {
    console.error(`✗ --bump 需要至少一个自上次 tag（${prevTag ?? '无'}）以来的提交（git log 为空）`)
    process.exit(1)
  }
  const date = new Date().toISOString().slice(0, 10)
  const section = [
    `## [${next}] - ${date}`,
    '',
    '### 变更',
    '',
    ...logLines.map((l) => `- ${l.replace(/^\w+\s+/, '')}`),
    '',
  ].join('\n')
  const changelogPath = join(pluginDir, 'CHANGELOG.md')
  const changelog = readFileSync(changelogPath, 'utf8')
  const idx = changelog.indexOf('## [')
  writeFileSync(changelogPath, changelog.slice(0, idx) + section + '\n' + changelog.slice(idx))
  pkg.version = next
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  version = next
  bumped = true
  console.log(`✓ --bump ${bump}: ${prevTag ?? '(无 tag)'} → ${next}（CHANGELOG 已生成 ${logLines.length} 条提交记录）`)
}

// 1. version from package.json
console.log(`✓ plugin ${name} version ${version}`)

// 1b. peer dependencies: DSH 插件必须声明 cordis peer（npm 分发后缺失会导致
// dsh plugin add 安装失败），且 cordis major 与仓库内其他插件保持一致。
const peers = pkg.peerDependencies || {}
const cordisPeer = peers.cordis
if (!cordisPeer) {
  console.error(`✗ ${name}/package.json 缺少 peerDependencies.cordis（DSH 插件必须声明）`)
  process.exit(1)
}
const cordisMajor = String(cordisPeer).match(/^[\^~]?(\d+)/)?.[1]
if (!cordisMajor) {
  console.error(`✗ ${name}/package.json peerDependencies.cordis 无法解析 major 版本: ${cordisPeer}`)
  process.exit(1)
}
const mismatched = []
for (const entry of readdirSync(join(root, 'plugins'))) {
  if (entry === name || !existsSync(join(root, 'plugins', entry, 'package.json'))) continue
  const other = JSON.parse(readFileSync(join(root, 'plugins', entry, 'package.json'), 'utf8'))
  const otherMajor = String(other.peerDependencies?.cordis ?? '').match(/^[\^~]?(\d+)/)?.[1]
  if (otherMajor && otherMajor !== cordisMajor) mismatched.push(`${entry} (cordis ^${otherMajor})`)
}
if (mismatched.length > 0) {
  console.error(`✗ ${name} peerDependencies.cordis ^${cordisMajor} 与以下插件不一致: ${mismatched.join(', ')}`)
  process.exit(1)
}
console.log(`✓ peerDependencies.cordis ^${cordisMajor} 已声明且与其他插件一致`)

// 1c. 跨插件依赖校验（issue #39）：client require('dsh-*') 必须声明 peerDependencies；
// 仓库内 dsh-* 依赖必须已发布且已打 tag（依赖先发版）。
const clientSources = collectClientSources(pluginDir)
const requires = extractDshRequires(clientSources.map((f) => readFileSync(f, 'utf8')).join('\n'))
const undeclared = findUndeclaredPeers(requires, peers)
if (undeclared.length > 0) {
  console.error(`✗ client 端 require 了以下 dsh-* 包但未在 peerDependencies 声明: ${undeclared.join(', ')}`)
  console.error(`  修复: 在 plugins/${name}/package.json 的 peerDependencies 中声明（如 "dsh-md-render": "^0.1.1"）`)
  process.exit(1)
}
if (requires.length > 0) console.log(`✓ client 端跨插件依赖已声明: ${requires.join(', ')}`)

const pluginIndex = buildPluginIndex(root)
const isPublished = (dep, range) => {
  const min = rangeMin(range)
  if (!min) return false
  try {
    // CodeQL js/shell-command-injection-from-environment 修复：dep 来自
    // peerDependencies 键（外部输入），execFileSync 参数数组不经过 shell
    return versionGte(execFileSync('npm', ['view', dep, 'version'], { encoding: 'utf8' }).trim(), min)
  } catch {
    return false
  }
}
const isTagged = (dir, version) => {
  try {
    // CodeQL js/shell-command-injection-from-environment 修复：dir/version 来自
    // peerDependencies 键（外部输入），execFileSync 参数数组不经过 shell
    execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${dir}@v${version}`], { cwd: root })
    return true
  } catch {
    return false
  }
}
const depProblems = findUnpublishedDeps(peers, pluginIndex, isPublished, isTagged)
if (depProblems.length > 0) {
  for (const p of depProblems) console.error(`✗ ${p.reason}`)
  console.error('  修复: 先发版依赖包（node scripts/release.mjs <依赖目录> --push），再发本插件')
  process.exit(1)
}
const inRepoDeps = Object.keys(peers).filter((d) => pluginIndex.has(d))
if (inRepoDeps.length > 0)
  console.log(`✓ 仓库内 dsh-* 依赖均已发布且已打 tag（发布顺序正确）: ${inRepoDeps.join(', ')}`)

// 2. CHANGELOG section
const changelog = readFileSync(join(pluginDir, 'CHANGELOG.md'), 'utf8')
if (!changelog.includes(`## [${version}]`)) {
  console.error(`✗ CHANGELOG.md has no "## [${version}]" section`)
  process.exit(1)
}
console.log(`✓ CHANGELOG has [${version}] section`)

// 3. tests
try {
  execSync('npm test', { cwd: pluginDir, stdio: 'inherit' })
  console.log('✓ tests passed')
} catch {
  console.error('✗ tests failed — fix before releasing')
  process.exit(1)
}

// 3c. 真实环境验证（issue #39）：发版前必须跑 verify-real-profile.mjs --addons
// （真实 DSH 实例 + 配置组合检查），失败即阻断；CI 无生产 profile 自动跳过，
// --skip-real-verify 显式跳过（仅限无法起真实实例的场景，如批量回归）。
const skipReal = skipRealVerify || process.env.GITHUB_ACTIONS === 'true' || process.env.DSH_SKIP_REAL_VERIFY === '1'
if (skipReal) {
  console.log('- 跳过真实环境验证（--skip-real-verify / CI / DSH_SKIP_REAL_VERIFY）')
} else {
  const port = await findFreePort(3087)
  console.log(`- 真实环境验证（verify-real-profile.mjs --addons plugins/${name} --port ${port}）…`)
  try {
    execSync(`node scripts/verify-real-profile.mjs --addons plugins/${name} --port ${port}`, {
      cwd: root,
      stdio: 'inherit',
    })
    console.log('✓ 真实环境验证通过（实例启动 + 配置组合 + 日志无错误）')
  } catch {
    console.error('✗ 真实环境验证失败 — 发版阻断。请先修复插件加载/配置问题，再重新发版')
    process.exit(1)
  }
}

// 3b. README 效果图校验：发版前必须引用真实截图（见效果图规范）。
// 支持 ./assets/<file> 相对路径与 https://unpkg.com/<pkg>/assets/<file> 绝对 URL，
// 均提取文件名校验 assets/ 下真实存在。
const plugReadmePath = join(pluginDir, 'README.md')
const assetsDir = join(pluginDir, 'assets')
let screenshotRefs = 0
if (existsSync(plugReadmePath)) {
  const plugReadme = readFileSync(plugReadmePath, 'utf8')
  // markdown 图片与 HTML <img> 的两种引用形态
  const imgRe =
    /(?:!\[[^\]]*\]\((?:\.\/assets\/([^)]+)|https:\/\/unpkg\.com\/[^"/]+\/assets\/([^)]+))\)|<img[^>]*src="(?:\.\/assets\/([^"]+)|https:\/\/unpkg\.com\/[^"/]+\/assets\/([^"]+))")/g
  const refs = []
  for (const m of plugReadme.matchAll(imgRe)) refs.push(m[1] || m[2] || m[3] || m[4])
  screenshotRefs = refs.length
  const missingFiles = refs.filter((f) => !existsSync(join(assetsDir, f)))
  if (refs.length > 0 && missingFiles.length > 0) {
    console.error(`✗ ${name}/README.md references missing screenshots: ${missingFiles.join(', ')}`)
    process.exit(1)
  }
}
if (screenshotRefs === 0) {
  console.error(
    `✗ ${name}/README.md has no real screenshot reference (./assets/... or unpkg URL) — update README + assets/ per the 效果图规范`,
  )
  process.exit(1)
}
console.log(`✓ README references ${screenshotRefs} screenshot(s) under assets/`)

// 4. sync versions in root README.md and AGENTS.md
const readmePath = join(root, 'README.md')
const agentsPath = join(root, 'AGENTS.md')
let readme = readFileSync(readmePath, 'utf8')
let agents = readFileSync(agentsPath, 'utf8')
let changed = false

// README plugin table: | [<name>](plugins/<name>/README.md) | <old> | ...
const readmeRe = new RegExp(
  `(\\| \\[${escapeRegExp(name)}\\]\\(plugins/${escapeRegExp(name)}/README\\.md\\) \\| )\\d+\\.\\d+\\.\\d+( \\|)`,
)
if (readmeRe.test(readme)) {
  const next = readme.replace(readmeRe, `$1${version}$2`)
  if (next !== readme) {
    readme = next
    changed = true
    console.log(`✓ README.md version synced to ${version}`)
  } else {
    console.log(`- README.md already at ${version}`)
  }
} else {
  console.log(`- README.md: no row for ${name} (add it manually if new)`)
}

// AGENTS.md: "<name> v<old>" in the 版本 line
const agentsRe = new RegExp(`(${escapeRegExp(name)} v)\\d+\\.\\d+\\.\\d+`)
if (agentsRe.test(agents)) {
  const next = agents.replace(agentsRe, `$1${version}`)
  if (next !== agents) {
    agents = next
    changed = true
    console.log(`✓ AGENTS.md version synced to ${version}`)
  } else {
    console.log(`- AGENTS.md already at ${version}`)
  }
} else {
  console.log(`- AGENTS.md: no "${name} v…" found (add it manually if new)`)
}

if (changed) {
  writeFileSync(readmePath, readme)
  writeFileSync(agentsPath, agents)
}

// 5. push flow
if (push) {
  if (changed || bumped) {
    const files = bumped
      ? `README.md AGENTS.md plugins/${name}/package.json plugins/${name}/CHANGELOG.md`
      : 'README.md AGENTS.md'
    const msg = bumped
      ? `chore(release): ${name} v${version}（自动 bump ${bump} + CHANGELOG 生成）`
      : `docs: 同步 ${name} 版本号至 ${version}（发版）`
    execSync(`git add ${files}`, { cwd: root, stdio: 'inherit' })
    execSync(`git commit -m "${msg}"`, { cwd: root, stdio: 'inherit' })
    execSync('git push origin main', { cwd: root, stdio: 'inherit' })
  }
  const tag = `${name}@v${version}`
  execSync(`git tag ${tag}`, { cwd: root, stdio: 'inherit' })
  execSync(`git push origin ${tag}`, { cwd: root, stdio: 'inherit' })
  console.log(`✓ tag ${tag} pushed — GitHub Actions will build the release`)
  console.log(`  watch: https://github.com/baosfeng/my-dsh-plugins/actions`)
  // 6. 发版后校验（issue #36）：Release + npm 任一失败即终止（需 GH_TOKEN）。
  await verifyPostRelease(pkg.name, name, version)
} else {
  console.log('(dry run — pass --push to commit, tag and push)')
}

console.log('done')
