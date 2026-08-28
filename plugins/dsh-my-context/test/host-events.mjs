/**
 * Events tests: session/event stats (header/context/messages/requests),
 * agent/pre-step budget warn & deny, alert cooldown, passthrough.
 */
import { test, afterAll } from 'vitest'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { bootPlugin, dispatchEvent, sessionEvent, preStepPayload, settle, mockRequest, mockResponse, invoke, jsonOf } from './lib/helpers.mjs'
import { isInjection } from '../lib/events.js'

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

test('session/event: request/header updates system/tools estimates', async () => {
  const handle = boot({})
  await settle()
  const { session, event } = sessionEvent('s-1', 'request/header', {
    header: { system: 'abcd', tools: [{ name: 'bash' }], config: { model: 'deepseek-v4', provider: 'deepseek' } },
    reason: 'initial',
  })
  await dispatchEvent(handle.listeners, 'session/event', session, event)
  await settle()
  const stats = await sessionStats(handle, 's-1')
  assert.ok(stats.header.systemTokens > 0)
  assert.ok(stats.header.toolsTokens > 0)
  assert.equal(stats.model, 'deepseek-v4')
  assert.equal(stats.provider, 'deepseek')
  handle.disposeAll()
})

test('session/event: user/message with injection source goes to inject', async () => {
  const handle = boot({})
  await settle()
  const { session, event } = sessionEvent('s-1', 'user/message', {
    content: [{ type: 'text', text: 'abcd' }],
    source: { kind: 'plugin', form: 'notice', plugin: 'dsh-x' },
  })
  await dispatchEvent(handle.listeners, 'session/event', session, event)
  await settle()
  const stats = await sessionStats(handle, 's-1')
  assert.ok(stats.composition.inject > 0)
  assert.equal(stats.composition.user, 0)
  handle.disposeAll()
})

test('session/event: assistant/message records request with real usage', async () => {
  const handle = boot({})
  await settle()
  const { session, event } = sessionEvent('s-1', 'assistant/message', {
    turn: 1,
    step: 2,
    message: { content: [{ type: 'text', text: 'hello world' }], source: { provider: 'deepseek', model: 'deepseek-v4' } },
    usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 30 },
  })
  await dispatchEvent(handle.listeners, 'session/event', session, event)
  await settle()
  const stats = await sessionStats(handle, 's-1')
  assert.equal(stats.usage.inputTokens, 100)
  assert.equal(stats.usage.outputTokens, 20)
  assert.equal(stats.usage.cacheReadTokens, 30)
  assert.equal(stats.requests.length, 1)
  assert.equal(stats.requests[0].turn, 1)
  assert.equal(stats.requests[0].step, 2)
  assert.equal(stats.requests[0].prompt, 130)
  assert.equal(stats.requests[0].total, 150)
  assert.ok(stats.composition.assistant > 0)
  handle.disposeAll()
})

test('session/event: empty assistant message adds no composition but records usage', async () => {
  const handle = boot({})
  await settle()
  const { session, event } = sessionEvent('s-1', 'assistant/message', {
    turn: 1,
    step: 1,
    message: { content: [], source: { provider: 'deepseek', model: 'deepseek-v4' } },
    usage: { inputTokens: 10, outputTokens: 5 },
  })
  await dispatchEvent(handle.listeners, 'session/event', session, event)
  await settle()
  const stats = await sessionStats(handle, 's-1')
  assert.equal(stats.composition.assistant, 0)
  assert.equal(stats.requests.length, 1)
  handle.disposeAll()
})

test('session/event: tool/result adds tool composition', async () => {
  const handle = boot({})
  await settle()
  const { session, event } = sessionEvent('s-1', 'tool/result', {
    message: { content: [{ type: 'tool-result', content: [{ type: 'text', text: 'ok' }] }] },
  })
  await dispatchEvent(handle.listeners, 'session/event', session, event)
  await settle()
  const stats = await sessionStats(handle, 's-1')
  assert.ok(stats.composition.tool > 0)
  handle.disposeAll()
})

test('session/event: turn/start resets turn usage', async () => {
  const handle = boot({})
  await settle()
  const { session, event } = sessionEvent('s-1', 'assistant/message', {
    turn: 1, step: 1,
    message: { content: [{ type: 'text', text: 'x' }] },
    usage: { inputTokens: 50, outputTokens: 5 },
  })
  await dispatchEvent(handle.listeners, 'session/event', session, event)
  const { session: s2, event: e2 } = sessionEvent('s-1', 'turn/start', { turn: 2 })
  await dispatchEvent(handle.listeners, 'session/event', s2, e2)
  await settle()
  const stats = await sessionStats(handle, 's-1')
  assert.equal(stats.usage.inputTokens, 50)
  assert.equal(stats.turnUsage.inputTokens, 0)
  assert.equal(stats.turnUsage.turn, 2)
  handle.disposeAll()
})

test('agent/pre-step: warn mode records alert and passes through', async () => {
  const handle = boot({ perTurn: 10, mode: 'warn' })
  await settle()
  const { session, event } = sessionEvent('s-1', 'assistant/message', {
    turn: 1, step: 1,
    message: { content: [{ type: 'text', text: 'x' }] },
    usage: { inputTokens: 50, outputTokens: 5 },
  })
  await dispatchEvent(handle.listeners, 'session/event', session, event)
  await settle()
  let nextCalled = false
  const decision = await dispatchEvent(handle.listeners, 'agent/pre-step', preStepPayload('s-1'), async () => {
    nextCalled = true
    return { kind: 'enter', messages: [] }
  })
  assert.equal(nextCalled, true, 'warn mode passes through next()')
  assert.equal(decision.kind, 'enter')
  const stats = await sessionStats(handle, 's-1')
  assert.equal(stats.alerts.length, 1)
  assert.equal(stats.alerts[0].scope, 'turn')
  assert.equal(stats.alerts[0].blocked, false)
  handle.disposeAll()
})

test('agent/pre-step: deny mode rejects and records blocked alert', async () => {
  const handle = boot({ perTurn: 10, mode: 'deny' })
  await settle()
  const { session, event } = sessionEvent('s-1', 'assistant/message', {
    turn: 1, step: 1,
    message: { content: [{ type: 'text', text: 'x' }] },
    usage: { inputTokens: 50, outputTokens: 5 },
  })
  await dispatchEvent(handle.listeners, 'session/event', session, event)
  await settle()
  let nextCalled = false
  const decision = await dispatchEvent(handle.listeners, 'agent/pre-step', preStepPayload('s-1'), async () => {
    nextCalled = true
    return { kind: 'enter', messages: [] }
  })
  assert.equal(nextCalled, false, 'deny mode does not call next()')
  assert.deepEqual(decision, { kind: 'reject' })
  const stats = await sessionStats(handle, 's-1')
  assert.equal(stats.alerts.length, 1)
  assert.equal(stats.alerts[0].blocked, true)
  handle.disposeAll()
})

test('agent/pre-step: under budget passes through without alert', async () => {
  const handle = boot({ perTurn: 1000, mode: 'deny' })
  await settle()
  const { session, event } = sessionEvent('s-1', 'assistant/message', {
    turn: 1, step: 1,
    message: { content: [{ type: 'text', text: 'x' }] },
    usage: { inputTokens: 5, outputTokens: 1 },
  })
  await dispatchEvent(handle.listeners, 'session/event', session, event)
  await settle()
  const decision = await dispatchEvent(handle.listeners, 'agent/pre-step', preStepPayload('s-1'), async () => ({ kind: 'enter', messages: [] }))
  assert.equal(decision.kind, 'enter')
  const stats = await sessionStats(handle, 's-1')
  assert.equal(stats.alerts.length, 0)
  handle.disposeAll()
})

test('agent/pre-step: unknown session or missing agent passes through', async () => {
  const handle = boot({ perTurn: 1, mode: 'deny' })
  await settle()
  const decision1 = await dispatchEvent(handle.listeners, 'agent/pre-step', preStepPayload('ghost'), async () => ({ kind: 'enter', messages: [] }))
  assert.equal(decision1.kind, 'enter')
  const decision2 = await dispatchEvent(handle.listeners, 'agent/pre-step', { turn: 1 }, async () => ({ kind: 'enter', messages: [] }))
  assert.equal(decision2.kind, 'enter')
  handle.disposeAll()
})

test('agent/pre-step: alert cooldown suppresses duplicate alerts', async () => {
  const handle = boot({ perTurn: 10, mode: 'warn' })
  await settle()
  const { session, event } = sessionEvent('s-1', 'assistant/message', {
    turn: 1, step: 1,
    message: { content: [{ type: 'text', text: 'x' }] },
    usage: { inputTokens: 50, outputTokens: 5 },
  })
  await dispatchEvent(handle.listeners, 'session/event', session, event)
  await settle()
  await dispatchEvent(handle.listeners, 'agent/pre-step', preStepPayload('s-1'), async () => ({ kind: 'enter', messages: [] }))
  await dispatchEvent(handle.listeners, 'agent/pre-step', preStepPayload('s-1'), async () => ({ kind: 'enter', messages: [] }))
  await settle()
  const stats = await sessionStats(handle, 's-1')
  assert.equal(stats.alerts.length, 1, 'cooldown suppresses duplicate alert')
  handle.disposeAll()
})

test('isInjection: source classification', () => {
  assert.equal(isInjection(null), false)
  assert.equal(isInjection({ kind: 'user' }), false)
  assert.equal(isInjection({ kind: 'plugin' }), true)
  assert.equal(isInjection({ form: 'notice' }), true)
  assert.equal(isInjection({ kind: '' }), false)
})

/** 通过 API 路由读取会话统计（与 UI 同路径）。 */
async function sessionStats(handle, sessionId) {
  const res = mockResponse()
  await invoke(handle.api, mockRequest({ url: `/context/api/session?sessionId=${sessionId}` }), res)
  const body = jsonOf(res)
  assert.equal(body.ok, true, `session stats readable: ${JSON.stringify(body)}`)
  return body.value
}
