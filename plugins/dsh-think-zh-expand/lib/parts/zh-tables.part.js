/**
 * PART: 界面中文化词表（纯数据）。
 *
 * 由 scripts/build.mjs 拼入 lib/client.js 的 factory 作用域（纯数据声明，
 * 无 import/export）。内容与拆分前完全一致：zh-localize 片段与纯函数导出
 * （zhToolName / zhToolDesc / zhCardTitle / zhCardSummary）依赖这些表。
 */

// ── 界面标签中文化：词表 + 精准文本节点替换 ────────────────────────
// 只替换「完全等于」词表 key 的叶子文本节点；排除代码块/输入区/脚本区，
// 避免误伤消息正文与代码内容。词条来自官方 UI 的 zh 字典缺译与硬编码英文
// （dsh-client-ui-trajectory 的 Thinking/Tool Call/ASSISTANT 等、
// dsh-client-ui-conversation 的 context.tools/stats.toolCall 等）。
const ZH_TABLE = {
  'Thinking': '思考',
  'Tool Call': '工具调用',
  'Tool calls': '工具调用',
  'Tool call': '工具调用',
  'Tool call only': '仅工具调用',
  'Tools': '工具',
  'No content': '无内容',
  'Tools Updated': '工具已更新',
  'Duration': '用时',
  'Use actual duration': '使用实际耗时',
  'Use equal-width operations': '使用等宽操作',
  'Turns': '轮次',
  'Expand turns': '展开轮次',
  'Collapse turns': '收起轮次',
  'Calls': '调用',
  'Expand calls': '展开调用',
  'Collapse calls': '收起调用',
  'Load earlier history': '加载更早历史',
  'Loading earlier history…': '正在加载更早历史…',
  'Loading earlier history': '正在加载更早历史',
  'ASSISTANT': '助手',
  'TOOL': '工具',
  'USER': '用户',
  'Session log': '会话日志',
  'Cordis Plugin': 'Cordis 插件',
  'System prompt': '系统提示',
  'Messages': '消息',
  'Files': '文件',
  'Full access': '完全访问',
  'Enable Full access': '启用完全访问',
  'Cancel': '取消',
}

// 动态格式（保持原始数字/单位，只翻译标签词）
const ZH_PATTERNS = [
  [/^Turn (\d+)$/, '第 $1 轮'],
  [/^Tool call (.+)$/, '工具调用 $1'],
  [/^Input ([\d.]+) tok · Output ([\d.]+) tok$/, '输入 $1 tok · 输出 $2 tok'],
  [/^LLM (.+)$/, '模型调用 $1'],
]

/** 这些标签内部的文本一律不动（代码、输入、脚本）。 */
const ZH_SKIP_TAGS = new Set(['PRE', 'CODE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'KBD', 'SAMP'])

// ── 工具卡片标题中文化 ─────────────────────────────────────────────
// 官方 dsh-client-ui-tool 的工具卡片标题是硬编码英文（VARIANT_TITLES /
// TOOL_TITLES，源码注释 "design literals, not translatable copy"，无 i18n
// 路径）：web_search 卡片显示 "Search"、bash 显示 "Bash"、read 显示
// "Read"、cordis 工具显示 "Inspect" / "Run Cordis Plugin" 等。
// 这些词只允许在「工具调用卡片行」内替换（行根带 data-chat-call-id），
// 不参与全局词表，避免误伤消息正文。
const CARD_TITLE_ZH = {
  'Search': '搜索',
  'Read': '读取',
  'Bash': '命令行',
  'Write': '写入',
  'Edit': '编辑',
  'Code': '代码',
  'Inspect': '检查',
  'Run Cordis Plugin': '运行 Cordis 插件',
  'Stop Cordis Plugin': '停止 Cordis 插件',
  'Remove Cordis Plugin': '移除 Cordis 插件',
}

// ── 工具名中文化（轨迹视图 Tool Catalog 的 tool.name）───────────────
// Tool Catalog 直接渲染工具的英文 id（web_search / bash / read …）。
// 工具名是动态数据，静态词表覆盖不了，必须按「工具名 → 中文名」映射。
// 未覆盖的工具保留英文原名。
const TOOL_NAME_ZH = {
  // 基础工具
  web_search: '网络搜索',
  bash: '命令行',
  read: '读取文件',
  write: '写入文件',
  edit: '编辑文件',
  glob: '搜索文件',
  grep: '搜索内容',
  read_image: '读取图片',
  skill: '技能',
  workflow: '工作流',
  subagent: '子代理',
  subagent_fork: '子代理（继承）',
  todo_write: '任务清单',
  ask_user_question: '询问用户',
  exit_plan_mode: '退出计划模式',
  // 目标与任务
  create_goal: '创建目标',
  get_goal: '查看目标',
  update_goal: '更新目标',
  job_list: '任务列表',
  job_output: '任务输出',
  job_kill: '终止任务',
  // 代理
  list_agents: '代理列表',
  send_message: '发送消息',
  interrupt_agent: '中断代理',
  // Cordis 插件
  cordis_define: '定义插件',
  cordis_run: '运行插件',
  cordis_stop: '停止插件',
  cordis_undefine: '删除插件',
  cordis_inspect_list: '查看提供者',
  cordis_inspect_query: '查询提供者',
  cordis_inspect_self: '查看自身',
  // 代码库记忆（codebase-memory）
  'mcp__codebase-memory__check_index_coverage': '检查索引覆盖',
  'mcp__codebase-memory__delete_project': '删除项目',
  'mcp__codebase-memory__detect_changes': '变更影响分析',
  'mcp__codebase-memory__get_architecture': '架构总览',
  'mcp__codebase-memory__get_code_snippet': '代码片段',
  'mcp__codebase-memory__get_graph_schema': '图结构',
  'mcp__codebase-memory__index_repository': '索引仓库',
  'mcp__codebase-memory__index_status': '索引状态',
  'mcp__codebase-memory__ingest_traces': '导入运行时轨迹',
  'mcp__codebase-memory__list_projects': '项目列表',
  'mcp__codebase-memory__manage_adr': '架构决策记录',
  'mcp__codebase-memory__query_graph': '图查询',
  'mcp__codebase-memory__search_code': '代码搜索',
  'mcp__codebase-memory__search_graph': '图搜索',
  'mcp__codebase-memory__trace_path': '调用路径追踪',
  // AgentTeams
  'agent_teams_add_member': '添加成员',
  'agent_teams_claim_task': '认领任务',
  'agent_teams_create': '创建团队',
  'agent_teams_create_task': '创建任务',
  'agent_teams_delete': '删除团队',
  'agent_teams_reassign_task': '重新指派任务',
  'agent_teams_remove_member': '移除成员',
  'agent_teams_send_message': '团队消息',
  'agent_teams_status': '团队状态',
  'agent_teams_update_task': '更新任务',
  'vision_toolkit_activate': '激活视觉工具',
}

// ── 工具描述中文化（Tool Catalog 的 tool.description）───────────────
// 按「工具名 → 中文描述」索引，不匹配英文原文：DSH 升级导致描述文案
// 变化时映射不失效。未覆盖的工具保留英文描述。
const TOOL_DESC_ZH = {
  'web_search': '搜索网络获取最新信息。',
  'bash': '执行命令并返回输出（可设置工作目录、超时）。',
  'read': '读取 UTF-8 文本文件并返回带行号的内容。',
  'write': '创建或完整替换一个 UTF-8 文本文件。',
  'edit': '对现有文本文件做精确的局部替换修改。',
  'glob': '按路径模式查找文件，包含隐藏与忽略文件。',
  'grep': '用正则搜索文件内容并返回匹配行。',
  'read_image': '读取图片文件并返回图片本身。',
  'skill': '加载指定技能（skill）的完整指令。',
  'workflow': '编写脚本编排多个子代理，并行扇出执行。',
  'subagent': '把独立任务委托给后台子代理。',
  'subagent_fork': '把任务委托给继承当前对话上下文的子代理。',
  'todo_write': '记录并更新当前工作的结构化任务清单。',
  'ask_user_question': '需要确认、选择或补充信息时向用户提问。',
  'exit_plan_mode': '呈现完整计划并退出计划模式。',
  'create_goal': '创建持久化的同会话完成目标。',
  'get_goal': '读取当前目标的准确 id 与状态。',
  'update_goal': '更新目标的执行状态、暂停或恢复。',
  'job_list': '列出当前启动的后台任务。',
  'job_output': '读取后台任务的输出。',
  'job_kill': '请求终止运行中的后台任务。',
  'list_agents': '按持久 id 列出可续接的后台子代理。',
  'send_message': '向后台子代理发送消息，继续其同一对话。',
  'interrupt_agent': '请求中断后台代理的当前轮次。',
  'cordis_define': '定义新的不可变 Cordis 插件包（不运行）。',
  'cordis_run': '启动或更新 Cordis 插件包。',
  'cordis_stop': '停止当前 Cordis 插件并保留定义。',
  'cordis_undefine': '永久删除 Cordis 插件及其所有包。',
  'cordis_inspect_list': '列出当前已知的检查提供者。',
  'cordis_inspect_query': '执行检查提供者的只读查询。',
  'cordis_inspect_self': '查看当前会话的插件、包与诊断。',
  'mcp__codebase-memory__check_index_coverage': '检查文件的索引覆盖情况。',
  'mcp__codebase-memory__delete_project': '把项目从索引中删除。',
  'mcp__codebase-memory__detect_changes': '把 git 变更映射为影响半径。',
  'mcp__codebase-memory__get_architecture': '获取项目高层架构总览。',
  'mcp__codebase-memory__get_code_snippet': '读取函数或类的源码。',
  'mcp__codebase-memory__get_graph_schema': '获取知识图谱的节点与边类型。',
  'mcp__codebase-memory__index_repository': '把仓库索引进知识图谱。',
  'mcp__codebase-memory__index_status': '查看项目索引状态与覆盖报告。',
  'mcp__codebase-memory__ingest_traces': '导入运行时调用轨迹。',
  'mcp__codebase-memory__list_projects': '列出已索引的项目。',
  'mcp__codebase-memory__manage_adr': '创建或更新架构决策记录。',
  'mcp__codebase-memory__query_graph': '执行 Cypher 图查询。',
  'mcp__codebase-memory__search_code': '图增强的代码搜索。',
  'mcp__codebase-memory__search_graph': '按关键词、正则或语义搜索代码图谱。',
  'mcp__codebase-memory__trace_path': '追踪调用链、数据流与跨服务路径。',
  'agent_teams_add_member': '向团队添加可续命的成员。',
  'agent_teams_claim_task': '为团队成员认领一个就绪任务。',
  'agent_teams_create': '创建多代理团队，你成为队长。',
  'agent_teams_create_task': '在团队创建任务并关联依赖。',
  'agent_teams_delete': '删除团队：中断成员并移除状态。',
  'agent_teams_reassign_task': '重试、重新指派任务或由队长接管。',
  'agent_teams_remove_member': '安全移除成员并回收任务。',
  'agent_teams_send_message': '给队长或团队成员发送消息。',
  'agent_teams_status': '查看团队快照：成员与任务状态。',
  'agent_teams_update_task': '更新任务状态或产出摘要。',
  'vision_toolkit_activate': '激活视觉工具集。',
}
