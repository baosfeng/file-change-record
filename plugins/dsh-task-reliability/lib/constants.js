/**
 * dsh-task-reliability — shared constants and message constructors.
 *
 * 最底层模块：不依赖任何其他 lib 模块。所有常量、重试码集合与
 * 提示文本构造函数集中于此，供其他子模块与 index.js 引用。
 */

export const STORE_FILE = 'task-reliability.json'
export const MAX_DESC = 500
export const MAX_LOOP = 8
export const MAX_VERIFY = 3
export const STEER_COOLDOWN_MS = 8000
export const RETRY_MAX = 3
export const RETRY_BASE_MS = 1000
export const RETRY_MAX_DELAY_MS = 30000
export const RATE_WINDOW_MS = 60000
export const RATE_MAX_ACTIONS = 12
export const REPEAT_MAX_PER_SESSION = 3
export const REPEAT_SIM_THRESHOLD = 0.85
export const REPEAT_CONSECUTIVE = 3
export const REPEAT_BUFFER = 6
export const VERIFY_TIMEOUT_MS = 60000
export const RESUME_GRACE_MS = 2000
export const SAVE_DEBOUNCE_MS = 500
export const SUMMARY_MAX_CHARS = 8000

export const RETRYABLE_CODES = new Set([
  'TIMEOUT', 'ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED', 'STREAM_IDLE_TIMEOUT',
  'TRANSPORT', 'NETWORK', 'SERVER', 'RATE_LIMIT', 'EMPTY_RESPONSE',
])

export const DIRECT_CONTINUE_TEXT = (desc) =>
  `【任务自动继续】你之前的任务尚未确认完成，请继续完成它：${desc}。` +
  '检查当前进度，列出剩余未完成的部分并逐一执行，直到任务真正完成。' +
  '如果任务实际上已经完成，请明确说明已完成并结束。'

export const REPEAT_BREAK_TEXT = (level) =>
  level >= 2
    ? '【检测到思考重复循环】你正在反复输出相同的思考内容。请立即停止重复推理，'
      + '以最简方式基于已有信息直接给出结论，并继续执行任务，不要再次重复思考。'
    : '【检测到思考重复】检测到思考过程出现重复。请收敛思考，避免重复推理，直接基于已有信息给出结论并继续。'

export const AUTOPILOT_DENY_REASON =
  '【自主决策模式】用户当前不在线，无法回答问题。请基于已有信息和上下文做出最合理的决策并继续执行，' +
  '不要再次询问用户。该问题已记录，用户回来后统一处理。'

export const RESUME_CONTINUE_TEXT = (desc) =>
  `【系统重启恢复】系统此前在任务执行中被中断（休眠/重启），请继续完成之前的任务：${desc}。` +
  '先回顾当前进度，然后继续执行剩余部分，直到任务完成。'
