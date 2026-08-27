/**
 * Step definitions for dsh-my-notify config-visibility Gherkin acceptance tests
 * (issue #27). Drives the /notify/api/config GET/PUT routes and asserts the
 * read-write loop, immediate effect, persistence across a simulated restart,
 * and invalid-input rejection. World + shared steps live in world.mjs /
 * notify.steps.mjs.
 */
import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parsePairs } from './world.mjs'
import { extractConfig, patchFileOf } from '../../../lib/config-store.js'

// ── When ──────────────────────────────────────────────────────────────────
When('读取配置接口', async function () {
  await this.getConfig()
})

When('保存配置 {string}', async function (pairs) {
  await this.putConfig(parsePairs(pairs))
})

When('保存非法配置 {string}', async function (pairs) {
  await this.putConfig(parsePairs(pairs))
})

When('模拟重启', async function () {
  // 同一 DSH_HOME 重新 apply，config 来自 patch 文件
  for (const dispose of this.disposers.splice(0)) dispose()
  const persisted = extractConfig(readFileSync(patchFileOf('web'), 'utf8'), 'notify')
  this.boot(persisted)
})

// ── Then ──────────────────────────────────────────────────────────────────
Then('配置包含默认值 {string}', async function (pairs) {
  const expected = parsePairs(pairs)
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(this.lastConfig[key], value, `config.${key} defaults to ${value}`)
  }
})

Then('配置包含 {string}', async function (pairs) {
  const expected = parsePairs(pairs)
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(this.lastConfig[key], value, `config.${key} is ${value}`)
  }
})

Then('读取配置得到 {string}', async function (pairs) {
  await this.getConfig()
  const expected = parsePairs(pairs)
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(this.lastConfig[key], value, `config.${key} is ${value}`)
  }
})

Then('读取配置得到 {string}（未被修改）', async function (pairs) {
  await this.getConfig()
  const expected = parsePairs(pairs)
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(this.lastConfig[key], value, `config.${key} is ${value}`)
  }
})
