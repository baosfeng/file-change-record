/**
 * Smoke tests: plugin contract (inject), route registration, default
 * config, loopback fence acceptance, teardown cleanliness.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  bootPlugin, mockRequest, mockResponse, invoke, jsonOf,
} from './lib/helpers.mjs'

test('plugin contract: name + inject + route registration', async () => {
  const { name, inject } = await import('../lib/index.js')
  assert.equal(name, 'dsh-my-guard')
  assert.deepEqual(inject, ['webServer'])
  const { api, disposeAll } = bootPlugin({})
  assert.ok(api, 'prefix route /guard/api registered')
  assert.equal(api.path, '/guard/api')
  assert.equal(api.kind, 'prefix')
  disposeAll()
})

test('loopback requests pass the fence and get JSON back', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/guard/api/status' }), res)
  assert.equal(res.writeHeadStatus, 200)
  const value = jsonOf(res)
  assert.equal(value.ok, true)
  assert.equal(value.value.mode, 'observe', 'guard mode defaults to observe')
  assert.equal(value.value.poisonScan, true, 'poison scan defaults on')
  assert.equal(value.value.injection, true, 'injection detection defaults on')
  disposeAll()
})

test('non-loopback host is rejected by the fence', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/guard/api/status', host: 'evil.example.com' }), res)
  assert.equal(res.writeHeadStatus, 403)
  disposeAll()
})

test('cross-site requests are rejected by the fence', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/guard/api/status', secFetchSite: 'cross-site' }), res)
  assert.equal(res.writeHeadStatus, 403)
  disposeAll()
})

test('unknown API method returns 404', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/guard/api/nope' }), res)
  assert.equal(res.writeHeadStatus, 404)
  disposeAll()
})

test('teardown disposes effects without throwing', async () => {
  const handle = bootPlugin({})
  assert.doesNotThrow(() => handle.disposeAll())
})

test('GET /guard/api/alerts without session returns empty list', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/guard/api/alerts' }), res)
  assert.equal(res.writeHeadStatus, 200)
  assert.deepEqual(jsonOf(res).value, [])
  disposeAll()
})
