/**
 * Smoke tests: plugin contract (inject), route registration, default
 * config, loopback fence acceptance, teardown cleanliness.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { bootPlugin, mockRequest, mockResponse, invoke, jsonOf } from './lib/helpers.mjs'

test('plugin contract: name + inject + route registration', async () => {
  const { name, inject } = await import('../lib/index.js')
  assert.equal(name, 'dsh-my-observability')
  assert.deepEqual(inject, ['webServer'])
  const { api, disposeAll } = bootPlugin({})
  assert.ok(api, 'prefix route /observability/api registered')
  assert.equal(api.path, '/observability/api')
  assert.equal(api.kind, 'prefix')
  disposeAll()
})

test('loopback requests pass the fence and get JSON back', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/observability/api/status' }), res)
  assert.equal(res.writeHeadStatus, 200)
  const value = jsonOf(res)
  assert.equal(value.ok, true)
  assert.equal(value.value.aiReview, true, 'aiReview defaults on')
  disposeAll()
})

test('teardown disposes effects without throwing', async () => {
  const handle = bootPlugin({})
  assert.doesNotThrow(() => handle.disposeAll())
})

test('GET /observability/api/events without session returns empty list', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/observability/api/events' }), res)
  assert.equal(res.writeHeadStatus, 200)
  assert.deepEqual(jsonOf(res).value, [])
  disposeAll()
})
