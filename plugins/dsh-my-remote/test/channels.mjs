import { describe, it, expect } from 'vitest'
/**
 * dsh-my-remote — 渠道层单测（HTTP 适配器推送 / 重试 / 失败记录 / 事件匹配）。
 */
import { createChannels, pushEvent, RETRY_MAX } from '../lib/channels.js'

/** 立即返回结果的 sleep（测试不等待真实退避）。 */
const instantSleep = () => Promise.resolve()

describe('channels controller', () => {
  it('dispatch pushes matching enabled webhooks with the event frame', async () => {
    const calls = []
    const fetchImpl = async (url, options) => {
      calls.push({ url, options })
      return { ok: true }
    }
    const options = {
      webhooks: [
        { name: 'all', url: 'https://a.example/hook', enabled: true },
        { name: 'ask-only', url: 'https://b.example/hook', events: ['ask'], enabled: true },
        { name: 'disabled', url: 'https://c.example/hook', enabled: false },
      ],
    }
    const channels = createChannels(options, { fetchImpl, sleep: instantSleep })
    channels.dispatch({ kind: 'ask', sessionId: 's1', title: 'T', questions: [] })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toHaveLength(2)
    expect(calls[0].url).toBe('https://a.example/hook')
    const body = JSON.parse(calls[0].options.body)
    expect(body.kind).toBe('ask')
    expect(body.sessionId).toBe('s1')
    expect(calls[0].options.headers['content-type']).toBe('application/json')
    expect(calls[1].url).toBe('https://b.example/hook')
  })

  it('dispatch respects events filter (non-matching not pushed)', async () => {
    const calls = []
    const fetchImpl = async (url) => {
      calls.push(url)
      return { ok: true }
    }
    const options = { webhooks: [{ name: 'end-only', url: 'https://e.example/hook', events: ['end'] }] }
    const channels = createChannels(options, { fetchImpl, sleep: instantSleep })
    channels.dispatch({ kind: 'approval', sessionId: 's1' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toHaveLength(0)
  })

  it('records failure after retries exhausted (visible via failures.list)', async () => {
    const fetchImpl = async () => {
      throw new Error('boom')
    }
    const options = { webhooks: [{ name: 'w', url: 'https://f.example/hook' }] }
    const channels = createChannels(options, { fetchImpl, sleep: instantSleep })
    channels.dispatch({ kind: 'end', sessionId: 's1' })
    // fire-and-forget：轮询失败记录出现
    const deadline = Date.now() + 2000
    while (Date.now() < deadline) {
      if (channels.failures.list().length > 0) break
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    const failures = channels.failures.list()
    expect(failures).toHaveLength(1)
    expect(failures[0].webhookName).toBe('w')
    expect(failures[0].error).toBe('boom')
  })

  it('empty url is an immediate failure', async () => {
    const result = await pushEvent({ name: 'bad', url: '' }, { kind: 'end' }, { sleep: instantSleep })
    expect(result.ok).toBe(false)
    expect(result.failure.url).toBe('')
    expect(result.failure.error).toBe('empty webhook url')
  })

  it('non-ok response retries then fails', async () => {
    let count = 0
    const fetchImpl = async () => {
      count += 1
      return { ok: false }
    }
    const result = await pushEvent(
      { name: 'w', url: 'https://x.example/hook' },
      { kind: 'ask' },
      { fetchImpl, sleep: instantSleep },
    )
    expect(result.ok).toBe(false)
    expect(count).toBe(RETRY_MAX + 1)
    expect(result.failure.attempts).toBe(RETRY_MAX + 1)
    expect(result.failure.error).toBe('HTTP false')
  })

  it('succeeds on first ok response', async () => {
    const fetchImpl = async () => ({ ok: true })
    const result = await pushEvent(
      { name: 'w', url: 'https://y.example/hook' },
      { kind: 'ask' },
      { fetchImpl, sleep: instantSleep },
    )
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(1)
  })

  it('extra headers are forwarded when present', async () => {
    let seen = null
    const fetchImpl = async (url, options) => {
      seen = options.headers
      return { ok: true }
    }
    await pushEvent(
      { name: 'w', url: 'https://z.example/hook', headers: { authorization: 'Bearer x', 'x-api-key': 'k' } },
      { kind: 'ask' },
      { fetchImpl, sleep: instantSleep },
    )
    expect(seen.authorization).toBe('Bearer x')
    expect(seen['x-api-key']).toBe('k')
  })
})
