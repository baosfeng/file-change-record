/**
 * dsh-my-guard — pre-execute guard（执行前护栏）。
 *
 * 监听 `tools/pre-execute`（waterfall）：
 *  - 破坏性命令检测：bash 工具 command 匹配 DESTRUCTIVE_PATTERNS →
 *    记录告警（high）；模式为 ask 时返回 `{ kind: 'ask', reason }` 触发
 *    DSH 原生审批确认，模式为 deny 时返回 `{ kind: 'deny', reason }`
 *    直接拦截；默认 observe 只读观察（透传 next()，不改变工具流程）。
 *  - 投毒扫描联动：命令含 `dsh plugin add <pkg>` 时异步扫描包内容
 *    （fire-and-forget，不阻塞 waterfall），发现可疑内容记录告警。
 *
 * ⚠️ waterfall 契约：监听器必须先 `await next()` 拿到下游决策再决定
 * 是否覆盖；observe 模式一律原样返回下游决策。绝不吞掉 next()。
 */
import { DESTRUCTIVE_PATTERNS, GUARD_MODES } from './constants.js'
import { scanPackageTarget } from './poison.js'

/** 注册执行前护栏监听器；返回 disposer。 */
export function attachGuardListener(ctx, options, recordAlert) {
  return ctx.on('tools/pre-execute', async (exec, next) => {
    const decision = await next()
    const command = commandOf(exec)
    if (command === '') return decision
    const sessionId = sessionIdOf(exec)
    const pkg = extractPluginAdd(command)
    if (pkg !== '' && options.poisonScan !== false) {
      void scanPackageTarget(pkg, (alert) => recordAlert({ ...alert, sessionId }))
    }
    const hit = detectDestructive(command)
    if (hit !== null) {
      recordAlert({
        type: 'destructive',
        sessionId,
        severity: 'high',
        message: hit.message,
        detail: { command: truncateCommand(command), pattern: hit.id },
      })
      if (options.mode === 'ask') {
        return {
          kind: 'ask',
          reason: `安全护栏：检测到破坏性命令（${hit.message}），请确认是否执行`,
        }
      }
      if (options.mode === 'deny') {
        return { kind: 'deny', reason: `安全护栏：已拦截破坏性命令（${hit.message}）` }
      }
    }
    return decision
  })
}

/** 从 exec 提取 bash 命令文本（非 bash 工具返回空串）。 */
export function commandOf(exec) {
  if (exec === null || typeof exec !== 'object') return ''
  const args = exec.arguments
  if (args === null || typeof args !== 'object') return ''
  const command = args.command
  return typeof command === 'string' ? command : ''
}

/** 从 exec 提取会话 id（无 agent 返回空串）。 */
export function sessionIdOf(exec) {
  const agent = exec?.agent
  return agent !== null && typeof agent === 'object' && typeof agent.id === 'string' ? agent.id : ''
}

/** 破坏性命令检测：返回首个命中模式（无命中返回 null）。 */
export function detectDestructive(command) {
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.re.test(command)) return pattern
  }
  return null
}

/** 从 bash 命令提取 `dsh plugin add <pkg>` 的包名（无命中返回空串）。 */
export function extractPluginAdd(command) {
  const match = /\bdsh\s+plugin\s+(--profile\s+\S+\s+)?add\s+(\S+)/.exec(command)
  if (match === null) return ''
  const pkg = match[2].replace(/^link:/, '')
  return pkg === '' ? '' : pkg
}

/** 命令截断（保留首行，限长）。 */
export function truncateCommand(command) {
  const oneLine = command.split('\n')[0].trim()
  return oneLine.length > 200 ? `${oneLine.slice(0, 200)}…` : oneLine
}

/** 护栏模式校验：非法值回退 observe。 */
export function normalizeMode(mode) {
  return GUARD_MODES.includes(mode) ? mode : 'observe'
}
