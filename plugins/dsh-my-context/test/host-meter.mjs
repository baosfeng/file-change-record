/**
 * Meter tests: token estimation pure functions (text/blocks/message/
 * system/tools/tool-schema), empty & malformed inputs.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  estimateText,
  estimateBlocks,
  estimateMessage,
  estimateSystem,
  estimateTools,
  estimateToolSchema,
  isEmptyMessage,
} from '../lib/meter.js'

test('estimateText: ~4 chars per token + block overhead', () => {
  assert.equal(estimateText(''), 0)
  assert.equal(estimateText('abcd'), 1 + 4)
  assert.equal(estimateText('abcdefgh'), 2 + 4)
  assert.equal(estimateText(undefined), 0)
  assert.equal(estimateText(123), 0)
})

test('estimateBlocks: text/reasoning/tool-call/tool-result/image/other', () => {
  assert.equal(estimateBlocks(undefined), 0)
  assert.equal(estimateBlocks(null), 0)
  assert.equal(estimateBlocks([]), 0)
  assert.equal(estimateBlocks([{ type: 'text', text: 'abcd' }]), 1 + 4)
  assert.equal(estimateBlocks([{ type: 'reasoning', text: 'abcd' }]), 1 + 4)
  const toolCall = { type: 'tool-call', name: 'bash', arguments: '{"command":"ls"}' }
  assert.equal(estimateBlocks([toolCall]), estimateText('bash') + estimateText('{"command":"ls"}') + 4)
  const nested = { type: 'tool-result', content: [{ type: 'text', text: 'ok' }] }
  assert.equal(estimateBlocks([nested]), estimateText('ok') + 4)
  const image = { type: 'image', attachment: { width: 100, height: 100 } }
  assert.ok(estimateBlocks([image]) > 0)
  assert.equal(estimateBlocks([null]), 4)
  assert.equal(estimateBlocks([{ type: 'unknown' }]), estimateText('{"type":"unknown"}') + 4)
})

test('estimateMessage: blocks + role framing; empty message 0', () => {
  assert.equal(estimateMessage(null), 0)
  assert.equal(estimateMessage({}), 0)
  assert.equal(estimateMessage({ content: [] }), 0)
  assert.equal(estimateMessage({ content: [{ type: 'text', text: 'abcd' }] }), 1 + 4 + 4)
})

test('estimateSystem: text + role framing', () => {
  assert.equal(estimateSystem(''), 0)
  assert.equal(estimateSystem(undefined), 0)
  assert.equal(estimateSystem('abcd'), 1 + 4)
})

test('estimateTools: whole-array price; empty 0', () => {
  assert.equal(estimateTools(undefined), 0)
  assert.equal(estimateTools([]), 0)
  assert.equal(estimateTools([{ name: 'bash' }]), Math.ceil(JSON.stringify([{ name: 'bash' }]).length / 4) + 4)
})

test('estimateToolSchema: single tool price; malformed 0', () => {
  assert.equal(estimateToolSchema(null), 0)
  assert.equal(estimateToolSchema({ name: 'bash' }), Math.ceil(JSON.stringify({ name: 'bash' }).length / 4) + 4)
})

test('isEmptyMessage: empty content detection', () => {
  assert.equal(isEmptyMessage(null), true)
  assert.equal(isEmptyMessage({}), true)
  assert.equal(isEmptyMessage({ content: [] }), true)
  assert.equal(isEmptyMessage({ content: [{ type: 'text', text: 'x' }] }), false)
})
