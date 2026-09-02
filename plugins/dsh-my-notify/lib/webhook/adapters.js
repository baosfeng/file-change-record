/**
 * dsh-my-notify — 出站 webhook 渠道适配器（issue #92）。
 *
 * 按渠道类型把通知帧格式化为目标机器人 API 的消息 JSON，并按各渠道的
 * 签名规则生成签名参数：
 *
 *  - wecom    企业微信群机器人：text / markdown 消息；可选加签
 *             （`sign = sha256(timestamp + '\n' + secret)`，hex 小写，
 *             URL 参数 timestamp + sign）
 *  - feishu   飞书自定义机器人：text / post 消息；签名校验
 *             （`sign = base64(hmac_sha256(key=secret, timestamp + '\n' +
 *             secret))`，body 字段 timestamp + sign）
 *  - dingtalk 钉钉自定义机器人：text / markdown 消息；加签
 *             （`sign = urlencode(base64(hmac_sha256(key=secret,
 *             timestamp + '\n' + secret)))`，URL 参数 timestamp + sign）
 *  - generic  通用中转：POST 原始通知帧 JSON（无签名）
 *
 * 全部为纯函数（sign 接受显式 now 便于单测断言确定性），不发起网络请求。
 */
import { createHash, createHmac } from 'node:crypto'

/** 事件类型 → 中文标签（与 client 端 i18n 文案一致）。 */
const KIND_LABELS = {
  end: '会话已结束',
  ask: '需要你回答',
  approval: '等待你的批准',
  remote: '提示',
}

/** 事件类型中文标签（未知类型回退「提示」）。 */
export function kindLabel(kind) {
  return KIND_LABELS[kind] ?? KIND_LABELS.remote
}

/** 通知摘要：note 优先，回退 toolName，再回退空串。 */
function noticeNote(notice) {
  if (typeof notice.note === 'string' && notice.note !== '') return notice.note
  if (typeof notice.toolName === 'string' && notice.toolName !== '') return notice.toolName
  return ''
}

/** 消息正文行：`类型：摘要`（摘要为空时只显示类型）。 */
function noticeLine(notice) {
  const label = kindLabel(notice.kind)
  const note = noticeNote(notice)
  return note !== '' ? `${label}：${note}` : label
}

/** 消息标题（回退「DSH 通知」）。 */
function noticeTitle(notice) {
  return typeof notice.title === 'string' && notice.title !== '' ? notice.title : 'DSH 通知'
}

/** 渠道类型：webhook 配置字段为 channel（兼容 type 别名）。 */
function channelType(channel) {
  return channel?.channel ?? channel?.type
}

/** 构造消息 JSON（按渠道 + msgType；generic 直接返回通知帧）。 */
export function formatMessage(channel, notice) {
  const type = channelType(channel)
  if (type === 'generic') return { ...notice }
  const title = noticeTitle(notice)
  const line = noticeLine(notice)
  const msgType = channel?.msgType ?? 'text'
  if (type === 'wecom') return wecomMessage(msgType, title, line)
  if (type === 'feishu') return feishuMessage(msgType, title, line)
  if (type === 'dingtalk') return dingtalkMessage(msgType, title, line)
  // 未知渠道按 generic 处理（尽力而为，不打断推送路径）
  return { ...notice }
}

/** 企微消息：text / markdown。 */
function wecomMessage(msgType, title, line) {
  if (msgType === 'markdown') {
    return { msgtype: 'markdown', markdown: { content: `**${title}**\n${line}` } }
  }
  return { msgtype: 'text', text: { content: `${title}\n${line}` } }
}

/** 飞书消息：text / post。 */
function feishuMessage(msgType, title, line) {
  if (msgType === 'post') {
    return {
      msg_type: 'post',
      content: { post: { zh_cn: { title, content: [[{ tag: 'text', text: line }]] } } },
    }
  }
  return { msg_type: 'text', content: { text: `${title}\n${line}` } }
}

/** 钉钉消息：text / markdown。 */
function dingtalkMessage(msgType, title, line) {
  if (msgType === 'markdown') {
    return { msgtype: 'markdown', markdown: { title, text: `### ${title}\n\n${line}` } }
  }
  return { msgtype: 'text', text: { content: `${title}\n${line}` } }
}

/**
 * 生成签名参数：返回 `{ query, body }`——query 追加到 URL，body 为最终
 * 请求体。无 secret 或渠道不支持签名时返回原样（query 为空对象）。
 */
export function sign(channel, secret, body, now = Date.now()) {
  const type = channelType(channel)
  if (typeof secret !== 'string' || secret === '') return { query: {}, body }
  if (type === 'wecom') return { query: wecomSign(secret, now), body }
  if (type === 'feishu') return { query: {}, body: feishuSign(secret, now, body) }
  if (type === 'dingtalk') return { query: dingtalkSign(secret, now), body }
  return { query: {}, body }
}

/** 企微加签：sha256(timestamp + '\n' + secret)，hex 小写。 */
function wecomSign(secret, now) {
  const digest = createHash('sha256').update(`${now}\n${secret}`, 'utf8').digest('hex')
  return { timestamp: String(now), sign: digest }
}

/** 飞书签名校验：base64(hmac_sha256(key=secret, timestamp + '\n' + secret))。 */
function feishuSign(secret, now, body) {
  const stringToSign = `${now}\n${secret}`
  const digest = createHmac('sha256', secret).update(stringToSign, 'utf8').digest('base64')
  return { ...body, timestamp: String(now), sign: digest }
}

/** 钉钉加签：base64(hmac_sha256(key=secret, timestamp + '\n' + secret))；
 *  URL 编码由 buildUrl（searchParams）统一处理，避免二次编码。 */
function dingtalkSign(secret, now) {
  const stringToSign = `${now}\n${secret}`
  const digest = createHmac('sha256', secret).update(stringToSign, 'utf8').digest('base64')
  return { timestamp: String(now), sign: digest }
}
