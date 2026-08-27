/**
 * dsh-task-reliability — event listeners.
 *
 * 依赖 util/store/text/repeat/verify/constants。注册 5 类事件监听：
 * 重试 waterfall、turn-stopping 自动继续 + 重复打断、会话结束校验、
 * llm/stream 包装、自主决策拦截。所有回调均接收 shared（index.js 构建）。
 */

import { sleep, userMessage } from './util.js'
import { activeTaskOf, finishTask, addQuestion, registerTask } from './store.js'
import { isTopLevelAgent } from './text.js'
import { wrapStreamForLoop } from './repeat.js'
import { runVerification } from './verify.js'
import {
  ASK_TIMEOUT_CONTINUE_TEXT, AUTOPILOT_DENY_REASON, DIRECT_CONTINUE_TEXT, REPEAT_BREAK_TEXT, RETRY_MAX_DELAY_MS, RATE_WINDOW_MS,
} from './constants.js'

/** ask 超时竞争标记（Promise.race 胜出方）。 */
const ASK_TIMEOUT = Symbol('dsh-task-reliability.ask-timeout')

// ── 状态辅助 ───────────────────────────────────────────────────────────────

/** 请求级重试计数（按会话 + 时间窗）。 */
function retryBudget(sessionId, shared) {
  const now = Date.now()
  const bucket = shared.retryBuckets.get(sessionId)
  if (bucket === undefined || now - bucket.windowStart > 60000) {
    const next = { windowStart: now, count: 0 }
    shared.retryBuckets.set(sessionId, next)
    return next
  }
  return bucket
}

/** 思考重复状态（会话级）。 */
function repeatStateOf(sessionId, shared) {
  let state = shared.repeatStates.get(sessionId)
  if (state === undefined) {
    state = { count: 0, gaveUp: false, notified: false }
    shared.repeatStates.set(sessionId, state)
  }
  return state
}

/** 全局动作速率限制。 */
function rateAllowed(shared) {
  const now = Date.now()
  while (shared.actionLog.length > 0 && now - shared.actionLog[0] > RATE_WINDOW_MS) shared.actionLog.shift()
  if (shared.actionLog.length >= shared.options.rateMaxActions) return false
  shared.actionLog.push(now)
  return true
}

/** 会话自主决策判定：会话级显式开关优先，否则取全局模式。 */
function autopilotFor(sessionId, shared) {
  if (shared.store.mode.sessionAutopilot[sessionId] === true) return true
  if (shared.store.mode.sessionAutopilot[sessionId] === false) return false
  return shared.store.mode.autopilot || shared.options.autopilot
}

function signalAborted(signal) {
  return signal !== undefined && signal !== null && signal.aborted
}

// ── 自动跟踪 ───────────────────────────────────────────────────────────────

function goalObjective(ctx, agent) {
  try {
    const goals = ctx.get('goals')
    const view = goals?.get?.(agent)
    if (view !== undefined && view !== null && typeof view === 'object') {
      if (typeof view.objective === 'string' && view.objective !== '') return view.objective
    }
  } catch {
    // ignore
  }
  return ''
}

/** 自动跟踪：会话存在活动 goal 时保守登记。 */
function maybeAutoTrack(agent, shared) {
  if (!shared.store.mode.tracking) return
  if (activeTaskOf(shared.store, agent.id) !== undefined) return
  const objective = goalObjective(shared.ctx, agent)
  if (objective === '') return
  const result = registerTask(shared.store, {
    sessionId: agent.id,
    description: objective,
    mode: shared.store.mode.verify ? 'verify' : 'direct',
    source: 'auto',
  })
  if (result.ok) shared.save()
}

// ── 2. 模型超时/请求失败自动重试 ─────────────────────────────────────────

async function handleRequestError(payload, next, shared) {
  const code = payload?.failure?.code
  if (typeof code !== 'string' || !shared.options.retryableCodes.has(code)) return next()
  const agent = payload?.agent
  if (agent === undefined || agent === null) return next()
  const bucket = retryBudget(agent.id, shared)
  if (bucket.count >= shared.options.retryMax) return next()
  bucket.count += 1
  if (await retryWait(payload, bucket, shared)) return next()
  return { kind: 'retry' }
}

/** 指数退避等待：中途 abort 则放弃本次重试。 */
async function retryWait(payload, bucket, shared) {
  const signal = payload?.signal
  const delay = Math.min(shared.options.retryBaseMs * 2 ** (bucket.count - 1), RETRY_MAX_DELAY_MS)
  if (signalAborted(signal)) return true
  await sleep(delay)
  return signalAborted(signal)
}

// ── 3+5. 任务自动继续 + 思考重复打断（turn-stopping） ────────────────────

function shouldSteer(task, repeat) {
  if (task !== undefined) return true
  return repeat !== undefined && repeat.count > 0 && !repeat.gaveUp
}

/** 思考重复打断优先于任务继续（避免指令混杂）。 */
function repeatBreak(repeat, agent) {
  if (repeat === undefined || repeat.count === 0 || repeat.gaveUp) return false
  agent.steer(userMessage(REPEAT_BREAK_TEXT(repeat.count)))
  return true
}

function atLoopLimit(task, shared) {
  if (task.loopCount < shared.options.maxLoop) return false
  finishTask(shared.store, task.id, 'failed')
  shared.save()
  return true
}

function steerContinue(task, agent, shared) {
  agent.steer(userMessage(DIRECT_CONTINUE_TEXT(task.description)))
  task.loopCount += 1
  task.lastSteerAt = Date.now()
  task.updatedAt = Date.now()
  shared.save()
}

async function handleTurnStopping(agent, signal, shared) {
  if (!isTopLevelAgent(agent)) return
  if (signalAborted(signal)) return
  const task = activeTaskOf(shared.store, agent.id)
  const repeat = shared.repeatStates.get(agent.id)
  if (!shouldSteer(task, repeat)) return
  if (!rateAllowed(shared)) return
  if (repeatBreak(repeat, agent)) return
  if (task === undefined) return
  if (Date.now() - task.lastSteerAt < shared.options.steerCooldownMs) return
  if (atLoopLimit(task, shared)) return
  if (task.mode === 'verify') return
  steerContinue(task, agent, shared)
}

// ── 4. 会话结束后完成度校验（verify 模式） ───────────────────────────────

async function handleStatus(agent, status, shared) {
  if (status !== 'idle') return
  if (!isTopLevelAgent(agent)) return
  maybeAutoTrack(agent, shared)
  const task = activeTaskOf(shared.store, agent.id)
  if (task === undefined || task.mode !== 'verify') return
  if (task.verifyCount >= shared.options.maxVerify) {
    finishTask(shared.store, task.id, 'failed')
    shared.save()
    return
  }
  if (Date.now() - task.lastSteerAt < shared.options.steerCooldownMs) return
  task.status = 'checking'
  task.updatedAt = Date.now()
  shared.save()
  return runVerification(shared.ctx, shared.store, task, agent, shared.save)
}

// ── 5. 思考重复检测（llm/stream 包装） ───────────────────────────────────

/**
 * 包装 `llm/stream`：返回包装后的流。
 *
 * 必须保持为**同步函数**：cordis waterfall 不 await listener 的返回值，
 * `next()` 同步返回流；若这里是 async function，waterfall 拿到的就是
 * `Promise<流>`——`for await` 消费方尚可容忍（自动展开 Promise），但
 * vision-toolkit 等适配器用 `yield*` 委托流，`yield*` 不接受 Promise，
 * 会抛 `yield* (intermediate value) is not async iterable`。
 */
function handleStream(options, next, shared) {
  const sessionId = typeof options?.sessionId === 'string' ? options.sessionId : ''
  if (sessionId === '') return next()
  const stream = next()
  return wrapStreamForLoop(stream, repeatStateOf(sessionId, shared))
}

// ── 7. 自主决策：拦截 ask（deny，不调 next）；收集待确认问题 ─────────────

/** ask 参数摘要：取第一个问题的 header/question 首行（尽力而为）。 */
function askNoteOf(argumentsValue) {
  try {
    const first = firstQuestion(argumentsValue)
    if (first === undefined) return ''
    if (typeof first.header === 'string' && first.header !== '') return first.header
    return questionLine(first)
  } catch {
    // ignore
  }
  return ''
}

function firstQuestion(argumentsValue) {
  const questions = argumentsValue?.questions
  if (!Array.isArray(questions) || questions.length === 0) return undefined
  const first = questions[0]
  if (first === null || typeof first !== 'object') return undefined
  return first
}

function questionLine(first) {
  if (typeof first.question !== 'string' || first.question === '') return ''
  const line = first.question.split('\n')[0]
  return line.length > 80 ? `${line.slice(0, 80)}…` : line
}

async function handlePreExecute(exec, next, shared) {
  if (exec === undefined || exec === null || exec.name !== 'ask_user_question') return next()
  const agent = exec.agent
  if (!isTopLevelAgent(agent)) return next()
  if (!autopilotFor(agent.id, shared)) return next()
  addQuestion(shared.store, agent.id, askNoteOf(exec.arguments))
  shared.save()
  return { kind: 'deny', reason: AUTOPILOT_DENY_REASON }
}

// ── ask 超时自动继续（issue #34）──────────────────────────────────────────

/** 超时后的模拟回答：有推荐选项（第一个）则选中，否则空回答由模型自行决策。 */
function simulatedAskAnswer(argumentsValue) {
  const questions = argumentsValue?.questions
  if (!Array.isArray(questions)) return { value: { answers: [] } }
  const answers = []
  for (const question of questions) {
    if (question === null || typeof question !== 'object' || typeof question.id !== 'string') continue
    const options = Array.isArray(question.options)
      ? question.options.filter((option) => option !== null && typeof option === 'object' && typeof option.label === 'string')
      : []
    answers.push(options.length > 0 ? { id: question.id, selected: [options[0].label] } : { id: question.id, selected: [] })
  }
  return { value: { answers } }
}

/**
 * 包装 `tools/execute`：ask_user_question 启动空闲计时器（Promise.race），
 * 超时后记录待确认问题 + 注入继续指令 + 返回模拟回答，任务不挂起；用户
 * 回答时 next() 先 resolve，真实结果透传。
 */
async function handleToolExecute(exec, next, shared) {
  if (exec === undefined || exec === null || exec.name !== 'ask_user_question') return next()
  if (shared.options.askTimeoutMs <= 0) return next()
  const agent = exec.agent
  if (!isTopLevelAgent(agent)) return next()
  const result = await Promise.race([
    next(),
    sleep(shared.options.askTimeoutMs).then(() => ASK_TIMEOUT),
  ])
  if (result !== ASK_TIMEOUT) return result
  addQuestion(shared.store, agent.id, askNoteOf(exec.arguments))
  shared.save()
  try {
    agent.followup(userMessage(ASK_TIMEOUT_CONTINUE_TEXT))
  } catch {
    // followup is best-effort; the simulated answer still unblocks the turn
  }
  return simulatedAskAnswer(exec.arguments)
}

// ── 注册 ───────────────────────────────────────────────────────────────────

/** 注册全部事件监听（每个事件一个 handler，全部经 shared 共享状态）。 */
export function registerListeners(ctx, shared) {
  ctx.on('agent/request-error', (payload, next) => handleRequestError(payload, next, shared))
  ctx.on('agent/turn-stopping', ({ agent, signal }) => handleTurnStopping(agent, signal, shared))
  ctx.on('agent/status', ({ agent, status }) => handleStatus(agent, status, shared))
  ctx.on('llm/stream', (options, next) => handleStream(options, next, shared))
  ctx.on('tools/pre-execute', (exec, next) => handlePreExecute(exec, next, shared))
  ctx.on('tools/execute', (exec, next) => handleToolExecute(exec, next, shared))
}
