/**
 * Step definitions for dsh-shared Gherkin acceptance tests.
 * 直接调用 lib/fence.js 与 lib/http.js 的导出（纯函数，无运行时依赖）。
 */
import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { isTrustedApiRequest } from '../../../lib/fence.js'
import { readJsonBody, writeJson, writeError } from '../../../lib/http.js'

const world = {
  request: null,
  trustedHosts: [],
  body: null,
  response: null,
}

function mockResponse() {
  const res = {
    writeHeadStatus: 0,
    writeHeadHeaders: null,
    written: [],
    ended: false,
    writeHead(status, headers) {
      res.writeHeadStatus = status
      res.writeHeadHeaders = headers
    },
    write(chunk) {
      res.written.push(String(chunk))
      return true
    },
    end(value) {
      res.ended = true
      if (value !== undefined) res.written.push(String(value))
    },
  }
  return res
}

Given('请求 host 为 {string}', function (host) {
  world.request = { headers: { host } }
})

Given('请求 host 为 {string} 且无受信权威', function (host) {
  world.request = { headers: { host } }
  world.trustedHosts = []
})

Given('请求 host 为 {string} 且受信权威含 {string}', function (host, trusted) {
  world.request = { headers: { host } }
  world.trustedHosts = [trusted]
})

Given('请求 host 为 {string} 且 sec-fetch-site 为 {string}', function (host, site) {
  world.request = { headers: { host, 'sec-fetch-site': site } }
})

Given('请求 host 为 {string} 且 origin 为 {string}', function (host, origin) {
  world.request = { headers: { host, origin } }
})

Then('信任围栏判定为可信', function () {
  assert.equal(isTrustedApiRequest(world.request, world.trustedHosts), true)
})

Then('信任围栏判定为不可信', function () {
  assert.equal(isTrustedApiRequest(world.request, world.trustedHosts), false)
})

Given('请求体为 {string}', function (text) {
  world.body = {
    async *[Symbol.asyncIterator]() {
      yield text
    },
  }
})

When('读取 JSON 请求体', async function () {
  world.body = await readJsonBody(world.body)
})

Then('得到对象 {string}', function (expected) {
  assert.deepEqual(world.body, JSON.parse(expected))
})

When('写入 JSON 响应 状态码 {int} 值 {string}', function (status, value) {
  world.response = mockResponse()
  writeJson(world.response, status, JSON.parse(value))
})

Then('响应状态码为 {int} 且内容为 {string}', function (status, expected) {
  assert.equal(world.response.writeHeadStatus, status)
  assert.equal(world.response.written.join(''), expected)
})

When('写入错误响应 消息 {string}', function (message) {
  world.response = mockResponse()
  writeError(world.response, new Error(message))
})

Then('响应状态码为 {int} 且内容含错误消息 {string}', function (status, message) {
  assert.equal(world.response.writeHeadStatus, status)
  const payload = JSON.parse(world.response.written.join(''))
  assert.equal(payload.ok, false)
  assert.equal(payload.error.message, message)
})
