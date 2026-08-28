/**
 * dsh-task-reliability — reasoning-loop detection.
 *
 * 依赖 constants.js（REPEAT_* 常量）。对 llm/stream 做 n-gram 相似度
 * 检测：连续高相似判定为思考循环 → 抛错中断回合（REASONING_LOOP）。
 */

import { REPEAT_BUFFER, REPEAT_CONSECUTIVE, REPEAT_MAX_PER_SESSION, REPEAT_SIM_THRESHOLD } from './constants.js'

/** 两段文本的 4-gram Jaccard 相似度。 */
function similarityOf(a, b) {
  const grams = (text) => {
    const set = new Set()
    const norm = text.replace(/\s+/g, ' ')
    for (let i = 0; i + 4 <= norm.length; i++) set.add(norm.slice(i, i + 4))
    return set
  }
  const ga = grams(a)
  const gb = grams(b)
  if (ga.size === 0 || gb.size === 0) return 0
  let common = 0
  for (const g of ga) if (gb.has(g)) common++
  return common / (ga.size + gb.size - common)
}

/** 段落列表是否构成思考循环：连续 REPEAT_CONSECUTIVE 个相邻对高相似。 */
function detectReasoningLoop(segments) {
  if (segments.length < REPEAT_CONSECUTIVE + 1) return false
  let streak = 0
  for (let i = 1; i < segments.length; i++) {
    const sim = similarityOf(segments[i - 1], segments[i])
    if (sim >= REPEAT_SIM_THRESHOLD) streak++
    else streak = 0
    if (streak >= REPEAT_CONSECUTIVE) return true
  }
  return false
}

function isStreamChunk(chunk) {
  return chunk !== null && typeof chunk === 'object'
}

function appendDelta(buffers, chunk) {
  const buffer = buffers.get(chunk.index)
  if (buffer !== undefined && buffer.type === 'reasoning') buffer.text += chunk.text
}

/** block-end 收尾：累积段落、判环、计数并（在未放弃时）抛错。 */
function handleBlockEnd(buffer, segments, repeatState) {
  if (buffer.type !== 'reasoning') return
  const text = buffer.text.trim()
  if (text.length < 50) return
  segments.push(text)
  if (segments.length > REPEAT_BUFFER) segments.shift()
  if (repeatState.gaveUp) return
  if (!detectReasoningLoop(segments)) return
  repeatState.count += 1
  if (repeatState.count > REPEAT_MAX_PER_SESSION) {
    repeatState.gaveUp = true
    repeatState.notified = false
    return
  }
  const error = new Error(`reasoning loop detected (count=${repeatState.count})`)
  error.code = 'REASONING_LOOP'
  throw error
}

/** 包装模型流：透传全部 chunk，检测 reasoning 段落重复；命中抛错中断回合。 */
export function wrapStreamForLoop(stream, repeatState) {
  const buffers = new Map()
  const segments = []
  return (async function* () {
    for await (const chunk of stream) {
      yield chunk
      if (!isStreamChunk(chunk)) continue
      if (chunk.type === 'block-start') {
        buffers.set(chunk.index, { type: chunk.blockType, text: '' })
      } else if (chunk.type === 'reasoning-delta') {
        appendDelta(buffers, chunk)
      } else if (chunk.type === 'block-end') {
        const buffer = buffers.get(chunk.index)
        buffers.delete(chunk.index)
        if (buffer !== undefined) handleBlockEnd(buffer, segments, repeatState)
      }
    }
  })()
}
