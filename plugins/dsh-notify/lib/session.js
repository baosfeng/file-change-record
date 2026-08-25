/**
 * dsh-notify — 会话信息 helper。
 *
 * 从 agent/session 结构提取通知所需信息：顶层会话判定、会话标题
 * （sessionTitle 快照 → cwd 末段 → 空串）、ask 问题摘要。全部为纯函数，
 * 尽力而为——任何失败都降级为安全默认值，绝不打断通知路径。
 */

/** 顶层会话判定：跳过子代理（subagent）会话，只提醒用户直接查看的会话。 */
export function isTopLevelAgent(agent) {
  const header = agent?.session?.header
  if (header === undefined || header === null) return false
  if (header.origin === 'subagent') return false
  if (typeof header.delegationDepth === 'number' && header.delegationDepth > 0) return false
  return true
}

/** 会话标题：优先 sessionTitle 快照，回退 cwd 末段，再回退空串（由 client 显示短 id）。 */
export function titleOf(ctx, agent) {
  try {
    const session = agent?.session
    const snapshotTitle = titleSnapshot(ctx, session)
    if (snapshotTitle !== '') return snapshotTitle
    return cwdName(session)
  } catch {
    // title is best-effort; never let lookup break the notice path
    return ''
  }
}

/** sessionTitle 快照标题（失败或缺失返回空串；异常向上传播由 titleOf 兜底）。 */
function titleSnapshot(ctx, session) {
  // 可选服务必须经 ctx.get 读取（未注入时直接属性访问在 Cordis 上不可靠）
  const titleService = ctx.get ? ctx.get('sessionTitle') : undefined
  const snapshot = titleService?.get?.(session)
  if (snapshot !== undefined && snapshot !== null && typeof snapshot.title === 'string' && snapshot.title !== '') {
    return snapshot.title
  }
  return ''
}

/** cwd 末段作为标题回退（去尾斜杠；无 cwd 返回空串）。 */
function cwdName(session) {
  const cwd = session?.header?.cwd
  if (typeof cwd === 'string' && cwd !== '') {
    const norm = cwd.replace(/\/+$/, '')
    const idx = norm.lastIndexOf('/')
    const name = idx === -1 ? norm : norm.slice(idx + 1)
    if (name !== '') return name
  }
  return ''
}

/** ask 参数摘要：取第一个问题的 header/question 首行（尽力而为）。 */
export function askNoteOf(argumentsValue) {
  try {
    const questions = argumentsValue?.questions
    if (!Array.isArray(questions) || questions.length === 0) return ''
    return noteOfFirstQuestion(questions[0])
  } catch {
    // ignore
  }
  return ''
}

/** 第一个问题的摘要：header 优先，否则 question 首行（截断 80 字符）。 */
function noteOfFirstQuestion(first) {
  if (first === null || typeof first !== 'object') return ''
  if (typeof first.header === 'string' && first.header !== '') return first.header
  if (typeof first.question === 'string' && first.question !== '') {
    const line = first.question.split('\n')[0]
    return line.length > 80 ? `${line.slice(0, 80)}…` : line
  }
  return ''
}
