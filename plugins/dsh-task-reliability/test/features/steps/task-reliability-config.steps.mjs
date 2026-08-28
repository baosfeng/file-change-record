/**
 * Step definitions for dsh-task-reliability config-visibility Gherkin
 * acceptance tests (issue #27). Drives the /task-reliability/api/config
 * GET/PUT routes and asserts the read-write loop, immediate effect on
 * options, persistence across a simulated restart, and invalid-input
 * rejection. World + shared steps live in world.mjs /
 * task-reliability.steps.mjs.
 */
import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extractConfig, patchFileOf } from 'dsh-shared'

/** 解析 "key=value key2=value2" 为对象（布尔/数字/字符串）。 */
function parsePairs(text) {
  const result = {}
  for (const part of text.split(/\s+/)) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq)
    const value = part.slice(eq + 1)
    if (value === 'true') result[key] = true
    else if (value === 'false') result[key] = false
    else if (/^\d+$/.test(value)) result[key] = Number(value)
    else result[key] = value
  }
  return result
}

// ── When ──────────────────────────────────────────────────────────────────
When('读取配置接口', async function () {
  await this.getConfig()
})

When('保存配置 {string}', async function (pairs) {
  await this.putConfig(parsePairs(pairs))
})

When('保存非法配置 {string}', async function (pairs) {
  const payload = pairs === 'null' ? null : parsePairs(pairs)
  await this.putConfig(payload)
})

When('模拟重启', async function () {
  // 同一 DSH_HOME 重新 apply，config 来自 patch 文件
  const dir = this.dir
  for (const dispose of this.disposers.splice(0)) dispose()
  const persisted = extractConfig(readFileSync(patchFileOf('web'), 'utf8'), 'task-reliability')
  this.boot(persisted, dir)
})

// ── Then ──────────────────────────────────────────────────────────────────
Then('响应状态码为 {int}', async function (status) {
  assert.equal(this.lastResponse.status, status)
})

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
