/**
 * dsh-my-memory — the read-only `memory_query` tool.
 *
 * Registered through `ctx.tools.register` with a hand-built ToolDefinition
 * (no `@deepseek-ai/dsh-tools` import — plugins in this repo resolve only
 * Node builtins and relative modules, so the definition is constructed
 * directly with JSON-Schema parameters/output, which the registry accepts).
 *
 * The tool is strictly read-only: it never mutates the stores. It lists the
 * global or project memories, optionally filtered by a keyword substring.
 * The project scope resolves its cwd from the calling agent's session
 * (`exec.agent.session.header.cwd`) unless the model passes one explicitly.
 */
import { findProjectRoot } from './store.js'

/** Filter items by a keyword substring (case-insensitive); no filter when empty. */
export function filterItems(items, keyword) {
  const needle = typeof keyword === 'string' ? keyword.trim().toLowerCase() : ''
  if (needle === '') return items
  return items.filter((item) => item.desc.toLowerCase().includes(needle))
}

/** Render one query result as model-facing text. */
export function renderQueryResult(value) {
  const scopeLabel = value.scope === 'project' ? '项目' : '全局'
  const where =
    value.scope === 'project' && value.projectRoot !== ''
      ? `（项目：${value.projectRoot}）`
      : value.scope === 'project'
        ? '（项目目录未知）'
        : ''
  if (value.items.length === 0) return `没有找到${scopeLabel}记忆${where}。`
  const lines = value.items.map((item) => `- [${item.id}] ${item.desc}`)
  return `${scopeLabel}记忆${where}（${value.items.length} 条）：\n${lines.join('\n')}`
}

/** memory_query parameters (JSON Schema; the registry projects them to the model). */
const QUERY_PARAMETERS = {
  type: 'object',
  properties: {
    scope: {
      type: 'string',
      enum: ['global', 'project'],
      description: '查询范围：global（全局记忆）或 project（当前项目记忆）',
    },
    keyword: {
      type: 'string',
      description: '可选：按记忆内容包含的关键词过滤（不区分大小写）',
    },
    cwd: {
      type: 'string',
      description: '可选：项目记忆的项目目录（默认取当前会话的工作目录）',
    },
  },
  required: ['scope'],
  additionalProperties: false,
}

/** memory_query output schema (JSON Schema; enforced on every successful value). */
const QUERY_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scope: { type: 'string' },
    cwd: { type: 'string' },
    projectRoot: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          desc: { type: 'string' },
          createdAt: { type: 'number' },
          updatedAt: { type: 'number' },
        },
        required: ['id', 'desc', 'createdAt', 'updatedAt'],
      },
    },
  },
  required: ['scope', 'cwd', 'projectRoot', 'items'],
}

/** The memory_query tool definition (read-only). */
export function createMemoryQueryTool({ globalStore, getProjectStore }) {
  return {
    name: 'memory_query',
    description:
      '查询记忆详情（只读）：列出全局或项目记忆条目，可按关键词过滤。全局记忆在会话开始时已注入系统提示词；此工具用于查看完整记忆列表或项目记忆。',
    parameters: QUERY_PARAMETERS,
    output: {
      schema: QUERY_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: renderQueryResult(value) }],
    },
    async execute(args, exec) {
      return executeQuery(args, exec, { globalStore, getProjectStore })
    },
  }
}

/** Run one memory_query call (read-only). */
async function executeQuery(args, exec, { globalStore, getProjectStore }) {
  const scope = args.scope === 'project' ? 'project' : 'global'
  if (scope === 'global') {
    return { scope, cwd: '', projectRoot: '', items: filterItems(globalStore.list(), args.keyword) }
  }
  const cwd = typeof args.cwd === 'string' && args.cwd !== '' ? args.cwd : sessionCwdOf(exec)
  if (cwd === '') {
    return { scope, cwd: '', projectRoot: '', items: [] }
  }
  const store = await getProjectStore(cwd)
  const projectRoot = await findProjectRoot(cwd)
  return { scope, cwd, projectRoot, items: filterItems(store.list(), args.keyword) }
}

/** The calling agent's session cwd, when it has one. */
function sessionCwdOf(exec) {
  const cwd = exec?.agent?.session?.header?.cwd
  return typeof cwd === 'string' ? cwd : ''
}
