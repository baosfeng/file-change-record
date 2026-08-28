/**
 * Store tests: alert recording, query filters, persistence + restart
 * recovery, pending buffering, confirm, FIFO cap, corrupt file fallback.
 */
import { test, afterAll } from 'vitest'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_ALERTS } from '../lib/constants.js'
import {
  bootPlugin,
  createTempHome,
  mockRequest,
  mockResponse,
  invoke,
  jsonOf,
  settle,
  dispatchEvent,
} from './lib/helpers.mjs'

const disposeAlls = []
const tmpDirs = []
afterAll(() => {
  for (const disposeAll of disposeAlls.splice(0)) disposeAll()
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function boot(config, opts) {
  const handle = bootPlugin(config, opts)
  disposeAlls.push(handle.disposeAll)
  return handle
}

function bashExec(agentId, command) {
  return {
    name: 'bash',
    callId: `call-${Math.random()}`,
    agent: { id: agentId },
    arguments: { command },
  }
}

function dispatch(listeners, exec, next) {
  return dispatchEvent(listeners, 'tools/pre-execute', exec, next)
}

async function fetchAlerts(api, query = '') {
  await settle(60)
  const res = mockResponse()
  await invoke(api, mockRequest({ url: `/guard/api/alerts${query}` }), res)
  return jsonOf(res).value
}

test('alerts are returned newest-first with type filter and limit', async () => {
  const { listeners, api, disposeAll } = boot({})
  const next = async () => ({ kind: 'allow' })
  await dispatch(listeners, bashExec('s-1', 'rm -rf /'), next)
  await dispatch(listeners, bashExec('s-1', 'rm -rf /'), next)
  await dispatch(listeners, bashExec('s-1', 'ls -la'), next)
  const all = await fetchAlerts(api)
  assert.equal(all.length, 2)
  assert.ok(all[0].time >= all[1].time, 'newest first')
  const filtered = await fetchAlerts(api, '?type=destructive')
  assert.equal(filtered.length, 2)
  const limited = await fetchAlerts(api, '?limit=1')
  assert.equal(limited.length, 1)
  const bySession = await fetchAlerts(api, '?sessionId=s-1')
  assert.equal(bySession.length, 2)
  const otherSession = await fetchAlerts(api, '?sessionId=s-other')
  assert.equal(otherSession.length, 0)
  disposeAll()
})

test('alerts persist and survive a plugin restart', async () => {
  const home = createTempHome()
  tmpDirs.push(home)
  const first = boot({}, { home })
  await dispatch(first.listeners, bashExec('s-1', 'rm -rf /'), async () => ({ kind: 'allow' }))
  await settle(600)
  first.disposeAll()
  disposeAlls.splice(disposeAlls.indexOf(first.disposeAll), 1)

  const second = boot({}, { home })
  const alerts = await fetchAlerts(second.api)
  assert.equal(alerts.length, 1, 'alert restored after restart')
  assert.equal(alerts[0].type, 'destructive')
  second.disposeAll()
  disposeAlls.splice(disposeAlls.indexOf(second.disposeAll), 1)
})

test('alerts recorded before load completes are buffered, not lost', async () => {
  const home = createTempHome()
  tmpDirs.push(home)
  const first = boot({}, { home })
  await dispatch(first.listeners, bashExec('s-1', 'rm -rf /'), async () => ({ kind: 'allow' }))
  await settle(600)
  first.disposeAll()
  disposeAlls.splice(disposeAlls.indexOf(first.disposeAll), 1)

  const second = boot({}, { home })
  // 立即记录（加载可能未完成）→ 缓冲
  await dispatch(second.listeners, bashExec('s-2', 'rm -rf /'), async () => ({ kind: 'allow' }))
  await settle(600)
  const alerts = await fetchAlerts(second.api)
  assert.equal(alerts.length, 2, 'buffered alert merged with loaded state')
  second.disposeAll()
  disposeAlls.splice(disposeAlls.indexOf(second.disposeAll), 1)
})

test('confirm marks an alert as confirmed', async () => {
  const { listeners, api, disposeAll } = boot({})
  await dispatch(listeners, bashExec('s-1', 'rm -rf /'), async () => ({ kind: 'allow' }))
  const alerts = await fetchAlerts(api)
  const id = alerts[0].id
  assert.equal(alerts[0].confirmed, false)
  const res = mockResponse()
  await invoke(
    api,
    mockRequest({ url: '/guard/api/alerts/confirm', method: 'POST', body: JSON.stringify({ id }) }),
    res,
  )
  assert.equal(res.writeHeadStatus, 200)
  assert.equal(jsonOf(res).value.confirmed, true)
  const after = await fetchAlerts(api)
  assert.equal(after[0].confirmed, true)
  assert.ok(typeof after[0].confirmedAt === 'number')
  disposeAll()
})

test('confirm with unknown id returns confirmed:false', async () => {
  const { api, disposeAll } = boot({})
  const res = mockResponse()
  await invoke(
    api,
    mockRequest({
      url: '/guard/api/alerts/confirm',
      method: 'POST',
      body: JSON.stringify({ id: 9999 }),
    }),
    res,
  )
  assert.equal(jsonOf(res).value.confirmed, false)
  disposeAll()
})

test('corrupt state file falls back to empty state', async () => {
  const home = createTempHome()
  tmpDirs.push(home)
  mkdirSync(join(home, 'guard'), { recursive: true })
  writeFileSync(join(home, 'guard', 'alerts.json'), 'not json{{{')
  const { api, disposeAll } = boot({}, { home })
  const alerts = await fetchAlerts(api)
  assert.deepEqual(alerts, [])
  disposeAll()
})

test('invalid alert entries are filtered on load', async () => {
  const home = createTempHome()
  tmpDirs.push(home)
  mkdirSync(join(home, 'guard'), { recursive: true })
  writeFileSync(
    join(home, 'guard', 'alerts.json'),
    JSON.stringify({
      version: 1,
      alerts: [
        { time: 1, type: 'destructive', message: 'ok' },
        { time: 'bad', type: 'destructive', message: 'bad time' },
        { type: 'no-time' },
      ],
    }),
  )
  const { api, disposeAll } = boot({}, { home })
  const alerts = await fetchAlerts(api)
  assert.equal(alerts.length, 1)
  disposeAll()
})

test('alert cap evicts oldest alerts FIFO', async () => {
  const { listeners, api, disposeAll } = boot({})
  for (let i = 0; i < MAX_ALERTS + 50; i += 1) {
    await dispatch(listeners, bashExec('s-1', 'rm -rf /'), async () => ({ kind: 'allow' }))
  }
  const alerts = await fetchAlerts(api)
  assert.equal(alerts.length, MAX_ALERTS)
  disposeAll()
})

test('status reports alert count and config', async () => {
  const { listeners, api, disposeAll } = boot({ mode: 'ask' })
  await dispatch(listeners, bashExec('s-1', 'rm -rf /'), async () => ({ kind: 'allow' }))
  await settle(60)
  const res = mockResponse()
  await invoke(api, mockRequest({ url: '/guard/api/status' }), res)
  const value = jsonOf(res).value
  assert.equal(value.alertCount, 1)
  assert.equal(value.mode, 'ask')
  disposeAll()
})

test('persisted file is written atomically under guard dir', async () => {
  const home = createTempHome()
  tmpDirs.push(home)
  const { listeners, disposeAll } = boot({}, { home })
  await dispatch(listeners, bashExec('s-1', 'rm -rf /'), async () => ({ kind: 'allow' }))
  await settle(600)
  disposeAll()
  disposeAlls.splice(disposeAlls.indexOf(disposeAll), 1)
  const file = join(home, 'guard', 'alerts.json')
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(parsed.alerts.length, 1)
  assert.equal(parsed.alerts[0].type, 'destructive')
})
