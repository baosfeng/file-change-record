/**
 * dsh-my-context — shared constants.
 *
 * 上下文透镜 + 成本治理的常量：
 *  - BUDGET_MODES — 预算模式（warn=超限提醒；deny=超限拦截）
 *  - COMPOSITION_KEYS — 上下文构成分类（system/tools/user/inject/assistant/tool）
 *  - 存储上限（请求记录 / 告警 FIFO 淘汰）
 */

/** 预算模式：warn=超限提醒（不拦截）；deny=超限拦截（agent/pre-step 拒绝）。 */
export const BUDGET_MODES = ['warn', 'deny']

/** 上下文构成分类（与 UI 面板一一对应）。 */
export const COMPOSITION_KEYS = ['system', 'tools', 'user', 'inject', 'assistant', 'tool']

/** 每会话请求记录上限（FIFO 淘汰，防无限膨胀）。 */
export const MAX_REQUESTS_PER_SESSION = 500

/** 每会话预算告警上限（FIFO 淘汰）。 */
export const MAX_ALERTS_PER_SESSION = 50

/** 默认预算配置：全部关闭（0=不限制），模式 warn。 */
export const DEFAULT_BUDGET = { perTurn: 0, perSession: 0, mode: 'warn' }
