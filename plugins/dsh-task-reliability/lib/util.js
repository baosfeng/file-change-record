/**
 * dsh-task-reliability — base utilities.
 *
 * 最底层工具模块：不依赖任何其他 lib 模块（仅标准库全局）。
 * 提供 ID 生成、延时、超时包装、请求头读取与消息构造。
 */

export function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms)
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value) },
      () => { clearTimeout(timer); resolve(undefined) },
    )
  })
}

export function header(headers, name) {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

/** 从消息 content blocks 提取文本并拼接（带 trim）。 */
export function blocksText(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

export function userMessage(text) {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}
