/**
 * Overflow tests: usage ratio computation, level classification
 * (warn/alert/critical), threshold normalization and clamping.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { CRITICAL_THRESHOLD, normalizeOverflowConfig, overflowLevel, isOverflowing } from '../lib/overflow.js'

test('normalizeOverflowConfig: defaults for missing/invalid input', () => {
  assert.deepEqual(normalizeOverflowConfig(undefined), { warnThreshold: 0.8, alertThreshold: 0.9 })
  assert.deepEqual(normalizeOverflowConfig(null), { warnThreshold: 0.8, alertThreshold: 0.9 })
  assert.deepEqual(normalizeOverflowConfig({}), { warnThreshold: 0.8, alertThreshold: 0.9 })
  assert.deepEqual(normalizeOverflowConfig({ warnThreshold: 'x', alertThreshold: NaN }), {
    warnThreshold: 0.8,
    alertThreshold: 0.9,
  })
})

test('normalizeOverflowConfig: accepts custom and clamps to [0,1]', () => {
  assert.deepEqual(normalizeOverflowConfig({ warnThreshold: 0.6, alertThreshold: 0.7 }), {
    warnThreshold: 0.6,
    alertThreshold: 0.7,
  })
  assert.deepEqual(normalizeOverflowConfig({ warnThreshold: -1, alertThreshold: 1.5 }), {
    warnThreshold: 0,
    alertThreshold: 1,
  })
})

test('overflowLevel: unknown window stays normal with ratio 0', () => {
  const result = overflowLevel({ inputTokens: 100, outputTokens: 20 }, 0, {})
  assert.equal(result.ratio, 0)
  assert.equal(result.level, 'normal')
  assert.equal(result.window, 0)
})

test('overflowLevel: normal, warn, alert, critical thresholds', () => {
  // 80 / 100 = 0.8 → warn（默认 warnThreshold 0.8）
  const warnHit = overflowLevel({ inputTokens: 80, outputTokens: 0 }, 100, {})
  assert.equal(warnHit.ratio, 0.8)
  assert.equal(warnHit.level, 'warn')
  assert.equal(warnHit.threshold, 0.8)

  // 90 / 100 = 0.9 → alert（默认 alertThreshold 0.9）
  const alertHit = overflowLevel({ inputTokens: 90, outputTokens: 0 }, 100, {})
  assert.equal(alertHit.level, 'alert')
  assert.equal(alertHit.threshold, 0.9)

  // 95 / 100 = 0.95 → critical（固定 CRITICAL_THRESHOLD）
  const criticalHit = overflowLevel({ inputTokens: 95, outputTokens: 0 }, 100, {})
  assert.equal(criticalHit.level, 'critical')
  assert.equal(criticalHit.threshold, CRITICAL_THRESHOLD)

  // 50 / 100 = 0.5 → normal
  const normal = overflowLevel({ inputTokens: 50, outputTokens: 0 }, 100, {})
  assert.equal(normal.level, 'normal')
  assert.equal(normal.threshold, 0)
})

test('overflowLevel: cumulative total (disjoint restore) drives the ratio', () => {
  // 输入 60 + 缓存读 20 + 缓存写 10 = 90（disjoint 还原），window 100 → 0.9
  const result = overflowLevel({ inputTokens: 60, cacheReadTokens: 20, cacheWriteTokens: 10, outputTokens: 0 }, 100, {})
  assert.equal(result.used, 90)
  assert.equal(result.ratio, 0.9)
  assert.equal(result.level, 'alert')
})

test('overflowLevel: custom thresholds are honored', () => {
  const cfg = { warnThreshold: 0.7, alertThreshold: 0.85 }
  const warnHit = overflowLevel({ inputTokens: 75, outputTokens: 0 }, 100, cfg)
  assert.equal(warnHit.level, 'warn')
  const alertHit = overflowLevel({ inputTokens: 88, outputTokens: 0 }, 100, cfg)
  assert.equal(alertHit.level, 'alert')
})

test('isOverflowing: normal false, warn/alert/critical true', () => {
  assert.equal(isOverflowing('normal'), false)
  assert.equal(isOverflowing('warn'), true)
  assert.equal(isOverflowing('alert'), true)
  assert.equal(isOverflowing('critical'), true)
})
