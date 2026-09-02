import { test } from 'vitest'
/**
 * dsh-my-notify — issue #109 增强单测。
 *
 * 验证：
 *  - token-meter：session/event 的 assistant/message 真实 usage 按会话累加
 *    （input/output/cacheRead/cacheWrite/reasoning），summary 只读、drop 释放、
 *    会话隔离、非法值忽略、空 sessionId 忽略、非 assistant/message 不计量；
 *  - session.js：ask 完整问题提取（多问题全部列出「问题 N：…」，不截断），
 *    摘要(note)与完整(question)并存。
 */
import assert from 'node:assert/strict'
import { createTokenMeter } from '../lib/token-meter.js'
import { askQuestionsOf, askFullNoteOf, askNoteOf } from '../lib/session.js'

/** 构造一个 assistant/message usage 事件。 */
function usageEvent(usage, turn = 1) {
  return { type: 'assistant/message', data: { turn, step: 1, usage } }
}

test('envrichment suite', () => {
  // ── 1. token-meter：累加真实 usage（input/output/总计） ───────────────
  {
    const meter = createTokenMeter()
    meter.track(
      's1',
      usageEvent({ inputTokens: 100, outputTokens: 40, cacheReadTokens: 5, cacheWriteTokens: 2, reasoningTokens: 3 }),
    )
    meter.track('s1', usageEvent({ inputTokens: 60, outputTokens: 20 }))
    const summary = meter.summary('s1')
    assert.equal(summary.input, 160, 'input accumulated')
    assert.equal(summary.output, 60, 'output accumulated')
    assert.equal(summary.total, 220, 'total = input + output')
    assert.equal(summary.cacheRead, 5, 'cacheRead accumulated')
    assert.equal(summary.cacheWrite, 2, 'cacheWrite accumulated')
    assert.equal(summary.requests, 2, 'two requests counted')
    assert.equal(typeof summary.startedAt, 'number', 'startedAt recorded')
  }

  // ── 2. token-meter：metronome 非 assistant/message 不计量 ─────────────
  {
    const meter = createTokenMeter()
    meter.track('s1', { type: 'user/message', data: { message: { content: [] } } })
    assert.equal(meter.summary('s1'), undefined, 'no usage → no summary')
  }

  // ── 3. token-meter：usage 全 0 仍记录（调用方据 total 判「不可用」） ──
  {
    const meter = createTokenMeter()
    meter.track('s1', usageEvent({ inputTokens: 0, outputTokens: 0 }))
    const summary = meter.summary('s1')
    assert.equal(summary.total, 0, 'zero usage recorded as zero')
  }

  // ── 4. token-meter：会话隔离 ──────────────────────────────────────────
  {
    const meter = createTokenMeter()
    meter.track('a', usageEvent({ inputTokens: 10, outputTokens: 1 }))
    meter.track('b', usageEvent({ inputTokens: 20, outputTokens: 2 }))
    assert.equal(meter.summary('a').input, 10)
    assert.equal(meter.summary('b').input, 20)
    assert.equal(meter.summary('c'), undefined, 'unknown session undefined')
  }

  // ── 5. token-meter：drop 释放桶 ───────────────────────────────────────
  {
    const meter = createTokenMeter()
    meter.track('s1', usageEvent({ inputTokens: 10, outputTokens: 1 }))
    meter.drop('s1')
    assert.equal(meter.summary('s1'), undefined, 'dropped session no longer tracked')
  }

  // ── 6. token-meter：非法/缺失 usage 忽略（不硬造） ────────────────────
  {
    const meter = createTokenMeter()
    meter.track('s1', usageEvent({ inputTokens: -5, outputTokens: 'x' }))
    const summary = meter.summary('s1')
    assert.equal(summary.input, 0, 'negative/NaN input ignored')
    assert.equal(summary.total, 0)
  }

  // ── 7. token-meter：空 sessionId / 无 usage 对象忽略 ──────────────────
  {
    const meter = createTokenMeter()
    meter.track('', usageEvent({ inputTokens: 1 }))
    meter.track('s1', { type: 'assistant/message', data: { usage: null } })
    assert.equal(meter.summary('x'), undefined, 'empty sessionId ignored')
    assert.equal(meter.summary('s1'), undefined, 'null usage ignored')
  }

  // ── 8. session.js：ask 完整问题（多问题全部列出，不截断） ─────────────
  {
    const args = {
      questions: [
        { header: '确认部署' },
        { question: '请选择环境，这是很长的描述……\n第二行' },
        { question: '无关问题' },
      ],
    }
    assert.deepEqual(
      askQuestionsOf(args),
      ['确认部署', '请选择环境，这是很长的描述……\n第二行', '无关问题'],
      'all questions listed, header preferred, no truncation',
    )
    assert.equal(
      askFullNoteOf(args),
      '问题 1：确认部署\n问题 2：请选择环境，这是很长的描述……\n第二行\n问题 3：无关问题',
      'numbered full note for multiple questions',
    )
    assert.equal(askNoteOf(args), '确认部署', 'summary note is still the first header')
  }

  // ── 9. session.js：无问题 / 空数组 → 空串 ────────────────────────────
  {
    assert.deepEqual(askQuestionsOf({}), [], 'no questions → empty list')
    assert.deepEqual(askQuestionsOf({ questions: [] }), [], 'empty questions → empty list')
    assert.equal(askFullNoteOf({ questions: [] }), '', 'empty → empty note')
    assert.equal(askFullNoteOf(undefined), '', 'undefined → empty note')
  }

  // ── 10. session.js：问题只有 question 字段（无 header） ──────────────
  {
    const args = { questions: [{ question: '只问一个' }] }
    assert.deepEqual(askQuestionsOf(args), ['只问一个'])
    assert.equal(askFullNoteOf(args), '问题 1：只问一个')
  }

  console.log('ALL ENRICHMENT TESTS PASSED')
})
