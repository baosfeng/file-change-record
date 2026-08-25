#!/usr/bin/env node
// 一键安装「插件开发模式」agent preset 到 $DSH_HOME/.agent-presets/plugin-dev/。
// 用法：node scripts/install.mjs [--force]
//   - 默认在目标已存在时中止并提示；--force 覆盖安装。
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const presetRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = process.env.DSH_HOME ?? path.join(process.env.HOME ?? '', '.dsh')
const target = path.join(dshHome, '.agent-presets', 'plugin-dev')

const force = process.argv.includes('--force')
if (!force && existsSync(target)) {
  console.error(`目标已存在：${target}`)
  console.error('如需覆盖安装，请追加 --force 参数。')
  process.exit(1)
}

mkdirSync(target, { recursive: true })
cpSync(path.join(presetRoot, 'agent.cordis.yml'), path.join(target, 'agent.cordis.yml'))
cpSync(path.join(presetRoot, 'preset.yml'), path.join(target, 'preset.yml'))
cpSync(path.join(presetRoot, 'skills'), path.join(target, 'skills'), { recursive: true })

console.log(`「插件开发模式」preset 已安装到：${target}`)
console.log('请重启 DSH 进程，然后在 Web GUI 模式选择器中切换到「插件开发模式」。')
