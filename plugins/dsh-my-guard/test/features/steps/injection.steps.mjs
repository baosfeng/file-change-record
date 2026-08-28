/**
 * Step definitions for dsh-my-guard Gherkin acceptance tests (injection.feature).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { userMessageEvent } from '../../lib/helpers.mjs'

// ── Given ─────────────────────────────────────────────────────────────────
Given('安全护栏插件已启动且注入检测关闭', async function () {
  this.boot({ injection: false })
  await new Promise((resolve) => setTimeout(resolve, 60))
})

// ── When ──────────────────────────────────────────────────────────────────
When('用户 {string} 发送消息 {string}', async function (sessionId, text) {
  await this.dispatch('session/event', { id: sessionId }, userMessageEvent(text))
})

When('插件向会话注入消息 {string}', async function (text) {
  await this.dispatch('session/event', { id: 's-1' }, userMessageEvent(text, { kind: 'plugin' }))
})

When('通过 API 检测文本 {string}', async function (text) {
  await this.invoke('/guard/api/scan-prompt', { method: 'POST', body: JSON.stringify({ text }) })
})

// ── Then ──────────────────────────────────────────────────────────────────
Then('告警规则为 {string}', async function (rule) {
  const alerts = await this.waitForAlerts(1)
  assert.equal(alerts[0].detail.rule, rule)
})

Then('检测结果包含 {string} 规则', function (rule) {
  assert.equal(this.lastResponse.status, 200)
  assert.ok(
    this.lastValue.hits.some((h) => h.id === rule),
    `hits: ${JSON.stringify(this.lastValue.hits)}`,
  )
})
