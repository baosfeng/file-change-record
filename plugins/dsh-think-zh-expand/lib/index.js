/**
 * dsh-think-zh-expand — host half.
 *
 * 功能 1：思考与回复强制使用中文。
 *
 * 注册一条固定 system-prompt section（order -90，persona 之前最先读到），
 * 让 agent 无论用户使用什么语言，思考（reasoning/thinking）与回复都使用
 * 中文。无状态、无存储、无工具。
 *
 * 注意：section 名使用 `dsh-think-zh`，避开 @max-null/dsh-chinese-thinking
 * 已占用的 `chinese-thinking`（同一层重复 name 的 section 注册会抛错）。
 */

export const name = 'dsh-think-zh-expand'

export const inject = ['systemPrompt']

/** 注入到每次组装系统提示的固定中文指令。 */
export const PROMPT_TEXT =
  '当你进行思考（reasoning/thinking）时，必须使用中文；给用户的回复也始终使用中文，无论用户使用什么语言。'

export function apply(ctx) {
  ctx.systemPrompt.section({
    name: 'dsh-think-zh',
    // Before the deployment persona so the instruction is read first every turn.
    order: -90,
    text: PROMPT_TEXT,
  })
}
