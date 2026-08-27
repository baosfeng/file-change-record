/**
 * Step definitions for dsh-plugin-manager Gherkin acceptance tests.
 * Boots the API handler against a mocked pluginInventory + real fence,
 * mirroring host-api.mjs: installed filtering (issue #28), official
 * namespace classification, market search and the trust fence.
 */
import { Given, When, Then, setWorldConstructor } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApiHandler, isOfficialModule } from '../../../lib/api-route.js'
import { isTrustedApiRequest } from '../../../lib/fence.js'

class World {
  constructor() {
    this.profileDir = mkdtempSync(join(tmpdir(), 'dpm-feature-'))
    this.entries = []
    this.lastStatus = 0
    this.lastJson = null
    this.lastModuleName = ''
  }

  makeResponse() {
    return {
      _status: 0,
      _body: '',
      writeHead(status) {
        this._status = status
      },
      end(body) {
        this._body = body ?? ''
      },
    }
  }

  makeRequest(method, url, headers) {
    return {
      method,
      url,
      headers: { host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin', origin: 'http://127.0.0.1:3080', ...(headers ?? {}) },
      [Symbol.asyncIterator]() {
        const chunks = []
        let i = 0
        return {
          next: () => Promise.resolve(i < chunks.length ? { value: chunks[i++], done: false } : { done: true }),
        }
      },
    }
  }

  async call(method, url, headers) {
    const ctx = {
      logger: { warn: () => {} },
      webRuntime: { trustedHosts: [] },
      pluginInventory: { list: () => ({ entries: this.entries }) },
    }
    const handler = createApiHandler({
      ctx,
      profile: 'web',
      profileDir: this.profileDir,
      fence: (request) => isTrustedApiRequest(request, ctx.webRuntime.trustedHosts),
    })
    const res = this.makeResponse()
    await handler(this.makeRequest(method, url, headers), res)
    this.lastStatus = res._status
    this.lastJson = res._body === '' ? null : JSON.parse(res._body)
  }
}

setWorldConstructor(World)

Given('loader 已加载官方插件 {string}', function (name) {
  this.entries.push({ moduleName: name, enabled: true, fiberPhase: 'active' })
})

Given('loader 已加载用户插件 {string}', function (name) {
  this.entries.push({ moduleName: name, enabled: true, fiberPhase: 'active' })
})

Given('插件名为 {string}', function (name) {
  this.lastModuleName = name
})

When('请求已安装清单', async function () {
  await this.call('GET', '/plugin-manager/api/installed')
})

When('用非回环 host 请求已安装清单', async function () {
  await this.call('GET', '/plugin-manager/api/installed', { host: 'evil.example', 'sec-fetch-site': 'cross-site' })
})

When('搜索关键词 {string} 返回官方与用户结果', async function (query) {
  const originalFetch = global.fetch
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      objects: [
        { package: { name: '@deepseek-ai/dsh-base', version: '1.0.0', description: 'official', author: 'deepseek', date: '', homepage: '', repository: '' } },
        { package: { name: 'dsh-a', version: '0.1.0', description: 'user', author: 'alice', date: '', homepage: '', repository: '' } },
      ],
    }),
  })
  try {
    await this.call('GET', `/plugin-manager/api/search?q=${encodeURIComponent(query)}`)
  } finally {
    global.fetch = originalFetch
  }
})

Then('响应包含 {int} 个条目', function (count) {
  assert.equal(this.lastStatus, 200)
  assert.equal(this.lastJson.value.entries.length, count)
})

Then('条目 {string} 存在且 official 为 false', function (name) {
  const hit = this.lastJson.value.entries.find((e) => e.moduleName === name)
  assert.ok(hit, `entry ${name} present`)
  assert.equal(hit.official, false)
})

Then('条目 {string} 存在', function (name) {
  const hit = this.lastJson.value.entries.find((e) => e.moduleName === name)
  assert.ok(hit, `entry ${name} present`)
})

Then('响应不包含官方插件 {string}', function (name) {
  assert.ok(!this.lastJson.value.entries.some((e) => e.moduleName === name), `official ${name} filtered out`)
})

Then('该插件被判定为官方', function () {
  assert.equal(isOfficialModule(this.lastModuleName), true)
})

Then('该插件不被判定为官方', function () {
  assert.equal(isOfficialModule(this.lastModuleName), false)
})

Then('搜索结果包含 {string}', function (name) {
  assert.ok(this.lastJson.value.results.some((r) => r.name === name), `search result ${name} present`)
})

Then('响应状态码为 {int}', function (status) {
  assert.equal(this.lastStatus, status)
})
