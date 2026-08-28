/**
 * dsh-shared — http 单元测试：JSON 请求体读取与响应写入。
 *
 * 覆盖：正常 JSON 解析、空体默认 {}、超限拒绝、非法 JSON 抛错、
 * writeJson 状态码/头/体、writeError 错误消息序列化。
 * 行为基准：抽取前各插件 lib/http.js 的既有行为（issue #45）。
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readJsonBody, writeJson, writeError } from '../lib/http.js'

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

async function bodyOf(text) {
  return {
    async *[Symbol.asyncIterator]() {
      yield text
    },
  }
}

test('readJsonBody 解析 JSON 对象', async () => {
  const body = await readJsonBody(await bodyOf('{"a":1}'))
  assert.deepEqual(body, { a: 1 })
})

test('readJsonBody 空体返回 {}', async () => {
  const body = await readJsonBody(await bodyOf(''))
  assert.deepEqual(body, {})
})

test('readJsonBody 分块拼接', async () => {
  const request = {
    async *[Symbol.asyncIterator]() {
      yield '{"a"'
      yield ':1}'
    },
  }
  const body = await readJsonBody(request)
  assert.deepEqual(body, { a: 1 })
})

test('readJsonBody 超限抛错', async () => {
  const big = 'x'.repeat(1_000_001)
  await assert.rejects(async () => readJsonBody(await bodyOf(big)), /request body too large/)
})

test('readJsonBody 非法 JSON 抛错', async () => {
  await assert.rejects(async () => readJsonBody(await bodyOf('{not json')), SyntaxError)
})

test('writeJson 写入状态码/头/体', () => {
  const res = mockResponse()
  writeJson(res, 200, { ok: true })
  assert.equal(res.writeHeadStatus, 200)
  assert.deepEqual(res.writeHeadHeaders, {
    'content-type': 'application/json',
    'cache-control': 'no-cache',
  })
  assert.equal(res.ended, true)
  assert.equal(res.written.join(''), '{"ok":true}')
})

test('writeError 序列化 Error 消息为 400', () => {
  const res = mockResponse()
  writeError(res, new Error('boom'))
  assert.equal(res.writeHeadStatus, 400)
  assert.equal(res.written.join(''), '{"ok":false,"error":{"message":"boom"}}')
})

test('writeError 序列化非 Error 值', () => {
  const res = mockResponse()
  writeError(res, 'plain string')
  assert.equal(res.written.join(''), '{"ok":false,"error":{"message":"plain string"}}')
})
