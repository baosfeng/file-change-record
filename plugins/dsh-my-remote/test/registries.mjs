import { describe, it, expect } from 'vitest'
/**
 * dsh-my-remote — 注册表单测（ask/approval 的登记/决议/清理语义）。
 */
import {
  createAskRegistry,
  createApprovalRegistry,
  NOT_FOUND,
  SESSION_END_ANSWER,
  SESSION_END_OUTCOME,
} from '../lib/registries.js'

describe('ask registry', () => {
  it('register creates a waitable entry and resolve settles it', async () => {
    const reg = createAskRegistry()
    const entry = reg.register('s1', [{ id: 'q1', question: '继续?', options: ['是', '否'] }], { raw: 1 })
    expect(entry).toBeDefined()
    expect(entry.sessionId).toBe('s1')
    expect(reg.peek('s1')).toMatchObject({ sessionId: 's1' })
    const promise = entry.waitFor
    const result = reg.resolve('s1', [{ id: 'q1', selected: ['是'] }])
    expect(result.ok).toBe(true)
    expect(result.answer).toEqual([{ id: 'q1', selected: ['是'] }])
    const settled = await promise
    expect(settled).toBe(entry)
    expect(reg.peek('s1')).toBeUndefined('resolved entry removed')
    expect(reg.listPending()).toEqual([])
  })

  it('resolve after consumption returns not-found', () => {
    const reg = createAskRegistry()
    reg.register('s1', [], {})
    expect(reg.resolve('s1', []).ok).toBe(true)
    const again = reg.resolve('s1', [])
    expect(again.ok).toBe(false)
    expect(again.code).toBe(NOT_FOUND)
  })

  it('double register with pending entry is rejected (defensive)', () => {
    const reg = createAskRegistry()
    expect(reg.register('s1', [], {})).toBeDefined()
    expect(reg.register('s1', [], {})).toBeUndefined()
  })

  it('cleanSession settles pending ask as expired', async () => {
    const reg = createAskRegistry()
    const entry = reg.register('s1', [], {})
    const settled = entry.waitFor.then((e) => e)
    reg.cleanSession('s1')
    const result = await settled
    expect(result).toBe(entry)
    expect(entry.answer).toBe(SESSION_END_ANSWER)
    expect(reg.listPending()).toEqual([])
  })

  it('invalid sessionId is rejected', () => {
    const reg = createAskRegistry()
    expect(reg.register('', [], {})).toBeUndefined()
    expect(reg.register(undefined, [], {})).toBeUndefined()
    expect(reg.resolve('missing', [])).toMatchObject({ ok: false, code: NOT_FOUND })
  })

  it('listPending returns copies not references', () => {
    const reg = createAskRegistry()
    reg.register('s1', [], {})
    const list = reg.listPending()
    list[0].id = 'tampered'
    expect(reg.peek('s1').id).not.toBe('tampered')
  })
})

describe('approval registry', () => {
  it('register + decide settles with outcome', async () => {
    const reg = createApprovalRegistry()
    const entry = reg.register('s1', { reason: 'rm -rf' })
    const settled = entry.waitFor.then((e) => e)
    const result = reg.decide('s1', 'allowed-once')
    expect(result.ok).toBe(true)
    expect(result.outcome).toBe('allowed-once')
    const entry2 = await settled
    expect(entry2).toBe(entry)
    expect(entry.outcome).toBe('allowed-once')
    expect(reg.listPending()).toEqual([])
  })

  it('unknown rejection outcome still settles (validate at commands layer)', async () => {
    const reg = createApprovalRegistry()
    reg.register('s1', {})
    const result = reg.decide('s1', 'rejected')
    expect(result.ok).toBe(true)
    expect(result.outcome).toBe('rejected')
  })

  it('decide after consumption returns not-found', () => {
    const reg = createApprovalRegistry()
    reg.register('s1', {})
    expect(reg.decide('s1', 'allowed-once').ok).toBe(true)
    expect(reg.decide('s1', 'rejected')).toMatchObject({ ok: false, code: NOT_FOUND })
  })

  it('cleanSession settles pending approval fail-closed to rejected', async () => {
    const reg = createApprovalRegistry()
    const entry = reg.register('s1', {})
    const settled = entry.waitFor.then((e) => e)
    reg.cleanSession('s1')
    const result = await settled
    expect(result.outcome).toBe(SESSION_END_OUTCOME)
  })
})
