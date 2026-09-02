import { test } from 'vitest'
/**
 * dsh-my-notify — 出站 webhook 推送调度单测（issue #92）。
 *
 * 验证：
 *  - dispatchWebhooks 事件匹配（events 白名单 / 空 = 全部 / enabled 开关）；
 *  - pushWebhook 成功路径（1 次尝试，POST JSON + content-type）；
 *  - 失败重试：3 次指数退避（1s/2s/4s），共 4 次尝试，onFailure 记录；
 *  - HTTP 非 2xx 视为失败重试；网络异常重试；超时（AbortController）；
 *  - buildUrl 把签名 query 追加到 URL（保留已有 query）。
 *
 * 全部依赖注入（fetchImpl / now / sleep / timeoutMs），无真实网络与等待。
 */
import assert from 'node:assert/strict'
import { dispatchWebhooks, pushWebhook, buildUrl, backoffMs, RETRY_MAX, TIMEOUT_MS } from '../lib/webhook/pusher.js'

const notice = { kind: 'end', sessionId: 's1', title: '标题', note: '摘要', agentType: 'top', time: 123 }

/** 记录调用并返回固定响应的 mock fetch。 */
function mockFetch(handler) {
  const calls = []
  const impl = async (url, options) => {
    calls.push({ url, options })
    return handler(url, options)
  }
  impl.calls = calls
  return impl
}

/** 记录退避等待时长的 mock sleep。 */
function mockSleep() {
  const waits = []
  const impl = async (ms) => {
    waits.push(ms)
  }
  impl.waits = waits
  return impl
}

test('webhook pusher suite', async () => {
  // ── 1. backoffMs：1s / 2s / 4s 指数退避 ──────────────────────────────
  assert.equal(backoffMs(1), 1000)
  assert.equal(backoffMs(2), 2000)
  assert.equal(backoffMs(3), 4000)
  assert.equal(RETRY_MAX, 3, 'three retries after the initial attempt')
  assert.equal(TIMEOUT_MS, 5000, 'default timeout is 5s')

  // ── 2. buildUrl：签名 query 追加（保留已有 query，searchParams 编码） ──
  {
    assert.equal(
      buildUrl('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc', {}),
      'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc',
    )
    const url = buildUrl('https://oapi.dingtalk.com/robot/send?access_token=t', {
      timestamp: '1700000000000',
      sign: 'abc+def/=',
    })
    assert.equal(
      url,
      'https://oapi.dingtalk.com/robot/send?access_token=t&timestamp=1700000000000&sign=abc%2Bdef%2F%3D',
    )
  }

  // ── 3. dispatchWebhooks 事件匹配：白名单命中才推送 ──────────────────
  {
    const fetchImpl = mockFetch(() => ({ ok: true }))
    const webhooks = [
      { name: 'end-only', type: 'wecom', url: 'https://a.example/hook', events: ['end'], enabled: true },
      { name: 'ask-only', type: 'wecom', url: 'https://b.example/hook', events: ['ask'], enabled: true },
    ]
    await dispatchWebhooks(webhooks, notice, { fetchImpl })
    assert.equal(fetchImpl.calls.length, 1, 'only the end-matching webhook is pushed')
    assert.ok(fetchImpl.calls[0].url.startsWith('https://a.example/hook'), 'end webhook URL used')
  }

  // ── 4. dispatchWebhooks：空 events = 全部；enabled:false 跳过 ────────
  {
    const fetchImpl = mockFetch(() => ({ ok: true }))
    const webhooks = [
      { name: 'all', type: 'generic', url: 'https://a.example/hook', events: [], enabled: true },
      { name: 'off', type: 'generic', url: 'https://b.example/hook', events: ['end'], enabled: false },
    ]
    await dispatchWebhooks(webhooks, notice, { fetchImpl })
    assert.equal(fetchImpl.calls.length, 1, 'empty events matches all; disabled webhook skipped')
    assert.ok(fetchImpl.calls[0].url.startsWith('https://a.example/hook'))
  }

  // ── 5. pushWebhook 成功：1 次尝试，POST JSON ─────────────────────────
  {
    const fetchImpl = mockFetch((url, options) => {
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['content-type'], 'application/json')
      const body = JSON.parse(options.body)
      assert.equal(body.msgtype, 'text')
      assert.ok(body.text.content.includes('标题'), 'message carries the title')
      return { ok: true }
    })
    const result = await pushWebhook(
      { name: 'w', type: 'wecom', url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc', events: ['end'] },
      notice,
      { fetchImpl, now: () => 1700000000000 },
    )
    assert.deepEqual(result, { ok: true, attempts: 1 })
  }

  // ── 6. 失败重试：3 次退避（1s/2s/4s），共 4 次尝试，onFailure 记录 ──
  {
    const fetchImpl = mockFetch(() => {
      throw new Error('network down')
    })
    const sleep = mockSleep()
    const failures = []
    const result = await pushWebhook({ name: 'w', type: 'wecom', url: 'https://a.example/hook' }, notice, {
      fetchImpl,
      now: () => 1700000000000,
      sleep,
      onFailure: (f) => failures.push(f),
    })
    assert.equal(fetchImpl.calls.length, 4, 'initial + 3 retries')
    assert.deepEqual(sleep.waits, [1000, 2000, 4000], 'exponential backoff 1s/2s/4s')
    assert.equal(result.ok, false)
    assert.equal(result.attempts, 4)
    assert.equal(failures.length, 1, 'failure recorded once')
    assert.equal(failures[0].webhookName, 'w')
    assert.equal(failures[0].channel, 'wecom')
    assert.equal(failures[0].error, 'network down')
    assert.equal(failures[0].attempts, 4)
    assert.equal(failures[0].time, 1700000000000)
  }

  // ── 7. HTTP 非 2xx 视为失败并重试 ───────────────────────────────────
  {
    const fetchImpl = mockFetch(() => ({ ok: false }))
    const sleep = mockSleep()
    const result = await pushWebhook({ name: 'w', type: 'generic', url: 'https://a.example/hook' }, notice, {
      fetchImpl,
      sleep,
    })
    assert.equal(fetchImpl.calls.length, 4, 'non-ok response retried')
    assert.equal(result.ok, false)
    assert.ok(result.error.includes('HTTP'), 'error mentions the HTTP status')
  }

  // ── 8. 中途成功：第 2 次尝试成功 → 不再重试 ──────────────────────────
  {
    let attempts = 0
    const fetchImpl = mockFetch(() => {
      attempts += 1
      return attempts >= 2 ? { ok: true } : { ok: false }
    })
    const sleep = mockSleep()
    const result = await pushWebhook({ name: 'w', type: 'generic', url: 'https://a.example/hook' }, notice, {
      fetchImpl,
      sleep,
    })
    assert.equal(attempts, 2, 'second attempt succeeds')
    assert.deepEqual(result, { ok: true, attempts: 2 })
    assert.deepEqual(sleep.waits, [1000], 'only one backoff before the retry')
  }

  // ── 9. 超时：AbortController 中止挂起请求 → 重试 → 失败记录 ─────────
  {
    const fetchImpl = mockFetch((_url, options) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')))
      })
    })
    const sleep = mockSleep()
    const failures = []
    const result = await pushWebhook({ name: 'w', type: 'generic', url: 'https://a.example/hook' }, notice, {
      fetchImpl,
      sleep,
      timeoutMs: 5,
      onFailure: (f) => failures.push(f),
    })
    assert.equal(fetchImpl.calls.length, 4, 'timeout retried like any failure')
    assert.equal(result.ok, false)
    assert.equal(failures.length, 1)
    assert.equal(failures[0].error, 'aborted')
  }

  // ── 10. 签名参数进入最终 URL（wecom 加签） ──────────────────────────
  {
    const fetchImpl = mockFetch(() => ({ ok: true }))
    await pushWebhook(
      {
        name: 'w',
        type: 'wecom',
        secret: 'SECabc123',
        url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc',
      },
      notice,
      { fetchImpl, now: () => 1700000000000 },
    )
    const url = fetchImpl.calls[0].url
    assert.ok(url.includes('timestamp=1700000000000'), 'timestamp appended')
    assert.ok(url.includes('sign='), 'sign appended')
  }

  console.log('ALL WEBHOOK PUSHER TESTS PASSED')
})
