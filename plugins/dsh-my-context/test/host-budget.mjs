/**
 * Budget tests: usage totals, per-turn / per-session limit checks,
 * config normalization (invalid values fall back to defaults).
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { usageTotal, checkBudget, normalizeBudgetConfig } from '../lib/budget.js'

test('usageTotal: disjoint buckets restored to full total', () => {
  assert.equal(usageTotal(null), 0)
  assert.equal(usageTotal({}), 0)
  assert.equal(usageTotal({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 3, cacheWriteTokens: 2 }), 20)
  assert.equal(usageTotal({ inputTokens: -1, outputTokens: 'x' }), 0)
})

test('checkBudget: no limits always ok', () => {
  const usage = { inputTokens: 100, outputTokens: 50 }
  const turn = { inputTokens: 10, outputTokens: 5 }
  assert.deepEqual(checkBudget(usage, turn, { perTurn: 0, perSession: 0 }), { ok: true })
  assert.deepEqual(checkBudget(usage, turn, {}), { ok: true })
  assert.deepEqual(checkBudget(usage, turn, undefined), { ok: true })
})

test('checkBudget: per-turn limit hit', () => {
  const usage = { inputTokens: 100, outputTokens: 50 }
  const turn = { inputTokens: 10, outputTokens: 5 }
  const result = checkBudget(usage, turn, { perTurn: 10, perSession: 0 })
  assert.equal(result.ok, false)
  assert.equal(result.scope, 'turn')
  assert.equal(result.limit, 10)
  assert.equal(result.used, 15)
})

test('checkBudget: per-session limit hit (turn under limit)', () => {
  const usage = { inputTokens: 100, outputTokens: 50 }
  const turn = { inputTokens: 1, outputTokens: 1 }
  const result = checkBudget(usage, turn, { perTurn: 1000, perSession: 100 })
  assert.equal(result.ok, false)
  assert.equal(result.scope, 'session')
  assert.equal(result.used, 150)
})

test('checkBudget: turn limit takes precedence over session', () => {
  const usage = { inputTokens: 100, outputTokens: 50 }
  const turn = { inputTokens: 20, outputTokens: 0 }
  const result = checkBudget(usage, turn, { perTurn: 10, perSession: 100 })
  assert.equal(result.scope, 'turn')
})

test('checkBudget: boundary equal to limit is ok', () => {
  const usage = { inputTokens: 10, outputTokens: 0 }
  const result = checkBudget(usage, { inputTokens: 0 }, { perTurn: 10, perSession: 0 })
  assert.equal(result.ok, true)
})

test('normalizeBudgetConfig: defaults and invalid fallback', () => {
  assert.deepEqual(normalizeBudgetConfig(undefined), { perTurn: 0, perSession: 0, mode: 'warn' })
  assert.deepEqual(normalizeBudgetConfig({}), { perTurn: 0, perSession: 0, mode: 'warn' })
  assert.deepEqual(normalizeBudgetConfig({ perTurn: 100, perSession: 200, mode: 'deny' }), {
    perTurn: 100,
    perSession: 200,
    mode: 'deny',
  })
  assert.deepEqual(normalizeBudgetConfig({ perTurn: -5, perSession: 1.9, mode: 'bogus' }), {
    perTurn: 0,
    perSession: 1,
    mode: 'warn',
  })
  assert.deepEqual(normalizeBudgetConfig({ perTurn: 'x', perSession: NaN }), {
    perTurn: 0,
    perSession: 0,
    mode: 'warn',
  })
})
