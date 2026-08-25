/**
 * dsh-notify — DSH 生命周期事件监听（只读观察）。
 *
 * 监听 agent/status（idle → end）、tools/pre-execute（ask_user_question →
 * ask）、approval/request（→ approval）。waterfall 事件一律透传 next()，
 * 绝不改变工具/审批流程；按 options 开关决定注册哪些监听。
 */
import { isTopLevelAgent, titleOf, askNoteOf } from './session.js'

/** 注册三类事件监听（按 options 开关），通知统一交给 emitNotice。 */
export function attachListeners(ctx, options, emitNotice) {
  if (options.end) attachEndListener(ctx, emitNotice)
  if (options.ask) attachAskListener(ctx, emitNotice)
  if (options.approval) attachApprovalListener(ctx, emitNotice)
}

/** agent/status idle → end 通知（过滤子代理）。 */
function attachEndListener(ctx, emitNotice) {
  ctx.on('agent/status', ({ agent, status }) => {
    if (status !== 'idle') return
    if (!isTopLevelAgent(agent)) return
    emitNotice({ kind: 'end', sessionId: agent.id, title: titleOf(ctx, agent) })
  })
}

/** tools/pre-execute 命中 ask_user_question → ask 通知（透传 next）。 */
function attachAskListener(ctx, emitNotice) {
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (exec !== undefined && exec !== null && exec.name === 'ask_user_question') {
      const agent = exec.agent
      if (isTopLevelAgent(agent)) {
        emitNotice({
          kind: 'ask',
          sessionId: agent.id,
          title: titleOf(ctx, agent),
          note: askNoteOf(exec.arguments),
        })
      }
    }
    return next()
  })
}

/** approval/request → approval 通知（透传 next）。 */
function attachApprovalListener(ctx, emitNotice) {
  ctx.on('approval/request', async (req, next) => {
    if (req !== undefined && req !== null && isTopLevelAgent(req.agent)) {
      emitNotice({
        kind: 'approval',
        sessionId: req.agent.id,
        title: titleOf(ctx, req.agent),
        note: typeof req.reason === 'string' ? req.reason : '',
        toolName: typeof req.toolName === 'string' ? req.toolName : '',
      })
    }
    return next()
  })
}
