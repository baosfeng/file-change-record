/**
 * dsh-task-reliability — host half.
 *
 * 任务可靠性保障。在 DSH 运行时上提供 8 项能力：
 *
 *  1. 任务注册表（持久化 $DSH_HOME/task-reliability.json，原子写 + 防抖）：
 *     手动（页面/API/远程 hook）注册任务；开启自动跟踪后，会话存在活动
 *     goal 时保守自动登记。
 *  2. 模型超时/请求失败自动重试：`agent/request-error` waterfall 接管
 *     超时/瞬态类失败（TIMEOUT/ETIMEDOUT/ECONNRESET/TRANSPORT 等），带
 *     指数退避与次数上限；其余失败委托 next()。
 *  3. 任务未完成自动继续：`agent/turn-stopping` serial 监听，存在活动任务
 *     时注入 steering 让机器再跑一步；direct 模式直接继续，verify 模式
 *     交给会话结束后校验流程。内置防死循环护栏（同内容哈希去重、每任务
 *     循环上限、全局速率限制、abort 检查）。
 *  4. 完成度校验 agent：会话完全结束后（agent/status idle）创建独立校验
 *     agent，读取主会话日志判断任务是否真正完成；未完成 → followup 唤醒
 *     主 agent 继续（带校验结论）；校验失败 → 降级直接继续。
 *  5. 思考重复检测与干预：`llm/stream` waterfall 包装流，对 reasoning
 *     段落做 n-gram 相似度检测；连续高相似判定为思考循环 → 终止该回合，
 *     turn-stopping 注入分级打断指令；每会话干预次数上限。
 *  6. 休眠/重启恢复：插件启动后延迟扫描活动任务，`agents.resume` 恢复
 *     agent 并注入「系统重启，继续完成之前的任务」；resumeAt 幂等。
 *  7. 自主决策模式（出行模式）：`tools/pre-execute` 拦截 ask_user_question
 *     → deny（不调用 next()），模型收到 reason 后自行决策；被拦截的问题
 *     收集到待确认列表（持久化，可查询/回答/清除）；相关会话审批策略
 *     切换为 never（自动批准工具执行）。
 *  8. 远程触发接口：POST /task-reliability/api/trigger（loopback 信任围栏
 *     + 可选 apiToken），支持 mode/register/answer/status 动作。
 *
 * 安全约定：所有 HTTP 路由先做 loopback 信任围栏；apiToken 配置后要求
 * `x-task-reliability-token` 头。
 *
 * 注意：可选服务（agents/sessionQuery/goals/approval）一律经 ctx.get 读取
 * 并处理 undefined；事件监听全部经 ctx.on 注册、路由经 ctx.effect 注册，
 * 卸载无残留。
 */

import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export const name = 'dsh-task-reliability'

export const inject = ['webServer']

// ── 常量 ──────────────────────────────────────────────────────────────────
const STORE_FILE = 'task-reliability.json'
const MAX_DESC = 500
const MAX_LOOP = 8
const MAX_VERIFY = 3
const STEER_COOLDOWN_MS = 8000
const RETRY_MAX = 3
const RETRY_BASE_MS = 1000
const RETRY_MAX_DELAY_MS = 30000
const RATE_WINDOW_MS = 60000
const RATE_MAX_ACTIONS = 12
const REPEAT_MAX_PER_SESSION = 3
const REPEAT_SIM_THRESHOLD = 0.85
const REPEAT_CONSECUTIVE = 3
const REPEAT_BUFFER = 6
const VERIFY_TIMEOUT_MS = 60000
const RESUME_GRACE_MS = 2000
const SAVE_DEBOUNCE_MS = 500
const SUMMARY_MAX_CHARS = 8000

const RETRYABLE_CODES = new Set([
  'TIMEOUT', 'ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED', 'STREAM_IDLE_TIMEOUT',
  'TRANSPORT', 'NETWORK', 'SERVER', 'RATE_LIMIT', 'EMPTY_RESPONSE',
])

const DIRECT_CONTINUE_TEXT = (desc) =>
  `【任务自动继续】你之前的任务尚未确认完成，请继续完成它：${desc}。` +
  '检查当前进度，列出剩余未完成的部分并逐一执行，直到任务真正完成。' +
  '如果任务实际上已经完成，请明确说明已完成并结束。'

const REPEAT_BREAK_TEXT = (level) =>
  level >= 2
    ? '【检测到思考重复循环】你正在反复输出相同的思考内容。请立即停止重复推理，'
      + '以最简方式基于已有信息直接给出结论，并继续执行任务，不要再次重复思考。'
    : '【检测到思考重复】检测到思考过程出现重复。请收敛思考，避免重复推理，直接基于已有信息给出结论并继续。'

const AUTOPILOT_DENY_REASON =
  '【自主决策模式】用户当前不在线，无法回答问题。请基于已有信息和上下文做出最合理的决策并继续执行，' +
  '不要再次询问用户。该问题已记录，用户回来后统一处理。'

const RESUME_CONTINUE_TEXT = (desc) =>
  `【系统重启恢复】系统此前在任务执行中被中断（休眠/重启），请继续完成之前的任务：${desc}。` +
  '先回顾当前进度，然后继续执行剩余部分，直到任务完成。'

// ── 工具函数 ──────────────────────────────────────────────────────────────
function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms)
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value) },
      () => { clearTimeout(timer); resolve(undefined) },
    )
  })
}

function header(headers, name) {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function canonicalAuthority(entry, entryUrl) {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

function isTrustedAuthority(hostUrl, trustedHosts) {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

function isTrustedApiRequest(request, trustedHosts) {
  const host = header(request.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

async function readJsonBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) throw new Error('request body too large')
  }
  if (body === '') return {}
  return JSON.parse(body)
}

function writeJson(response, status, value) {
  const payload = JSON.stringify(value)
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-cache' })
  response.end(payload)
}

function writeError(response, error) {
  const message = error instanceof Error ? error.message : String(error)
  writeJson(response, 400, { ok: false, error: { message } })
}

// ── 消息构造 ───────────────────────────────────────────────────────────────
function userMessage(text) {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}

/** 顶层会话判定：跳过子代理（subagent）会话，只保障用户直接查看的会话。 */
function isTopLevelAgent(agent) {
  const header = agent?.session?.header
  if (header === undefined || header === null) return false
  if (header.origin === 'subagent') return false
  if (typeof header.delegationDepth === 'number' && header.delegationDepth > 0) return false
  return true
}

/** 会话最后一条 assistant 文本消息（校验 agent 结论读取）。 */
function lastAssistantText(session) {
  try {
    const events = session?.events
    if (!Array.isArray(events)) return ''
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]
      if (event?.type !== 'assistant/message') continue
      const message = event.data?.message
      if (message === undefined || message === null) continue
      const blocks = message.content
      if (!Array.isArray(blocks)) continue
      const text = blocks
        .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
      if (text !== '') return text
    }
  } catch {
    // best-effort
  }
  return ''
}

/** 会话摘要：拼接最近用户消息与 assistant 文本（截断）。 */
function summarizeSession(session, desc) {
  const parts = []
  try {
    const events = session?.events
    if (Array.isArray(events)) {
      const tail = events.slice(-40)
      for (const event of tail) {
        if (event?.type === 'user/message' && event.data?.message?.content !== undefined) {
          const text = blocksText(event.data.message.content)
          if (text !== '') parts.push(`用户: ${text.slice(0, 600)}`)
        } else if (event?.type === 'assistant/message' && event.data?.message?.content !== undefined) {
          const text = blocksText(event.data.message.content)
          if (text !== '') parts.push(`助手: ${text.slice(0, 600)}`)
        }
      }
    }
  } catch {
    // best-effort
  }
  let summary = parts.join('\n')
  if (summary.length > SUMMARY_MAX_CHARS) summary = summary.slice(-SUMMARY_MAX_CHARS)
  return summary === '' ? `（无法读取会话历史）任务描述：${desc}` : summary
}

function blocksText(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

// ── 思考重复检测 ──────────────────────────────────────────────────────────
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

/** 包装模型流：透传全部 chunk，检测 reasoning 段落重复；命中抛错中断回合。 */
function wrapStreamForLoop(stream, repeatState) {
  const buffers = new Map()
  const segments = []
  return (async function* () {
    for await (const chunk of stream) {
      yield chunk
      if (chunk === null || typeof chunk !== 'object') continue
      if (chunk.type === 'block-start') {
        buffers.set(chunk.index, { type: chunk.blockType, text: '' })
      } else if (chunk.type === 'reasoning-delta') {
        const buffer = buffers.get(chunk.index)
        if (buffer !== undefined && buffer.type === 'reasoning') buffer.text += chunk.text
      } else if (chunk.type === 'block-end') {
        const buffer = buffers.get(chunk.index)
        buffers.delete(chunk.index)
        if (buffer === undefined || buffer.type !== 'reasoning') continue
        const text = buffer.text.trim()
        if (text.length < 50) continue
        segments.push(text)
        if (segments.length > REPEAT_BUFFER) segments.shift()
        if (repeatState.gaveUp) continue
        if (!detectReasoningLoop(segments)) continue
        repeatState.count += 1
        if (repeatState.count > REPEAT_MAX_PER_SESSION) {
          repeatState.gaveUp = true
          repeatState.notified = false
          continue
        }
        const error = new Error(`reasoning loop detected (count=${repeatState.count})`)
        error.code = 'REASONING_LOOP'
        throw error
      }
    }
  })()
}

// ── 任务注册表（持久化） ───────────────────────────────────────────────────
function defaultStore() {
  return {
    version: 1,
    tasks: [],
    questions: [],
    mode: {
      tracking: false,
      verify: false,
      autopilot: false,
      sessionAutopilot: {},
    },
  }
}

function loadStore(dir, logger) {
  try {
    const raw = readFileSync(join(dir, STORE_FILE), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) return defaultStore()
    const store = defaultStore()
    store.tasks = parsed.tasks.filter((task) => task !== null && typeof task === 'object' && typeof task.sessionId === 'string')
    store.questions = Array.isArray(parsed.questions) ? parsed.questions.filter((q) => q !== null && typeof q === 'object') : []
    if (parsed.mode !== null && typeof parsed.mode === 'object') {
      store.mode = {
        tracking: parsed.mode.tracking === true,
        verify: parsed.mode.verify === true,
        autopilot: parsed.mode.autopilot === true,
        sessionAutopilot: parsed.mode.sessionAutopilot !== null && typeof parsed.mode.sessionAutopilot === 'object'
          ? parsed.mode.sessionAutopilot
          : {},
      }
    }
    return store
  } catch {
    logger?.warn?.('dsh-task-reliability: store unreadable, starting empty')
    return defaultStore()
  }
}

function saveStore(dir, store) {
  const path = join(dir, STORE_FILE)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8')
  renameSync(tmp, path)
}

// ── 注册表操作 ─────────────────────────────────────────────────────────────
function activeTaskOf(store, sessionId) {
  return store.tasks.find((task) => task.sessionId === sessionId && task.status === 'active')
}

function taskById(store, id) {
  return store.tasks.find((task) => task.id === id)
}

function findQuestionById(store, id) {
  return store.questions.find((question) => question.id === id)
}

function registerTask(store, input) {
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (sessionId === '' || description === '') return { ok: false, error: 'sessionId and description are required' }
  if (description.length > MAX_DESC) return { ok: false, error: `description too long (max ${MAX_DESC})` }
  const existing = activeTaskOf(store, sessionId)
  if (existing !== undefined) return { ok: false, error: `session already has an active task (${existing.id})` }
  const now = Date.now()
  const task = {
    id: randomId('task'),
    sessionId,
    description,
    status: 'active',
    mode: input.mode === 'verify' ? 'verify' : 'direct',
    source: input.source === 'auto' ? 'auto' : 'manual',
    loopCount: 0,
    verifyCount: 0,
    lastSteerAt: 0,
    resumeAt: 0,
    createdAt: now,
    updatedAt: now,
  }
  store.tasks.push(task)
  return { ok: true, task }
}

function finishTask(store, id, status) {
  const task = taskById(store, id)
  if (task === undefined) return { ok: false, error: 'task not found' }
  task.status = status
  task.updatedAt = Date.now()
  return { ok: true, task }
}

function addQuestion(store, sessionId, question) {
  if (typeof question !== 'string' || question === '') return
  const text = question.slice(0, 300)
  if (store.questions.some((q) => q.sessionId === sessionId && q.question === text && q.answer === undefined)) return
  store.questions.push({
    id: randomId('q'),
    sessionId,
    question: text,
    answer: undefined,
    createdAt: Date.now(),
    answeredAt: undefined,
  })
}

function answerQuestion(store, id, answer) {
  const question = findQuestionById(store, id)
  if (question === undefined) return { ok: false, error: 'question not found' }
  question.answer = typeof answer === 'string' ? answer.slice(0, 1000) : ''
  question.answeredAt = Date.now()
  return { ok: true, question }
}

// ── 校验 agent ─────────────────────────────────────────────────────────────
function verifyPrompt(task, summary) {
  return `你是一个任务完成度校验员。请阅读以下任务与当前会话进展，判断任务是否已经真正完成。

任务：${task.description}

会话最近进展：
${summary}

请严格只输出一个 JSON 对象（不要输出其他内容）：
{"done": true 或 false, "reason": "完成或未完成的简明原因（50 字以内）"}

判断标准：任务的所有要求是否都已被满足；如果还有未完成、未验证、或中途中断的部分，done 必须为 false。`
}

async function runVerification(ctx, store, task, agent, save) {
  const agents = ctx.get('agents')
  const sessionQuery = ctx.get('sessionQuery')
  const fallback = async () => {
    task.status = 'active'
    agent.followup(userMessage(DIRECT_CONTINUE_TEXT(task.description)))
    task.loopCount += 1
    task.updatedAt = Date.now()
    save()
  }
  if (agents === undefined || agents === null || typeof agents.create !== 'function') return fallback()
  let summary = task.description
  if (sessionQuery !== undefined && sessionQuery !== null && typeof sessionQuery.readSession === 'function') {
    try {
      const log = await sessionQuery.readSession(agent.id)
      summary = summarizeSession(log, task.description)
    } catch {
      summary = task.description
    }
  }
  let handle
  try {
    handle = await agents.create({
      sessionId: `verify-${task.id}`,
      meta: { origin: 'subagent', delegationDepth: 1 },
      agentOptions: {
        ...(agent.options?.provider !== undefined ? { provider: agent.options.provider } : {}),
        ...(agent.options?.model !== undefined ? { model: agent.options.model } : {}),
      },
    })
  } catch {
    return fallback()
  }
  let conclusion
  try {
    handle.agent.followup(userMessage(verifyPrompt(task, summary)))
    await withTimeout(handle.agent.whenIdle(), VERIFY_TIMEOUT_MS)
    conclusion = parseConclusion(lastAssistantText(handle.agent.session))
  } catch {
    conclusion = undefined
  }
  try {
    await handle.dispose()
  } catch {
    // dispose is best-effort
  }
  task.verifyCount += 1
  task.updatedAt = Date.now()
  if (conclusion?.done === true) {
    task.status = 'done'
    save()
    return
  }
  task.status = 'active'
  const reason = conclusion?.reason !== undefined && conclusion.reason !== '' ? conclusion.reason : ''
  agent.followup(userMessage(
    reason !== ''
      ? `【任务校验】校验员判断任务尚未完成：${reason}。请继续完成剩余部分。`
      : DIRECT_CONTINUE_TEXT(task.description),
  ))
  task.loopCount += 1
  save()
}

function parseConclusion(text) {
  if (typeof text !== 'string' || text === '') return undefined
  try {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return undefined
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (parsed === null || typeof parsed !== 'object') return undefined
    return {
      done: parsed.done === true,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : '',
    }
  } catch {
    return undefined
  }
}

// ── 重启恢复 ───────────────────────────────────────────────────────────────
async function resumeActiveTasks(ctx, store, save) {
  const agents = ctx.get('agents')
  if (agents === undefined || agents === null || typeof agents.resume !== 'function') return
  for (const task of store.tasks) {
    if (task.status !== 'active') continue
    if (task.resumeAt !== 0) continue
    let agent
    try {
      const live = agents.get(task.sessionId)
      if (live !== undefined) {
        agent = live
      } else {
        const handle = await agents.resume({
          resumeSessionId: task.sessionId,
          agentOptions: {},
        })
        agent = handle.agent
      }
    } catch {
      task.status = 'failed'
      task.updatedAt = Date.now()
      continue
    }
    try {
      agent.followup(userMessage(RESUME_CONTINUE_TEXT(task.description)))
      task.resumeAt = Date.now()
      task.updatedAt = Date.now()
    } catch {
      // followup is best-effort; keep the task active for a later attempt
    }
  }
  save()
}

// ── 插件体 ─────────────────────────────────────────────────────────────────
export function apply(ctx, config) {
  const options = {
    apiToken: typeof config?.apiToken === 'string' ? config.apiToken : '',
    retryMax: Number.isInteger(config?.retryMax) && config.retryMax > 0 ? config.retryMax : RETRY_MAX,
    maxLoop: Number.isInteger(config?.maxLoop) && config.maxLoop > 0 ? config.maxLoop : MAX_LOOP,
    maxVerify: Number.isInteger(config?.maxVerify) && config.maxVerify > 0 ? config.maxVerify : MAX_VERIFY,
    retryableCodes: Array.isArray(config?.retryableCodes) && config.retryableCodes.length > 0
      ? new Set(config.retryableCodes)
      : RETRYABLE_CODES,
    retryBaseMs: Number.isInteger(config?.retryBaseMs) && config.retryBaseMs >= 0 ? config.retryBaseMs : RETRY_BASE_MS,
    autopilot: config?.autopilot === true,
    steerCooldownMs: Number.isInteger(config?.steerCooldownMs) && config.steerCooldownMs >= 0 ? config.steerCooldownMs : STEER_COOLDOWN_MS,
    saveDebounceMs: Number.isInteger(config?.saveDebounceMs) && config.saveDebounceMs >= 0 ? config.saveDebounceMs : SAVE_DEBOUNCE_MS,
    resumeGraceMs: Number.isInteger(config?.resumeGraceMs) && config.resumeGraceMs >= 0 ? config.resumeGraceMs : RESUME_GRACE_MS,
    rateMaxActions: Number.isInteger(config?.rateMaxActions) && config.rateMaxActions > 0 ? config.rateMaxActions : RATE_MAX_ACTIONS,
  }

  const webRuntime = ctx.get('webRuntime')
  const trustedHosts = webRuntime !== undefined && webRuntime !== null && Array.isArray(webRuntime.trustedHosts)
    ? webRuntime.trustedHosts
    : []
  const fence = (request) => isTrustedApiRequest(request, trustedHosts)

  const envHome = process.env.DSH_HOME
  const dir = typeof envHome === 'string' && envHome !== '' ? envHome : join(homedir(), '.dsh')
  const store = loadStore(dir, ctx.logger)

  let saveTimer = null
  const save = () => {
    if (saveTimer !== null) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      try {
        saveStore(dir, store)
      } catch (error) {
        ctx.logger?.warn?.(`dsh-task-reliability: save failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }, options.saveDebounceMs)
  }

  // ── 请求级重试计数（按会话 + 时间窗） ──────────────────────────────────
  const retryBuckets = new Map() // sessionId -> { windowStart, count }
  function retryBudget(sessionId) {
    const now = Date.now()
    const bucket = retryBuckets.get(sessionId)
    if (bucket === undefined || now - bucket.windowStart > 60000) {
      const next = { windowStart: now, count: 0 }
      retryBuckets.set(sessionId, next)
      return next
    }
    return bucket
  }

  // ── 思考重复状态（会话级） ─────────────────────────────────────────────
  const repeatStates = new Map() // sessionId -> { count, gaveUp, notified }
  function repeatStateOf(sessionId) {
    let state = repeatStates.get(sessionId)
    if (state === undefined) {
      state = { count: 0, gaveUp: false, notified: false }
      repeatStates.set(sessionId, state)
    }
    return state
  }

  // ── 全局动作速率限制 ───────────────────────────────────────────────────
  const actionLog = []
  function rateAllowed() {
    const now = Date.now()
    while (actionLog.length > 0 && now - actionLog[0] > RATE_WINDOW_MS) actionLog.shift()
    if (actionLog.length >= options.rateMaxActions) return false
    actionLog.push(now)
    return true
  }

  // ── 会话自主决策判定 ───────────────────────────────────────────────────
  function autopilotFor(sessionId) {
    if (store.mode.sessionAutopilot[sessionId] === true) return true
    if (store.mode.sessionAutopilot[sessionId] === false) return false
    return store.mode.autopilot || options.autopilot
  }

  // ── 自动跟踪：会话存在活动 goal 时保守登记 ─────────────────────────────
  function maybeAutoTrack(agent) {
    if (!store.mode.tracking) return
    if (activeTaskOf(store, agent.id) !== undefined) return
    let objective = ''
    try {
      const goals = ctx.get('goals')
      const view = goals?.get?.(agent)
      if (view !== undefined && view !== null && typeof view === 'object') {
        if (typeof view.objective === 'string' && view.objective !== '') objective = view.objective
      }
    } catch {
      objective = ''
    }
    if (objective === '') return
    const result = registerTask(store, {
      sessionId: agent.id,
      description: objective,
      mode: store.mode.verify ? 'verify' : 'direct',
      source: 'auto',
    })
    if (result.ok) save()
  }

  // ── 事件监听 ────────────────────────────────────────────────────────────

  // 2. 模型超时/请求失败自动重试（waterfall：接管时返回 retry，不调 next）
  ctx.on('agent/request-error', async (payload, next) => {
    const code = payload?.failure?.code
    if (typeof code !== 'string' || !options.retryableCodes.has(code)) return next()
    const agent = payload?.agent
    if (agent === undefined || agent === null) return next()
    const bucket = retryBudget(agent.id)
    if (bucket.count >= options.retryMax) return next()
    bucket.count += 1
    const delay = Math.min(options.retryBaseMs * 2 ** (bucket.count - 1), RETRY_MAX_DELAY_MS)
    if (payload?.signal !== undefined && payload.signal !== null && payload.signal.aborted) return next()
    await sleep(delay)
    if (payload?.signal !== undefined && payload.signal !== null && payload.signal.aborted) return next()
    return { kind: 'retry' }
  })

  // 3+5. 任务自动继续 + 思考重复打断（turn-stopping）
  ctx.on('agent/turn-stopping', async ({ agent, signal }) => {
    if (!isTopLevelAgent(agent)) return
    if (signal !== undefined && signal !== null && signal.aborted) return
    const task = activeTaskOf(store, agent.id)
    const repeat = repeatStates.get(agent.id)
    if (task === undefined && (repeat === undefined || repeat.count === 0 || repeat.gaveUp)) return
    if (!rateAllowed()) return
    // 思考重复打断优先于任务继续（避免指令混杂）
    if (repeat !== undefined && repeat.count > 0 && !repeat.gaveUp) {
      agent.steer(userMessage(REPEAT_BREAK_TEXT(repeat.count)))
      return
    }
    if (task === undefined) return
    if (Date.now() - task.lastSteerAt < options.steerCooldownMs) return
    if (task.loopCount >= options.maxLoop) {
      finishTask(store, task.id, 'failed')
      save()
      return
    }
    if (task.mode === 'verify') return // verify 模式交给会话结束后校验
    const text = DIRECT_CONTINUE_TEXT(task.description)
    agent.steer(userMessage(text))
    task.loopCount += 1
    task.lastSteerAt = Date.now()
    task.updatedAt = Date.now()
    save()
  })

  // 4. 会话结束后完成度校验（verify 模式）
  ctx.on('agent/status', async ({ agent, status }) => {
    if (status !== 'idle') return
    if (!isTopLevelAgent(agent)) return
    maybeAutoTrack(agent)
    const task = activeTaskOf(store, agent.id)
    if (task === undefined || task.mode !== 'verify') return
    if (task.verifyCount >= options.maxVerify) {
      finishTask(store, task.id, 'failed')
      save()
      return
    }
    if (Date.now() - task.lastSteerAt < options.steerCooldownMs) return
    task.status = 'checking'
    task.updatedAt = Date.now()
    save()
    await runVerification(ctx, store, task, agent, save)
  })

  // 5. 思考重复检测（llm/stream 包装）
  ctx.on('llm/stream', async (options, next) => {
    const sessionId = typeof options?.sessionId === 'string' ? options.sessionId : ''
    if (sessionId === '') return next()
    const stream = await next()
    return wrapStreamForLoop(stream, repeatStateOf(sessionId))
  })

  // 7. 自主决策：拦截 ask（deny，不调 next）；收集待确认问题
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (exec === undefined || exec === null || exec.name !== 'ask_user_question') return next()
    const agent = exec.agent
    if (!isTopLevelAgent(agent)) return next()
    if (!autopilotFor(agent.id)) return next()
    addQuestion(store, agent.id, askNoteOf(exec.arguments))
    save()
    return { kind: 'deny', reason: AUTOPILOT_DENY_REASON }
  })

  // 7. 自主决策：审批策略切换（模式开启/关闭时应用）
  function applyApprovalPolicy(sessionId, enabled) {
    const approval = ctx.get('approval')
    const agents = ctx.get('agents')
    if (approval === undefined || approval === null || typeof approval.setPolicy !== 'function') return
    if (agents === undefined || agents === null) return
    const agent = agents.get(sessionId)
    if (agent === undefined) return
    try {
      approval.setPolicy(agent, enabled ? 'never' : 'ask')
    } catch {
      // policy switch is best-effort
    }
  }

  // ── 启动恢复（休眠/重启后任务续跑） ─────────────────────────────────────
  let resumeTimer = null
  resumeTimer = setTimeout(() => {
    resumeTimer = null
    void resumeActiveTasks(ctx, store, save)
  }, options.resumeGraceMs)

  // ── HTTP API ────────────────────────────────────────────────────────────
  const parsePath = (url) => {
    const pathname = new URL(url ?? '/', 'http://dsh.internal').pathname
    return pathname.startsWith('/task-reliability/api/') ? pathname.slice('/task-reliability/api/'.length) : undefined
  }

  const api = async (request, response) => {
    if (!fence(request)) {
      writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      return
    }
    const method = parsePath(request.url)
    const tokenOk = options.apiToken === '' || header(request.headers, 'x-task-reliability-token') === options.apiToken
    try {
      if (method === 'info' && request.method === 'GET') {
        writeJson(response, 200, {
          ok: true,
          value: {
            tracking: store.mode.tracking,
            verify: store.mode.verify,
            autopilot: store.mode.autopilot,
            sessionAutopilot: store.mode.sessionAutopilot,
            taskCount: store.tasks.length,
            activeCount: store.tasks.filter((task) => task.status === 'active' || task.status === 'checking').length,
            questionCount: store.questions.filter((question) => question.answer === undefined).length,
            apiToken: options.apiToken !== '',
          },
        })
        return
      }
      if (method === 'tasks' && request.method === 'GET') {
        writeJson(response, 200, { ok: true, value: store.tasks })
        return
      }
      if (method === 'tasks' && request.method === 'POST') {
        const body = await readJsonBody(request)
        const result = registerTask(store, {
          sessionId: typeof body.sessionId === 'string' ? body.sessionId : '',
          description: typeof body.description === 'string' ? body.description : '',
          mode: body.mode,
          source: 'manual',
        })
        if (!result.ok) {
          writeJson(response, 400, { ok: false, error: { message: result.error } })
          return
        }
        save()
        writeJson(response, 200, { ok: true, value: result.task })
        return
      }
      const taskMatch = method?.match(/^tasks\/([^/]+)\/(done|pause|resume|delete)$/)
      if (taskMatch !== null && request.method === 'POST') {
        const task = taskById(store, taskMatch[1])
        if (task === undefined) {
          writeJson(response, 404, { ok: false, error: { message: 'task not found' } })
          return
        }
        const action = taskMatch[2]
        if (action === 'delete') {
          store.tasks = store.tasks.filter((t) => t.id !== task.id)
        } else if (action === 'pause') {
          finishTask(store, task.id, 'paused')
        } else if (action === 'resume') {
          finishTask(store, task.id, 'active')
        } else {
          finishTask(store, task.id, 'done')
        }
        save()
        writeJson(response, 200, { ok: true })
        return
      }
      if (method === 'questions' && request.method === 'GET') {
        writeJson(response, 200, { ok: true, value: store.questions })
        return
      }
      const answerMatch = method?.match(/^questions\/([^/]+)\/answer$/)
      if (answerMatch !== null && request.method === 'POST') {
        if (!tokenOk) {
          writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'invalid x-task-reliability-token' } })
          return
        }
        const body = await readJsonBody(request)
        const result = answerQuestion(store, answerMatch[1], typeof body.answer === 'string' ? body.answer : '')
        if (!result.ok) {
          writeJson(response, 404, { ok: false, error: { message: result.error } })
          return
        }
        save()
        writeJson(response, 200, { ok: true, value: result.question })
        return
      }
      if (method === 'mode' && request.method === 'POST') {
        if (!tokenOk) {
          writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'invalid x-task-reliability-token' } })
          return
        }
        const body = await readJsonBody(request)
        if (typeof body.tracking === 'boolean') store.mode.tracking = body.tracking
        if (typeof body.verify === 'boolean') store.mode.verify = body.verify
        if (typeof body.autopilot === 'boolean') store.mode.autopilot = body.autopilot
        if (typeof body.sessionId === 'string' && body.sessionId !== '' && typeof body.autopilot === 'boolean') {
          store.mode.sessionAutopilot[body.sessionId] = body.autopilot
          applyApprovalPolicy(body.sessionId, body.autopilot)
        }
        save()
        writeJson(response, 200, { ok: true })
        return
      }
      if (method === 'trigger' && request.method === 'POST') {
        if (!tokenOk) {
          writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'invalid x-task-reliability-token' } })
          return
        }
        const body = await readJsonBody(request)
        const action = typeof body.action === 'string' ? body.action : ''
        if (action === 'register') {
          const result = registerTask(store, {
            sessionId: typeof body.sessionId === 'string' ? body.sessionId : '',
            description: typeof body.description === 'string' ? body.description : '',
            mode: body.mode,
            source: 'manual',
          })
          if (!result.ok) {
            writeJson(response, 400, { ok: false, error: { message: result.error } })
            return
          }
          save()
          writeJson(response, 200, { ok: true, value: result.task })
          return
        }
        if (action === 'mode') {
          if (typeof body.tracking === 'boolean') store.mode.tracking = body.tracking
          if (typeof body.verify === 'boolean') store.mode.verify = body.verify
          if (typeof body.autopilot === 'boolean') store.mode.autopilot = body.autopilot
          if (typeof body.sessionId === 'string' && body.sessionId !== '' && typeof body.autopilot === 'boolean') {
            store.mode.sessionAutopilot[body.sessionId] = body.autopilot
            applyApprovalPolicy(body.sessionId, body.autopilot)
          }
          save()
          writeJson(response, 200, { ok: true })
          return
        }
        if (action === 'answer') {
          const result = answerQuestion(store, typeof body.id === 'string' ? body.id : '', typeof body.answer === 'string' ? body.answer : '')
          if (!result.ok) {
            writeJson(response, 400, { ok: false, error: { message: result.error } })
            return
          }
          save()
          writeJson(response, 200, { ok: true })
          return
        }
        if (action === 'status') {
          writeJson(response, 200, {
            ok: true,
            value: {
              tracking: store.mode.tracking,
              verify: store.mode.verify,
              autopilot: store.mode.autopilot,
              tasks: store.tasks,
              questions: store.questions,
            },
          })
          return
        }
        writeJson(response, 400, { ok: false, error: { message: 'unknown trigger action' } })
        return
      }
      writeJson(response, 404, { ok: false, error: { message: 'unknown dsh-task-reliability API method' } })
    } catch (error) {
      writeError(response, error)
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/task-reliability/api',
    handler: api,
  }), 'dsh-task-reliability: /task-reliability/api routes')

  // 卸载清理：定时器 + 立即落盘
  ctx.effect(() => () => {
    if (resumeTimer !== null) {
      clearTimeout(resumeTimer)
      resumeTimer = null
    }
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    try {
      saveStore(dir, store)
    } catch {
      // final flush is best-effort
    }
  }, 'dsh-task-reliability: teardown')
}

/** ask 参数摘要：取第一个问题的 header/question 首行（尽力而为）。 */
function askNoteOf(argumentsValue) {
  try {
    const questions = argumentsValue?.questions
    if (!Array.isArray(questions) || questions.length === 0) return ''
    const first = questions[0]
    if (first === null || typeof first !== 'object') return ''
    if (typeof first.header === 'string' && first.header !== '') return first.header
    if (typeof first.question === 'string' && first.question !== '') {
      const line = first.question.split('\n')[0]
      return line.length > 80 ? `${line.slice(0, 80)}…` : line
    }
  } catch {
    // ignore
  }
  return ''
}
