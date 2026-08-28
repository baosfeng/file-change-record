/**
 * greeting 纯函数单元测试（直接 import tsc 编译产物 lib/greeting.js）。
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { buildGreeting } from '../lib/greeting.js'

test('buildGreeting 默认英文问候', () => {
  assert.equal(buildGreeting({ name: 'DSH' }), 'Hello, DSH!')
})

test('buildGreeting 中文问候', () => {
  assert.equal(buildGreeting({ name: 'DSH', language: 'zh' }), '你好，DSH！')
})

test('buildGreeting 空名回退默认问候', () => {
  assert.equal(buildGreeting({ name: '   ' }), 'Hello, DSH!')
  assert.equal(buildGreeting({ name: '   ', language: 'zh' }), '你好，DSH！')
})

test('buildGreeting 去除首尾空白', () => {
  assert.equal(buildGreeting({ name: '  DSH  ' }), 'Hello, DSH!')
})
