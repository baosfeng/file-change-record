/**
 * Step definitions for dsh-my-guard Gherkin acceptance tests (custom-rules.feature).
 */
import { Given, When, Then, After } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bashExec } from '../../lib/helpers.mjs'

const NOTIFY_BASE = 'http://127.0.0.1:9999'

// ── Given ─────────────────────────────────────────────────────────────────
Given('护栏插件已启动且自定义规则 {string} 为 {string} 严重级 {string}', async function (pattern, mode, severity) {
  this.boot({ customRules: [{ pattern, mode, severity, description: '自定义测试规则' }] })
  await new Promise((resolve) => setTimeout(resolve, 60))
})

Given('安全护栏插件已启动且开启告警通知', async function () {
  this.notifyCalls = []
  this.origFetch = global.fetch
  global.fetch = async (url, init) => {
    this.notifyCalls.push({ url, body: JSON.parse(init.body) })
    return { ok: true }
  }
  this.boot({ notifyEnabled: true, notifyCooldownMs: 60000, notifyBaseUrl: NOTIFY_BASE })
  await new Promise((resolve) => setTimeout(resolve, 60))
})

// ── When ─────────────────────────────────────────────────────────────────
When('通过规则测试接口测试命令 {string}', async function (command) {
  await this.invoke('/guard/api/rules/test', { method: 'POST', body: JSON.stringify({ command }) })
})

When('通过规则保存接口保存自定义规则 {string}', async function (pattern) {
  await this.invoke('/guard/api/rules', {
    method: 'POST',
    body: JSON.stringify({
      customRules: [{ pattern, mode: 'deny', severity: 'high', description: '自定义测试规则' }],
      notifyEnabled: true,
      notifyCooldownMs: 15000,
    }),
  })
})

When('代理 {string} 再次执行命令 {string}', async function (agentId, command) {
  await this.dispatch('tools/pre-execute', bashExec(agentId, command), async () => ({ kind: 'allow' }))
})

// ── Then ──────────────────────────────────────────────────────────────────
Then('规则测试命中 {int} 条规则', function (count) {
  assert.equal(this.lastResponse.status, 200)
  assert.equal(this.lastValue.hits.length, count)
})

Then('合并决策模式为 {string}', function (mode) {
  assert.equal(this.lastValue.decision.mode, mode)
})

Then('规则保存生效且持久化到配置', function () {
  assert.equal(this.lastResponse.status, 200)
  assert.equal(this.lastValue.customRules.length, 1)
  const patchFile = join(this.sharedHome, 'profiles', 'web', 'cordis.patch.yml')
  assert.ok(existsSync(patchFile), 'patch file exists')
  assert.ok(readFileSync(patchFile, 'utf8').includes('- id: guard'))
})

Then('推送了 {int} 条告警通知', function (count) {
  assert.equal((this.notifyCalls ?? []).length, count)
})

After(async function () {
  if (this.origFetch !== undefined) global.fetch = this.origFetch
})
