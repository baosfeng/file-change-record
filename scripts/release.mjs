#!/usr/bin/env node
/**
 * Release automation for a plugin in this repo.
 *
 *   node scripts/release.mjs <plugin-name> [--push]
 *
 * Steps (dry-run by default; --push performs git commit + tag + push):
 *   1. validate plugins/<name> exists and package.json version parses
 *   2. validate CHANGELOG.md has a "## [<version>]" section at the top
 *   3. run the plugin's tests (npm test)
 *   4. sync the version in root README.md plugin table and AGENTS.md
 *   5. --push: commit doc sync, tag <name>@v<version>, push tag (triggers
 *      the GitHub Actions release workflow)
 *
 * Exit codes: 0 ok, 1 validation/test failure (nothing changed).
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const name = args.find((a) => !a.startsWith('--'))
const push = args.includes('--push')

/**
 * Escape a user-supplied string for safe use inside a RegExp constructor.
 * `name` comes from the command line and must never alter the match grammar.
 */
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

if (!name) {
  console.error('usage: node scripts/release.mjs <plugin-name> [--push]')
  process.exit(2)
}

const pluginDir = join(root, 'plugins', name)
if (!existsSync(pluginDir)) {
  console.error(`✗ plugins/${name} does not exist`)
  process.exit(1)
}

// 1. version from package.json
const pkg = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8'))
const version = pkg.version
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`✗ invalid version in plugins/${name}/package.json: ${version}`)
  process.exit(1)
}
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

// 3b. README 效果图校验：发版前必须引用真实截图（见效果图规范）
const plugReadmePath = join(pluginDir, 'README.md')
const assetsDir = join(pluginDir, 'assets')
let screenshotRefs = 0
if (existsSync(plugReadmePath)) {
  const plugReadme = readFileSync(plugReadmePath, 'utf8')
  // 同时匹配 markdown 图片（![…](./assets/…)）与 HTML <img src="./assets/…">
  const imgRe = /(?:!\[[^\]]*\]\(\.\/assets\/([^)]+)\)|<img[^>]*src="\.\/assets\/([^"]+)")/g
  const refs = []
  for (const m of plugReadme.matchAll(imgRe)) refs.push(m[1] || m[2])
  screenshotRefs = refs.length
  const missingFiles = refs.filter((f) => !existsSync(join(assetsDir, f)))
  if (refs.length > 0 && missingFiles.length > 0) {
    console.error(`✗ ${name}/README.md references missing screenshots: ${missingFiles.join(', ')}`)
    process.exit(1)
  }
}
if (screenshotRefs === 0) {
  console.error(`✗ ${name}/README.md has no real screenshot reference (./assets/...) — update README + assets/ per the 效果图规范`)
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
const readmeRe = new RegExp(`(\\| \\[${escapeRegExp(name)}\\]\\(plugins/${escapeRegExp(name)}/README\\.md\\) \\| )\\d+\\.\\d+\\.\\d+( \\|)`)
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
  if (changed) {
    execSync('git add README.md AGENTS.md', { cwd: root, stdio: 'inherit' })
    execSync(`git commit -m "docs: 同步 ${name} 版本号至 ${version}（发版）"`, { cwd: root, stdio: 'inherit' })
    execSync('git push origin main', { cwd: root, stdio: 'inherit' })
  }
  const tag = `${name}@v${version}`
  execSync(`git tag ${tag}`, { cwd: root, stdio: 'inherit' })
  execSync(`git push origin ${tag}`, { cwd: root, stdio: 'inherit' })
  console.log(`✓ tag ${tag} pushed — GitHub Actions will build the release`)
  console.log(`  watch: https://github.com/baosfeng/my-dsh-plugins/actions`)
} else {
  console.log('(dry run — pass --push to commit, tag and push)')
}

console.log('done')
