/**
 * dsh-my-remote — 会话信息 helper（纯函数，尽力而为）。
 *
 * 从 agent/session 结构提取远程控制所需信息：顶层会话判定（只远程控制
 * 顶层会话，子代理由宿主自行控制，复用 notify 的黑名单化判定：header
 * origin/delegationDepth、运行时 subagentDepth、派生父会话 parentSession
 * 任一命中即子代理）、会话标题（sessionTitle 快照 → cwd 末段 → 空串）、
 * ask 问题结构化（questions → 带 id/header/question/options 的列表，
 * 供外部通道渲染与远程回答按 id 匹配）。
 */

/** 顶层会话判定：只有明确无任何子代理标记的会话才视为顶层。 */
export function isTopLevelAgent(agent) {
  if (agent === null || typeof agent !== 'object') return false
  const header = agent.session?.header
  if (header === undefined || header === null) return false
  return !hasSubagentMarker(header, agent.options)
}

/** 任一子代理标记命中即子代理（持久化标记 + 运行时深度 + 派生父会话）。 */
function hasSubagentMarker(header, options) {
  if (header.origin === 'subagent') return true
  if (typeof header.delegationDepth === 'number' && header.delegationDepth > 0) return true
  if (typeof options?.subagentDepth === 'number' && options.subagentDepth > 0) return true
  return typeof header.parentSession === 'string' && header.parentSession !== ''
}

/** 会话标题：sessionTitle 快照优先，回退 cwd 末段，再回退空串。 */
export function titleOf(ctx, agent) {
  try {
    const session = agent?.session
    const snapshotTitle = titleSnapshot(ctx, session)
    if (snapshotTitle !== '') return snapshotTitle
    return cwdName(session)
  } catch {
    // title is best-effort; never let lookup break the event path
    return ''
  }
}

/** sessionTitle 快照标题（可选服务必须经 ctx.get 读取；失败返回空串）。 */
function titleSnapshot(ctx, session) {
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

/**
 * ask 问题结构化：questions 参数 → 外部通道可渲染、远程回答可匹配的列表。
 * 每题保留 id/header/question/options（label 列表），丢弃无关字段。
 */
export function askQuestionsOf(argumentsValue) {
  const questions = argumentsValue?.questions
  if (!Array.isArray(questions) || questions.length === 0) return []
  return questions.map(structuredQuestion).filter((question) => question !== null)
}

/** 单个问题结构化：id + header/question 全文 + options 标签（尽力而为）。 */
function structuredQuestion(question) {
  if (question === null || typeof question !== 'object') return null
  const id = typeof question.id === 'string' && question.id !== '' ? question.id : ''
  const header = typeof question.header === 'string' ? question.header : ''
  const text = typeof question.question === 'string' ? question.question : ''
  const options = Array.isArray(question.options)
    ? question.options
        .filter((option) => option !== null && typeof option === 'object' && typeof option.label === 'string')
        .map((option) => option.label)
    : []
  if (id === '' && text === '') return null
  return { id, header, question: text, options }
}
