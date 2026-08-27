#!/usr/bin/env node
/**
 * verify-real-profile.mjs — 真实环境全流程验证（配置副本模拟）。
 *
 * 复刻生产 profile 的「配置组合」（bundle 自动插行 + profile 手动 patch 行
 * 的叠加）到临时 DSH_HOME，可选模拟安装新插件（--addons），然后完整验证：
 *
 *   1. dump-config 配置组合检查：插件行 id 必须全局唯一
 *      （duplicate loader entry id 是真实启动最常见的配置组合炸弹——全新
 *      独立实例永远测不出它，只有复用真实配置组合才能复现/验证）；
 *   2. 启动独立实例（真实进程，插件树加载 + apply + 路由注册）；
 *   3. 健康检查（HTTP 200）+ 启动日志错误扫描；
 *   4. 可选 --api-path 对已挂载插件的 API 做冒烟（验证 server 端 apply 生效）；
 *   5. 停止实例并清理临时目录（绝不残留）。
 *
 * 用法：
 *   node scripts/verify-real-profile.mjs [--profile web] [--port 3087]
 *        [--addons plugins/dsh-my-skill-manager]... [--api-path /my-skill-manager/api/list]...
 *        [--timeout 90] [--skip] [--keep] [--help]
 *
 * 退出码：0 = 全部通过；1 = 任一环节失败。
 */
import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

// ── args ───────────────────────────────────────────────────────────────────
const options = parseArgs(process.argv.slice(2))
if (options.help) {
  printHelp()
  process.exit(0)
}

function parseArgs(args) {
  const result = { profile: 'web', port: 3087, addons: [], apiPaths: [], timeoutSec: 90, skipWeb: false, keep: false, help: false }
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i]
    const value = () => args[++i]
    if (flag === '--profile') result.profile = value()
    else if (flag === '--port') result.port = Number(value())
    else if (flag === '--addons') result.addons.push(value())
    else if (flag === '--api-path') result.apiPaths.push(value())
    else if (flag === '--timeout') result.timeoutSec = Number(value())
    else if (flag === '--skip') result.skipWeb = true
    else if (flag === '--keep') result.keep = true
    else if (flag === '--help' || flag === '-h') result.help = true
    else {
      console.error(`[verify] unknown flag: ${flag}`)
      process.exit(1)
    }
  }
  return result
}

function printHelp() {
  console.log('真实环境全流程验证（配置副本模拟）\n' +
    '用法: node scripts/verify-real-profile.mjs [options]\n' +
    '  --profile <name>   profile 名（默认 web）\n' +
    '  --port <port>      验证实例端口（默认 3087）\n' +
    '  --addons <dir>     模拟安装的插件目录（可重复；写入临时 profile 的 bundles + dependencies）\n' +
    '  --api-path <path>  启动后对每个 path 做 GET 冒烟（可重复）\n' +
    '  --timeout <sec>    启动就绪超时（默认 90）\n' +
    '  --skip             只做配置组合检查（dump-config），不启动实例\n' +
    '  --keep             失败/完成后保留临时目录（默认清理）\n')
}

// ── 常量 ───────────────────────────────────────────────────────────────────
const home = homedir()
const realProfile = join(home, '.dsh', 'profiles', options.profile)
const simHome = `/tmp/dsh-verify-real-${options.port}`
const simProfile = join(simHome, 'profiles', options.profile)
const dshBin = process.env.DSH_BIN || 'dsh'
let web = null
let failed = false
const log = (msg) => console.log(`[verify] ${msg}`)
const pass = (msg) => console.log(`[verify] ✓ ${msg}`)
const fail = (msg) => { failed = true; console.error(`[verify] ✗ ${msg}`) }

/** 运行命令并收集输出。 */
function run(command, argsList, env = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(command, argsList, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => resolveRun({ ok: false, code: -1, stdout, stderr, error: String(error?.message ?? error) }))
    child.on('close', (code) => resolveRun({ ok: code === 0, code, stdout, stderr }))
  })
}

/** 从 dump-config 输出里收集所有 loader entry id。 */
function entryIds(dumpOutput) {
  const ids = []
  for (const line of dumpOutput.split('\n')) {
    const match = /^\s*-?\s*id:\s*([A-Za-z0-9._-]+)/.exec(line)
    if (match !== null) ids.push(match[1])
  }
  return ids
}

/** 从 dump-config 输出里收集所有 insert 的插件 name（用于 addons 断言）。 */
function entryNames(dumpOutput) {
  const names = []
  for (const line of dumpOutput.split('\n')) {
    const match = /^\s*-?\s*name:\s*'?([A-Za-z0-9@._/-]+)'?/.exec(line)
    if (match !== null) names.push(match[1])
  }
  return names
}

async function httpStatus(port, path = '/') {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(5000) })
    return res.status
  } catch {
    return 0
  }
}

// ── 0. 前置校验 ────────────────────────────────────────────────────────────
if (!existsSync(realProfile)) {
  console.error(`[verify] profile 不存在: ${realProfile}`)
  process.exit(1)
}
if (!existsSync(join(realProfile, 'package.json'))) {
  console.error(`[verify] profile 缺少 package.json: ${realProfile}`)
  process.exit(1)
}

// ── 1. 复刻配置层 ──────────────────────────────────────────────────────────
log(`复刻生产 profile 配置层 → ${simProfile}`)
rmSync(simHome, { recursive: true, force: true })
mkdirSync(join(simHome, 'profiles'), { recursive: true })
cpSync(realProfile, simProfile, {
  recursive: true,
  filter: (src) => !src.includes('/node_modules'),
})
rmSync(join(simProfile, 'node_modules'), { recursive: true, force: true })

// node_modules：真实条目全量软链 + addons 软链（模拟 pnpm link 安装）
const simNode = join(simProfile, 'node_modules')
mkdirSync(simNode)
const realNode = join(realProfile, 'node_modules')
for (const entry of readdirSync(realNode)) {
  symlinkSync(join(realNode, entry), join(simNode, entry))
}
for (const addon of options.addons) {
  const abs = resolve(addon)
  if (!existsSync(join(abs, 'package.json'))) {
    console.error(`[verify] --addons 不是插件目录（无 package.json）: ${addon}`)
    process.exit(1)
  }
  symlinkSync(abs, join(simNode, addon.split('/').pop()))
}

// ── 2. 模拟安装 addons（写入临时 profile：bundles + dependencies） ────────
if (options.addons.length > 0) {
  const pkgPath = join(simProfile, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  for (const addon of options.addons) {
    const abs = resolve(addon)
    const name = JSON.parse(readFileSync(join(abs, 'package.json'), 'utf8')).name
    if (!pkg.dsh.profile.bundles.includes(name)) pkg.dsh.profile.bundles.push(name)
    pkg.dependencies[name] = `link:${abs}`
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
  log(`模拟安装 ${options.addons.length} 个插件（bundles + dependencies）`)
}

// ── 3. 配置组合检查（dump-config，与真实启动同一组合逻辑） ────────────────
log('配置组合检查（dump-config id 唯一性）…')
const dump = await run(dshBin, ['--profile', options.profile, '--dump-config'], { DSH_HOME: simHome })
if (!dump.ok) {
  fail(`dump-config 失败: ${dump.stderr || dump.stdout || dump.error}`)
  await cleanup()
  process.exit(1)
}
const ids = entryIds(dump.stdout)
const seen = new Map()
const duplicates = []
for (const id of ids) {
  if (seen.has(id)) duplicates.push(id)
  else seen.set(id, true)
}
if (duplicates.length > 0) {
  fail(`配置组合存在重复插件行 id: ${[...new Set(duplicates)].join(', ')}`)
  await cleanup()
  process.exit(1)
}
pass(`配置组合唯一：${ids.length} 个 id 无重复`)
for (const addon of options.addons) {
  const abs = resolve(addon)
  const name = JSON.parse(readFileSync(join(abs, 'package.json'), 'utf8')).name
  if (!entryNames(dump.stdout).includes(name)) {
    fail(`模拟安装的插件 ${name} 未出现在组合配置中（bundles 声明可能未生效）`)
    await cleanup()
    process.exit(1)
  }
  pass(`模拟插件 ${name} 已出现在组合配置`)
}

if (options.skipWeb) {
  log('--skip：配置组合检查完成，不启动实例')
  await cleanup()
  process.exit(failed ? 1 : 0)
}

// ── 4. 启动实例（真实进程） ────────────────────────────────────────────────
log(`启动验证实例（端口 ${options.port}）…`)
web = spawn(dshBin, ['--profile', options.profile, '--port', String(options.port), '--no-open'], {
  env: { ...process.env, DSH_HOME: simHome },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let webLog = ''
web.stdout.on('data', (chunk) => { webLog += chunk })
web.stderr.on('data', (chunk) => { webLog += chunk })

// 等待就绪（轮询 HTTP）
const deadline = Date.now() + options.timeoutSec * 1000
let ready = false
while (Date.now() < deadline) {
  if (web.exitCode !== null) break
  const status = await httpStatus(options.port)
  if (status === 200) { ready = true; break }
  await new Promise((resolveWait) => setTimeout(resolveWait, 1000))
}
if (!ready) {
  fail(`实例 ${options.timeoutSec}s 内未就绪（exitCode=${web.exitCode}）`)
  console.error(webLog.slice(-2000))
  await cleanup()
  process.exit(1)
}
pass(`实例启动就绪（HTTP 200, 端口 ${options.port}）`)

// 启动日志错误扫描（duplicate / failed to apply / error / exception）
const errorHits = []
for (const line of webLog.split('\n')) {
  if (/(duplicate loader|failed to apply|error|exception|ECONNREFUSED)/i.test(line) && !/(EADDRINUSE)/i.test(line)) {
    errorHits.push(line.trim())
  }
}
if (errorHits.length > 0) {
  fail(`启动日志扫描到 ${errorHits.length} 条错误: ${errorHits.slice(0, 5).join(' | ')}`)
} else {
  pass('启动日志无 error / duplicate 记录')
}

// ── 5. 插件 API 冒烟（验证 server 端 apply 生效） ──────────────────────────
for (const path of options.apiPaths) {
  const status = await httpStatus(options.port, path)
  if (status === 200) pass(`API 冒烟 ${path} → 200`)
  else {
    fail(`API 冒烟 ${path} → ${status}（预期 200，说明插件 server 端未生效或路由异常）`)
  }
}

// ── 6. 收尾 ────────────────────────────────────────────────────────────────
if (!options.keep) {
  await cleanup()
} else {
  log(`--keep：实例保持运行（端口 ${options.port}，日志见 /tmp/dsh-verify-real-${options.port}.log），临时目录 ${simHome}`)
  log(`手动停止：lsof -ti :${options.port} | xargs kill；清理：rm -rf ${simHome}`)
}
process.exit(failed ? 1 : 0)

async function cleanup() {
  if (web !== null && web.exitCode === null) {
    web.kill('SIGTERM')
    await new Promise((resolveWait) => {
      const hard = setTimeout(() => {
        if (web.exitCode === null) web.kill('SIGKILL')
        resolveWait()
      }, 3000)
      web.once('exit', () => { clearTimeout(hard); resolveWait() })
    })
  }
  rmSync(simHome, { recursive: true, force: true })
  log('实例已停止，临时目录已清理')
}
