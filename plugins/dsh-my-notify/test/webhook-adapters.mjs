import { test } from 'vitest'
/**
 * dsh-my-notify — 出站 webhook 渠道适配器单测（issue #92）。
 *
 * 验证 formatMessage / sign 按渠道生成正确的消息 JSON 与签名参数：
 *  - wecom：text/markdown 消息；加签 = sha256(timestamp + '\n' + secret)
 *    hex 小写，URL 参数 timestamp + sign；
 *  - feishu：text/post 消息；签名校验 = base64(hmac_sha256(key=secret,
 *    timestamp + '\n' + secret))，body 字段 timestamp + sign；
 *  - dingtalk：text/markdown 消息；加签 = urlencode(base64(hmac_sha256))，
 *    URL 参数 timestamp + sign；
 *  - generic：原始通知帧 JSON，无签名。
 *
 * 期望值用固定输入预计算（node:crypto 独立计算，见测试注释）。
 */
import assert from 'node:assert/strict'
import { formatMessage, sign, kindLabel } from '../lib/webhook/adapters.js'

const notice = {
  kind: 'end',
  sessionId: 's1',
  title: '标题',
  note: '摘要',
  toolName: '',
  agentType: 'top',
  time: 123,
}

test('webhook adapters suite', () => {
  // ── 1. kindLabel 映射 ────────────────────────────────────────────────
  assert.equal(kindLabel('end'), '会话已结束')
  assert.equal(kindLabel('ask'), '需要你回答')
  assert.equal(kindLabel('approval'), '等待你的批准')
  assert.equal(kindLabel('remote'), '提示')
  assert.equal(kindLabel('unknown'), '提示', 'unknown kind falls back to 提示')

  // ── 2. wecom text 消息 ────────────────────────────────────────────────
  {
    const body = formatMessage({ type: 'wecom' }, notice)
    assert.deepEqual(body, {
      msgtype: 'text',
      text: { content: '标题\n会话已结束：摘要' },
    })
  }

  // ── 3. wecom markdown 消息 ───────────────────────────────────────────
  {
    const body = formatMessage({ type: 'wecom', msgType: 'markdown' }, notice)
    assert.deepEqual(body, {
      msgtype: 'markdown',
      markdown: { content: '**标题**\n会话已结束：摘要' },
    })
  }

  // ── 4. feishu text 消息 ──────────────────────────────────────────────
  {
    const ask = { ...notice, kind: 'ask', note: '选择方案' }
    const body = formatMessage({ type: 'feishu' }, ask)
    assert.deepEqual(body, {
      msg_type: 'text',
      content: { text: '标题\n需要你回答：选择方案' },
    })
  }

  // ── 5. feishu post 消息 ──────────────────────────────────────────────
  {
    const approval = { ...notice, kind: 'approval', note: '', toolName: 'bash' }
    const body = formatMessage({ type: 'feishu', msgType: 'post' }, approval)
    assert.deepEqual(body, {
      msg_type: 'post',
      content: {
        post: {
          zh_cn: {
            title: '标题',
            content: [[{ tag: 'text', text: '等待你的批准：bash' }]],
          },
        },
      },
    })
  }

  // ── 6. dingtalk text 消息 ────────────────────────────────────────────
  {
    const remote = { ...notice, kind: 'remote', note: '构建成功' }
    const body = formatMessage({ type: 'dingtalk' }, remote)
    assert.deepEqual(body, {
      msgtype: 'text',
      text: { content: '标题\n提示：构建成功' },
    })
  }

  // ── 7. dingtalk markdown 消息 ────────────────────────────────────────
  {
    const body = formatMessage({ type: 'dingtalk', msgType: 'markdown' }, notice)
    assert.deepEqual(body, {
      msgtype: 'markdown',
      markdown: { title: '标题', text: '### 标题\n\n会话已结束：摘要' },
    })
  }

  // ── 8. generic：原始通知帧 ────────────────────────────────────────────
  {
    const body = formatMessage({ type: 'generic' }, notice)
    assert.deepEqual(body, notice, 'generic posts the raw notice frame')
  }

  // ── 9. 未知渠道按 generic 处理（尽力而为） ──────────────────────────
  {
    const body = formatMessage({ type: 'unknown' }, notice)
    assert.deepEqual(body, notice, 'unknown channel falls back to raw frame')
  }

  // ── 10. 标题缺失回退「DSH 通知」 ─────────────────────────────────────
  {
    const body = formatMessage({ type: 'wecom' }, { ...notice, title: '' })
    assert.equal(body.text.content, 'DSH 通知\n会话已结束：摘要')
  }

  // ── 11. wecom 加签：sha256 hex，URL 参数 ─────────────────────────────
  {
    // sha256('1700000000000\nSECabc123') hex（node:crypto 预计算）
    const { query, body } = sign({ type: 'wecom' }, 'SECabc123', { msgtype: 'text' }, 1700000000000)
    assert.deepEqual(query, {
      timestamp: '1700000000000',
      sign: 'bb2b3f220709f9cf6c6478adca59655a032be396e96cb793a1770e61fcabf666',
    })
    assert.deepEqual(body, { msgtype: 'text' }, 'wecom body unchanged')
  }

  // ── 12. feishu 签名校验：base64(hmac_sha256)，body 字段 ──────────────
  {
    // base64(hmac_sha256(key='test secret 123', '1711673182\ntest secret 123'))
    const { query, body } = sign({ type: 'feishu' }, 'test secret 123', { msg_type: 'text' }, 1711673182)
    assert.deepEqual(query, {}, 'feishu sign goes into the body, not the URL')
    assert.deepEqual(body, {
      msg_type: 'text',
      timestamp: '1711673182',
      sign: 't2/Cg0kirE/Tc2Zp1rJpEINLMMhAimsA288YPUKvhD0=',
    })
  }

  // ── 13. dingtalk 加签：base64(hmac_sha256)，URL 参数（编码由 buildUrl 处理） ──
  {
    // base64(hmac_sha256(key='SECabc123', '1700000000000\nSECabc123'))
    const { query, body } = sign({ type: 'dingtalk' }, 'SECabc123', { msgtype: 'text' }, 1700000000000)
    assert.deepEqual(query, {
      timestamp: '1700000000000',
      sign: 'N5P09a4+p1AMJIJWnIvQd2Yxw9+fu/oEBnPrjCcsLXk=',
    })
    assert.deepEqual(body, { msgtype: 'text' }, 'dingtalk body unchanged')
  }

  // ── 14. 无 secret → 不签名 ───────────────────────────────────────────
  {
    const { query, body } = sign({ type: 'wecom' }, '', { msgtype: 'text' }, 1700000000000)
    assert.deepEqual(query, {}, 'empty secret yields no query params')
    assert.deepEqual(body, { msgtype: 'text' }, 'body unchanged without secret')
  }

  // ── 15. generic 不签名 ───────────────────────────────────────────────
  {
    const { query, body } = sign({ type: 'generic' }, 'secret', { kind: 'end' }, 1700000000000)
    assert.deepEqual(query, {}, 'generic never signs')
    assert.deepEqual(body, { kind: 'end' }, 'generic body unchanged')
  }

  console.log('ALL WEBHOOK ADAPTER TESTS PASSED')
})
