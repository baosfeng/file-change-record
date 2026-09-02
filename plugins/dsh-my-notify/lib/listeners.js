/**
 * dsh-my-notify — DSH 生命周期事件监听（只读观察）。
 *
 * 监听 agent/status（idle → end）、tools/pre-execute（ask_user_question →
 * ask）、approval/request（→ approval）。waterfall 事件一律透传 next()，
 * 绝不改变工具/审批流程；按 options 开关决定注册哪些监听。
 *
 * 子代理策略（issue #26）：end 通知默认只推顶层会话；`subagentEnd: true`
 * 后子代理完成也推送，通知带 `agentType: 'subagent'` 标记与「子代理」标题
 * 前缀。ask/approval 始终只推顶层（行为不变）。
 *
 * `subagentEnd` 过滤集中在下游 emitNotice 出口（issue #112）：子代理 end
 * 这里始终产出 `agentType: 'subagent'` 帧，是否广播（SSE + webhook）由
 * emitNotice 按全局开关决定，SSE 与 webhook 双通道一致。
 */
import { isTopLevelAgent, titleOf, subagentTitleOf, askNoteOf } from './session.js'

/** 注册三类事件监听（按 options 开关），通知统一交给 emitNotice；返回 disposer 数组。 */
export function attachListeners(ctx, options, emitNotice) {
  const disposers = []
  if (options.end) disposers.push(attachEndListener(ctx, emitNotice))
  if (options.ask) disposers.push(attachAskListener(ctx, emitNotice))
  if (options.approval) disposers.push(attachApprovalListener(ctx, emitNotice))
  return disposers
}

/** agent/status idle → end 通知（顶层无条件；子代理由 emitNotice 按 subagentEnd 过滤）。 */
function attachEndListener(ctx, emitNotice) {
  return ctx.on('agent/status', ({ agent, status }) => {
    if (status !== 'idle') return
    if (isTopLevelAgent(agent)) {
      emitNotice({ kind: 'end', sessionId: agent.id, title: titleOf(ctx, agent), agentType: 'top' })
      return
    }
    emitNotice({ kind: 'end', sessionId: agent.id, title: subagentTitleOf(ctx, agent), agentType: 'subagent' })
  })
}

/** tools/pre-execute 命中 ask_user_question → ask 通知（透传 next）。 */
function attachAskListener(ctx, emitNotice) {
  return ctx.on('tools/pre-execute', async (exec, next) => {
    if (exec !== undefined && exec !== null && exec.name === 'ask_user_question') {
      const agent = exec.agent
      if (isTopLevelAgent(agent)) {
        emitNotice({
          kind: 'ask',
          sessionId: agent.id,
          title: titleOf(ctx, agent),
          note: askNoteOf(exec.arguments),
          agentType: 'top',
        })
      }
    }
    return next()
  })
}

/** approval/request → approval 通知（透传 next）。 */
function attachApprovalListener(ctx, emitNotice) {
  return ctx.on('approval/request', async (req, next) => {
    if (req !== undefined && req !== null && isTopLevelAgent(req.agent)) {
      emitNotice({
        kind: 'approval',
        sessionId: req.agent.id,
        title: titleOf(ctx, req.agent),
        note: typeof req.reason === 'string' ? req.reason : '',
        toolName: typeof req.toolName === 'string' ? req.toolName : '',
        agentType: 'top',
      })
    }
    return next()
  })
}
