/**
 * dsh-my-guard — prompt injection detection（提示注入检测）。
 *
 * 纯函数检测引擎 + 会话监听：
 *  - detectPromptInjection(text) — 规则 + 启发式检测（INJECTION_RULES），
 *    返回命中规则列表 [{ id, severity, message }]；
 *  - extractUserText(message)    — 从 user/message 的 data 提取文本；
 *  - attachInjectionListener     — 监听 `session/event` 的 user/message
 *    （过滤插件注入消息），命中规则时逐条记录告警。
 */
import { INJECTION_RULES } from './constants.js'

/** 注册提示注入检测监听器；返回 disposer。 */
export function attachInjectionListener(ctx, recordAlert) {
  return ctx.on('session/event', (session, event) => {
    handleSessionEvent(session, event, recordAlert)
  })
}

/** 处理单个 session/event：user/message 命中规则时逐条记录告警。 */
function handleSessionEvent(session, event, recordAlert) {
  if (event === null || typeof event !== 'object' || event.type !== 'user/message') return
  const message = event.data
  if (isPluginInjected(message)) return
  const text = extractUserText(message)
  if (text === '') return
  const hits = detectPromptInjection(text)
  if (hits.length === 0) return
  recordHits(hits, sessionIdOf(session), text, recordAlert)
}

/** 逐条记录命中告警。 */
function recordHits(hits, sessionId, text, recordAlert) {
  for (const hit of hits) {
    recordAlert({
      type: 'injection',
      sessionId,
      severity: hit.severity,
      message: hit.message,
      detail: { rule: hit.id, snippet: truncateText(text) },
    })
  }
}

/** 从 session 提取 id（无 id 返回空串）。 */
function sessionIdOf(session) {
  return session !== null && typeof session === 'object' && typeof session.id === 'string' ? session.id : ''
}

/** 是否为插件注入的消息（source.kind === 'plugin'，非真实用户输入）。 */
export function isPluginInjected(message) {
  const source = message?.source
  return source !== null && typeof source === 'object' && source.kind === 'plugin'
}

/** 从 user/message 的 data 提取文本（content 中全部 text block 拼接）。 */
export function extractUserText(message) {
  if (message === null || typeof message !== 'object') return ''
  const content = message.content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text)
    }
  }
  return parts.join(' ')
}

/** 提示注入检测：返回命中规则列表（无命中返回空数组）。 */
export function detectPromptInjection(text) {
  if (typeof text !== 'string' || text === '') return []
  const hits = []
  for (const rule of INJECTION_RULES) {
    if (rule.re.test(text)) {
      hits.push({ id: rule.id, severity: rule.severity, message: rule.message })
    }
  }
  return hits
}

/** 文本截断（去换行，限长）。 */
export function truncateText(text) {
  const oneLine = text.split('\n')[0].trim()
  return oneLine.length > 200 ? `${oneLine.slice(0, 200)}…` : oneLine
}
