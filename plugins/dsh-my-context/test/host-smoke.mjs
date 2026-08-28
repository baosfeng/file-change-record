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
  assert.equal(name, 'dsh-my-context')
  assert.deepEqual(inject, ['webServer'])
  const { api, disposeAll } = bootPlugin({})
  assert.ok(api, 'prefix route /context/api registered')
  assert.equal(api.path, '/context/api')
  assert.equal(api.kind, 'prefix')
  disposeAll()
})

test('loopback requests pass the fence and get JSON back', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/context/api/status' }), res)
  assert.equal(res.writeHeadStatus, 200)
  const value = jsonOf(res)
  assert.equal(value.ok, true)
  assert.deepEqual(value.value.budget, { perTurn: 0, perSession: 0, mode: 'warn' })
  disposeAll()
})

test('cross-site requests are rejected by the fence', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/context/api/status', secFetchSite: 'cross-site' }), res)
  assert.equal(res.writeHeadStatus, 403)
  disposeAll()
})

test('teardown disposes effects without throwing', async () => {
  const handle = bootPlugin({})
  assert.doesNotThrow(() => handle.disposeAll())
})

test('GET /context/api/session without sessionId returns 400', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/context/api/session' }), res)
  assert.equal(res.writeHeadStatus, 400)
  disposeAll()
})

test('GET /context/api/session for unknown session returns 404', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/context/api/session?sessionId=nope' }), res)
  assert.equal(res.writeHeadStatus, 404)
  disposeAll()
})

test('unknown API method returns 404', async () => {
  const { api, disposeAll } = bootPlugin({})
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/context/api/nope' }), res)
  assert.equal(res.writeHeadStatus, 404)
  disposeAll()
})
