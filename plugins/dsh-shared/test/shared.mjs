/**
 * dsh-shared — config-store / project / async / persist 单元测试。
 *
 * 这些模块由各插件抽取合并（issue #45），依赖方插件的测试已通过
 * dsh-shared import 覆盖其行为；本文件补充 dsh-shared 自包含的核心断言。
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  currentProfile,
  profileDirOf,
  patchFileOf,
  extractConfig,
  writePatchConfig,
  findProjectRoot,
  withTimeout,
  userMessage,
  atomicWriteJson,
} from '../lib/index.js'

const tmpDirs = []

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-shared-'))
  tmpDirs.push(dir)
  return dir
}

test('config-store: currentProfile / profileDirOf / patchFileOf', () => {
  const dir = tempDir()
  const oldHome = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    assert.equal(currentProfile(), 'web', 'default profile is web')
    assert.equal(profileDirOf('web'), join(dir, 'profiles', 'web'), 'profile dir under $DSH_HOME/profiles')
    assert.equal(patchFileOf('web'), join(dir, 'profiles', 'web', 'cordis.patch.yml'), 'patch file name')
  } finally {
    process.env.DSH_HOME = oldHome
  }
})

test('config-store: extractConfig parses YAML subset and writePatchConfig round-trips', async () => {
  const dir = tempDir()
  const file = join(dir, 'cordis.patch.yml')
  writeFileSync(file, '- id: other\n  name: x\n', 'utf8')
  await writePatchConfig(file, 'shared', { end: false, apiToken: "it's a token", codes: [1, 2] })
  const text = readFileSync(file, 'utf8')
  assert.ok(text.includes('- id: other'), 'existing row preserved')
  assert.deepEqual(
    extractConfig(text, 'shared'),
    {
      end: false,
      apiToken: "it's a token",
      codes: [1, 2],
    },
    'round-trip read',
  )
  // 同 id 替换不重复
  await writePatchConfig(file, 'shared', { end: true })
  const lines = readFileSync(file, 'utf8').split('\n')
  assert.equal(lines.filter((l) => l === '- id: shared').length, 1, 'old row replaced')
})

test('config-store: extractConfig tolerates spacing variants after colon', () => {
  // 回归测试（CodeQL js/polynomial-redos 修复）：解析正则去掉 `\s*` 后，
  // 冒号后无空格 / 多空格 / 空值 的解析行为必须与原实现一致
  const text = ['- id: a', '  config:', '    k1: v1', '    k2:v2', '    k3:   v3', '    k4:', '    k5:   '].join('\n')
  assert.deepEqual(
    extractConfig(text, 'a'),
    { k1: 'v1', k2: 'v2', k3: 'v3' },
    'spacing variants parse identically; empty values are skipped',
  )
})

test('findProjectRoot walks up to the nearest .git ancestor', async () => {
  const dir = tempDir()
  const { mkdirSync } = await import('node:fs')
  mkdirSync(join(dir, 'repo', 'sub'), { recursive: true })
  mkdirSync(join(dir, 'repo', '.git'), { recursive: true })
  assert.equal(await findProjectRoot(join(dir, 'repo', 'sub')), join(dir, 'repo'), 'nearest .git ancestor')
  assert.equal(await findProjectRoot(join(dir, 'no-git-here')), join(dir, 'no-git-here'), 'no .git → cwd itself')
})

test('withTimeout resolves undefined on timeout and keeps the value on settle', async () => {
  const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 200))
  assert.equal(await withTimeout(slow, 20), undefined, 'timeout → undefined')
  const fast = Promise.resolve('ok')
  assert.equal(await withTimeout(fast, 100), 'ok', 'settled value kept')
  const rejected = Promise.reject(new Error('boom'))
  assert.equal(await withTimeout(rejected, 100), undefined, 'rejection → undefined (no throw)')
})

test('userMessage builds a user-role message with text block', () => {
  const msg = userMessage('hello')
  assert.equal(msg.role, 'user')
  assert.deepEqual(msg.content, [{ type: 'text', text: 'hello' }])
  assert.equal(msg.source.kind, 'user')
  assert.ok(msg.id.startsWith('msg-'), 'id generated')
})

test('atomicWriteJson writes tmp+rename and warns on failure', async () => {
  const dir = tempDir()
  const file = join(dir, 'nested', 'state.json')
  const warnings = []
  const logger = { warn: (m) => warnings.push(m) }
  await atomicWriteJson(file, { ok: true }, logger, '[test]')
  assert.equal(existsSync(file), true, 'file created (dirs auto-made)')
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { ok: true }, 'content written')
  // 失败路径：非法路径 → 告警不抛出
  await atomicWriteJson('/nonexistent-dir-xyz/state.json', { a: 1 }, logger, '[test]')
  assert.equal(warnings.length, 1, 'failure warned')
  assert.ok(warnings[0].includes('[test] persist failed'), 'warning carries prefix')
})
