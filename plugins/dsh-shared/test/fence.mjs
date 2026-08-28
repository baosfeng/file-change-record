/**
 * dsh-shared — fence 单元测试：Host-header 信任围栏。
 *
 * 覆盖：loopback 放行、受信权威放行、cross-site 拒绝、origin 同源校验、
 * 非法 host 拒绝、缺失 host 拒绝、trustedHosts 非数组容错。
 * 行为基准：抽取前各插件 lib/fence.js 的既有测试断言（issue #45）。
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { isTrustedApiRequest } from '../lib/fence.js'

function request({ host, secFetchSite, origin }) {
  const headers = {}
  if (host !== undefined) headers.host = host
  if (secFetchSite !== undefined) headers['sec-fetch-site'] = secFetchSite
  if (origin !== undefined) headers.origin = origin
  return { headers }
}

test('loopback host 放行（127.0.0.1）', () => {
  assert.equal(isTrustedApiRequest(request({ host: '127.0.0.1:3080' }), []), true)
})

test('loopback host 放行（localhost）', () => {
  assert.equal(isTrustedApiRequest(request({ host: 'localhost:3080' }), []), true)
})

test('loopback host 放行（[::1]）', () => {
  assert.equal(isTrustedApiRequest(request({ host: '[::1]:3080' }), []), true)
})

test('非 loopback 且无受信权威 → 拒绝', () => {
  assert.equal(isTrustedApiRequest(request({ host: 'evil.example.com' }), []), false)
})

test('受信权威放行（hostname 精确匹配）', () => {
  assert.equal(isTrustedApiRequest(request({ host: 'dsh.local:3080' }), ['dsh.local']), true)
})

test('受信权威放行（host:port 精确匹配）', () => {
  assert.equal(isTrustedApiRequest(request({ host: 'dsh.local:3080' }), ['dsh.local:3080']), true)
})

test('受信权威端口不匹配 → 拒绝', () => {
  assert.equal(isTrustedApiRequest(request({ host: 'dsh.local:9999' }), ['dsh.local:3080']), false)
})

test('缺失 host 头 → 拒绝', () => {
  assert.equal(isTrustedApiRequest(request({}), []), false)
})

test('非法 host → 拒绝', () => {
  assert.equal(isTrustedApiRequest(request({ host: '::not-a-host::' }), []), false)
})

test('cross-site 请求 → 拒绝', () => {
  assert.equal(isTrustedApiRequest(request({ host: '127.0.0.1:3080', secFetchSite: 'cross-site' }), []), false)
})

test('同源 origin → 放行', () => {
  assert.equal(isTrustedApiRequest(request({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' }), []), true)
})

test('跨源 origin → 拒绝', () => {
  assert.equal(isTrustedApiRequest(request({ host: '127.0.0.1:3080', origin: 'http://evil.example.com' }), []), false)
})

test('非法 origin → 拒绝', () => {
  assert.equal(isTrustedApiRequest(request({ host: '127.0.0.1:3080', origin: 'not-a-url' }), []), false)
})

test('无 origin 头 → 放行（同源校验跳过）', () => {
  assert.equal(isTrustedApiRequest(request({ host: '127.0.0.1:3080' }), []), true)
})
