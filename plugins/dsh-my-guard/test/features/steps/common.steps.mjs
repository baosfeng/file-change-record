/**
 * Shared step definitions for dsh-my-guard Gherkin acceptance tests.
 *
 * 三个 feature 共用的步骤（插件启动、告警断言）集中在此，避免
 * cucumber 的 multiple matching step definitions 冲突。
 */
import { Given, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

// ── Given ─────────────────────────────────────────────────────────────────
Given('安全护栏插件已启动', async function () {
  this.boot({})
  await new Promise((resolve) => setTimeout(resolve, 60))
})

// ── Then ──────────────────────────────────────────────────────────────────
Then('产生 {int} 条 {string} 告警', async function (count, type) {
  const alerts = await this.waitForAlerts(0)
  const filtered = alerts.filter((a) => a.type === type)
  assert.equal(filtered.length, count)
})

Then('告警严重度为 {string}', async function (severity) {
  const alerts = await this.waitForAlerts(1)
  assert.equal(alerts[0].severity, severity)
})
