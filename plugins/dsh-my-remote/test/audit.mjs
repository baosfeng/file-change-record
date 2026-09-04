import { describe, it, expect } from 'vitest'
/**
 * dsh-my-remote — 操作审计单测（环形缓冲 / 字段规整 / 快照拷贝）。
 */
import { createAuditLog, AUDIT_LIMIT } from '../lib/audit.js'

describe('audit log', () => {
  it('records entries newest-first with normalized fields', () => {
    const log = createAuditLog()
    log.record({ action: 'answer', sessionId: 's1', source: '10.0.0.1', ok: true, detail: 'answered 1' })
    log.record({ action: 'approve', sessionId: 's2', source: 'local', ok: false, detail: 'no pending' })
    const list = log.list()
    expect(list).toHaveLength(2)
    expect(list[0].action).toBe('approve')
    expect(list[1].action).toBe('answer')
    expect(list[0].time).toBeTypeOf('number')
  })

  it('caps buffer at limit, dropping oldest', () => {
    const log = createAuditLog(3)
    for (let i = 0; i < 5; i += 1) log.record({ action: 'continue', detail: `#${i}` })
    const list = log.list()
    expect(list).toHaveLength(3)
    expect(list.map((e) => e.detail)).toEqual(['#4', '#3', '#2'])
  })

  it('missing fields default safely', () => {
    const log = createAuditLog()
    log.record({ action: 'answer' })
    const entry = log.list()[0]
    expect(entry.sessionId).toBe('')
    expect(entry.source).toBe('')
    expect(entry.ok).toBe(false)
    expect(entry.detail).toBe('')
  })

  it('list returns a copy (mutation does not affect log)', () => {
    const log = createAuditLog()
    log.record({ action: 'answer' })
    const A = log.list()
    A[0].detail = 'tampered'
    expect(log.list()[0].detail).toBe('')
  })

  it('default limit is 100', () => {
    expect(AUDIT_LIMIT).toBe(100)
  })
})
