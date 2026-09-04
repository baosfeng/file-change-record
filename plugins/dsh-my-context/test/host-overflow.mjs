/**
 * Overflow tests: context-length ratio computation, level classification
 * (warn/alert/critical), threshold normalization and clamping.
 *
 * ⚠️ 口径：溢出分级基于**当前上下文长度**（最近一次请求的 prompt token 数），
 * 而非历史累计 usage——累计 usage 的 cacheRead 每轮重复累加，会把占用
 * 虚高到窗口的多倍（真实案例：1M 窗口显示 6718.8%）。
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
  const result = overflowLevel(120, 0, {})
  assert.equal(result.ratio, 0)
  assert.equal(result.level, 'normal')
  assert.equal(result.window, 0)
})

test('overflowLevel: normal, warn, alert, critical thresholds', () => {
  // 80 / 100 = 0.8 → warn（默认 warnThreshold 0.8）
  const warnHit = overflowLevel(80, 100, {})
  assert.equal(warnHit.ratio, 0.8)
  assert.equal(warnHit.level, 'warn')
  assert.equal(warnHit.threshold, 0.8)

  // 90 / 100 = 0.9 → alert（默认 alertThreshold 0.9）
  const alertHit = overflowLevel(90, 100, {})
  assert.equal(alertHit.level, 'alert')
  assert.equal(alertHit.threshold, 0.9)

  // 95 / 100 = 0.95 → critical（固定 CRITICAL_THRESHOLD）
  const criticalHit = overflowLevel(95, 100, {})
  assert.equal(criticalHit.level, 'critical')
  assert.equal(criticalHit.threshold, CRITICAL_THRESHOLD)

  // 50 / 100 = 0.5 → normal
  const normal = overflowLevel(50, 100, {})
  assert.equal(normal.level, 'normal')
  assert.equal(normal.threshold, 0)
})

test('overflowLevel: context length = input + cacheRead + cacheWrite of the latest request', () => {
  // 最近一次请求 prompt 还原 = 60 + 20 + 10 = 90，window 100 → 0.9
  const result = overflowLevel(90, 100, {})
  assert.equal(result.used, 90)
  assert.equal(result.ratio, 0.9)
  assert.equal(result.level, 'alert')
})

test('overflowLevel: historical cumulative usage never drives the ratio', () => {
  // 回归：累计 usage（含每轮重复 cacheRead）高达 9,990，但当前上下文
  // 长度仅 300（上一个案例 300K/1M = 30%），比例必须基于当前长度。
  const result = overflowLevel(300, 1000, {})
  assert.equal(result.used, 300)
  assert.equal(result.ratio, 0.3)
  assert.equal(result.level, 'normal')
})

test('overflowLevel: custom thresholds are honored', () => {
  const cfg = { warnThreshold: 0.7, alertThreshold: 0.85 }
  const warnHit = overflowLevel(75, 100, cfg)
  assert.equal(warnHit.level, 'warn')
  const alertHit = overflowLevel(88, 100, cfg)
  assert.equal(alertHit.level, 'alert')
})

test('isOverflowing: normal false, warn/alert/critical true', () => {
  assert.equal(isOverflowing('normal'), false)
  assert.equal(isOverflowing('warn'), true)
  assert.equal(isOverflowing('alert'), true)
  assert.equal(isOverflowing('critical'), true)
})
