import { test } from 'vitest'
/**
 * dsh-my-notify — 出站 webhook 渠道适配器单测（issue #92 / #109）。
 *
 * 验证 formatMessage / renderTemplate / sign 按渠道生成正确的消息 JSON 与
 * 签名参数，覆盖：
 *  - 默认富格式：end 带 token 消耗/会话耗时/会话链接，ask 带完整问题，
 *    approval 带工具名 + 原因；
 *  - 模板渲染：{title}/{kind}/{note}/{tokens}/{question}/{sessionUrl}/{time}
 *    变量替换（未识别的 {xxx} 原样保留）；
 *  - wecom/feishu/dingtalk 的 text/markdown/post 消息与签名；
 *  - generic 原始通知帧。
 *
 * 全部为纯函数（sign 接受显式 now 便于单测断言确定性），不发起网络请求。
 */
import assert from 'node:assert/strict'
import { formatMessage, renderTemplate, sign, kindLabel } from '../lib/webhook/adapters.js'

const notice = {
  kind: 'end',
  sessionId: 's1',
  title: '标题',
  note: '摘要',
  toolName: '',
  agentType: 'top',
  time: 123,
}

/** 携token/耗时/链接的 end 通知（验证富格式）。 */
const richNotice = {
  ...notice,
  tokens: { input: 100, output: 50, total: 150 },
  duration: 83,
  sessionUrl: 'https://dsh.local/sessions/s1',
}

/** ask 多问题通知（验证完整问题）。 */
const askNotice = {
  kind: 'ask',
  sessionId: 'a1',
  title: '标题',
  note: '问题1摘要',
  question: '问题 1：请确认是否部署\n问题 2：请选择环境',
  questions: ['请确认是否部署', '请选择环境'],
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

  // ── 2. wecom text 消息：end 富格式（token/耗时/链接） ─────────────────
  {
    const body = formatMessage({ type: 'wecom' }, richNotice)
    assert.deepEqual(body, {
      msgtype: 'text',
      text: {
        content:
          '标题\n会话已结束：摘要\ntoken 消耗：输入 100 / 输出 50 / 总计 150\n会话耗时：1 分 23 秒\n会话链接：https://dsh.local/sessions/s1',
      },
    })
  }

  // ── 3. wecom markdown 消息：end 富格式 ───────────────────────────────
  {
    const body = formatMessage({ type: 'wecom', msgType: 'markdown' }, richNotice)
    assert.deepEqual(body.markdown.content, `**标题**\n会话已结束：摘要\n${tokenLines(richNotice)}`)
  }

  // ── 4. feishu text 消息：ask 完整问题（默认 full） ──────────────────
  {
    const body = formatMessage({ type: 'feishu' }, askNotice)
    assert.deepEqual(body, {
      msg_type: 'text',
      content: { text: '标题\n需要你回答：问题 1：请确认是否部署\n问题 2：请选择环境' },
    })
  }

  // ── 5. feishu text + opts.askFull=false：回退摘要 ────────────────────
  {
    const body = formatMessage({ type: 'feishu' }, askNotice, { askFull: false })
    assert.deepEqual(body, { msg_type: 'text', content: { text: '标题\n需要你回答：问题1摘要' } })
  }

  // ── 6. feishu post 消息：approval 工具名 + 原因 ─────────────────────
  {
    const approval = { ...notice, kind: 'approval', note: 'sandbox escalation', toolName: 'bash' }
    const body = formatMessage({ type: 'feishu', msgType: 'post' }, approval)
    assert.deepEqual(body, {
      msg_type: 'post',
      content: {
        post: {
          zh_cn: {
            title: '标题',
            content: [[{ tag: 'text', text: '等待你的批准：sandbox escalation\n调用工具：bash' }]],
          },
        },
      },
    })
  }

  // ── 7. dingtalk text 消息：remote 无富字段（原样） ───────────────────
  {
    const remote = { ...notice, kind: 'remote', note: '构建成功' }
    const body = formatMessage({ type: 'dingtalk' }, remote)
    assert.deepEqual(body, {
      msgtype: 'text',
      text: { content: '标题\n提示：构建成功' },
    })
  }

  // ── 8. dingtalk markdown 消息：end 富格式 ────────────────────────────
  {
    const body = formatMessage({ type: 'dingtalk', msgType: 'markdown' }, richNotice)
    assert.deepEqual(body.markdown.text, `### 标题\n\n会话已结束：摘要\n${tokenLines(richNotice)}`)
  }

  // ── 9. generic：原始通知帧 ───────────────────────────────────────────
  {
    const body = formatMessage({ type: 'generic' }, richNotice)
    assert.deepEqual(body, richNotice, 'generic posts the raw notice frame')
  }

  // ── 10. 未知渠道按 generic 处理（尽力而为） ──────────────────────────
  {
    const body = formatMessage({ type: 'unknown' }, richNotice)
    assert.deepEqual(body, richNotice, 'unknown channel falls back to raw frame')
  }

  // ── 11. 标题缺失回退「DSH 通知」；end 无 token 数据标注「不可用」 ─────
  {
    const body = formatMessage({ type: 'wecom' }, { ...notice, title: '' })
    assert.equal(body.text.content, 'DSH 通知\n会话已结束：摘要\ntoken 消耗：不可用')
  }

  // ── 12. 模板渲染：全部变量替换 ───────────────────────────────────────
  {
    const out = renderTemplate('{title}|{kind}|{note}|{tokens}|{question}|{sessionUrl}', {
      ...richNotice,
      ...askNotice,
    })
    assert.equal(
      out,
      '标题|需要你回答|问题1摘要|输入 100 / 输出 50 / 总计 150|问题 1：请确认是否部署\n问题 2：请选择环境|https://dsh.local/sessions/s1',
    )
  }

  // ── 13. 模板渲染：{time} 用本地时间；未知变量原样保留 ───────────────
  {
    const out = renderTemplate('{unknown}|{time}', richNotice)
    assert.ok(out.startsWith('{unknown}|'), 'unknown variable preserved verbatim')
    assert.ok(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(out), 'time renders YYYY-MM-DD HH:mm')
  }

  // ── 14. 模板渲染：token 不可用时标注「不可用」 ───────────────────────
  {
    const out = renderTemplate('{tokens}', notice)
    assert.equal(out, '不可用', 'no token data renders 不可用')
  }

  // ── 15. 模板配置渠道：template 优先于默认富格式 ──────────────────────
  {
    const body = formatMessage(
      { type: 'wecom', msgType: 'markdown', template: '**{title}**\n{kind}：{question}' },
      askNotice,
    )
    assert.deepEqual(body.markdown.content, '**标题**\n需要你回答：问题 1：请确认是否部署\n问题 2：请选择环境')
  }

  // ── 16. wecom 加签：sha256 hex，URL 参数 ─────────────────────────────
  {
    // sha256('1700000000000\nSECabc123') hex（node:crypto 预计算）
    const { query, body } = sign({ type: 'wecom' }, 'SECabc123', { msgtype: 'text' }, 1700000000000)
    assert.deepEqual(query, {
      timestamp: '1700000000000',
      sign: 'bb2b3f220709f9cf6c6478adca59655a032be396e96cb793a1770e61fcabf666',
    })
    assert.deepEqual(body, { msgtype: 'text' }, 'wecom body unchanged')
  }

  // ── 17. feishu 签名校验：base64(hmac_sha256)，body 字段 ──────────────
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

  // ── 18. dingtalk 加签：base64(hmac_sha256)，URL 参数（编码由 buildUrl 处理） ──
  {
    // base64(hmac_sha256(key='SECabc123', '1700000000000\nSECabc123'))
    const { query, body } = sign({ type: 'dingtalk' }, 'SECabc123', { msgtype: 'text' }, 1700000000000)
    assert.deepEqual(query, {
      timestamp: '1700000000000',
      sign: 'N5P09a4+p1AMJIJWnIvQd2Yxw9+fu/oEBnPrjCcsLXk=',
    })
    assert.deepEqual(body, { msgtype: 'text' }, 'dingtalk body unchanged')
  }

  // ── 19. 无 secret → 不签名 ───────────────────────────────────────────
  {
    const { query, body } = sign({ type: 'wecom' }, '', { msgtype: 'text' }, 1700000000000)
    assert.deepEqual(query, {}, 'empty secret yields no query params')
    assert.deepEqual(body, { msgtype: 'text' }, 'body unchanged without secret')
  }

  // ── 20. generic 不签名 ───────────────────────────────────────────────
  {
    const { query, body } = sign({ type: 'generic' }, 'secret', { kind: 'end' }, 1700000000000)
    assert.deepEqual(query, {}, 'generic never signs')
    assert.deepEqual(body, { kind: 'end' }, 'generic body unchanged')
  }

  console.log('ALL WEBHOOK ADAPTER TESTS PASSED')
})

/** end 富格式共用正文行（token/耗时/链接，duration=83 → 1 分 23 秒）。 */
function tokenLines(rich) {
  return `token 消耗：输入 ${rich.tokens.input} / 输出 ${rich.tokens.output} / 总计 ${rich.tokens.total}\n会话耗时：1 分 23 秒\n会话链接：${rich.sessionUrl}`
}
