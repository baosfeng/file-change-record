/**
 * Step definitions for dsh-my-guard Gherkin acceptance tests (guard.feature).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { bashExec } from '../../lib/helpers.mjs'

// ── Given ─────────────────────────────────────────────────────────────────
Given('安全护栏插件已启动且模式为 {string}', async function (mode) {
  this.boot({ mode })
  await new Promise((resolve) => setTimeout(resolve, 60))
})

// ── When ──────────────────────────────────────────────────────────────────
When('代理 {string} 执行命令 {string}', async function (agentId, command) {
  await this.dispatch('tools/pre-execute', bashExec(agentId, command), async () => ({ kind: 'allow' }))
})

When('代理 {string} 执行命令 {string} 且下游决策为拒绝', async function (agentId, command) {
  await this.dispatch('tools/pre-execute', bashExec(agentId, command), async () => ({ kind: 'deny', reason: 'sandbox denied' }))
})

When('代理 {string} 调用非 bash 工具', async function (agentId) {
  await this.dispatch('tools/pre-execute',
    { name: 'read', callId: 'c1', agent: { id: agentId }, arguments: { file_path: '/x' } },
    async () => ({ kind: 'allow' }))
})

// ── Then ────────────────────────────────────────────────────────────────────
Then('工具决策保持为 {string}', function (kind) {
  assert.equal(this.lastDecision.kind, kind)
})

Then('工具决策为 {string} 且原因包含 {string}', function (kind, fragment) {
  assert.equal(this.lastDecision.kind, kind)
  assert.ok(this.lastDecision.reason.includes(fragment), `reason: ${this.lastDecision.reason}`)
})
