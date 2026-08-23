/**
 * dsh-think-zh-expand — client half (browser).
 *
 * 功能 2：思考（reasoning）内容默认展开显示。
 *
 * 内置的 assistant-step 渲染器把 reasoning 块折叠成单行（ReasoningRow，
 * `useState(false)`，只显示第一行摘要）。本插件替换 `conversation.chat.node`
 * 的 `assistant-step` 渲染器：
 *  - reasoning 块 → 默认展开的「思考」块（完整内容直接显示，点击标题行可
 *    收起，流式生成中强制保持展开）；
 *  - text 块 → 轻量 Markdown 渲染（代码块 / 标题 / 列表 / 引用 / 粗体 /
 *    行内代码 / 链接）；
 *  - image 块 → 复用 owner 的 renderMessageImages（内置图片渲染）；
 *  - tool-call 块与内置一致跳过（tool-call 有独立节点渲染）。
 *
 * 功能 3：界面标签中文化。
 *
 * 官方 UI（dsh-client-ui-conversation / dsh-client-ui-trajectory）的 zh 字典
 * 本身未翻译完（如 `toolbar.duration: "Duration"`），且存在硬编码英文
 * （"Thinking"、"Tool Call"、"ASSISTANT" 等）；`locale.register` 对已注册的
 * 同 ns+locale 字典重复注册会抛错，无法经 locale 服务补译。因此本插件在
 * DOM 层做精准文本替换：只匹配「完全等于」词表的叶子文本节点（排除
 * pre/code/输入区，避免误伤代码块与消息正文），MutationObserver 跟随
 * React 重渲染持续生效。
 *
 * 样式走 DSH 语义 token（--dsw-alias-* / --dsw-font-*），随 activation 注入、
 * fiber teardown 卸载（HMR/禁用无残留）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-think-zh-expand',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useState } = require('react')

    // ── 轻量行内 Markdown：行内代码 / 粗体 / 斜体 / 链接 ───────────────
    // 行内代码按 CommonMark 语义：N 个反引号开闭配对（\1 回声闭合串），
    // 内容允许含单个反引号（如 `` `agent/status` `` → <code>`agent/status`</code>）；
    // 仅支持单反引号配对的实现会在双反引号输入上错位解析，把内容切成
    // 裸文本。闭合串后不能紧跟反引号（(?!`)，避免把更长的 run 误当闭合。
    function mdInline(text, key) {
      const out = []
      // content 首字符禁反引号（[^`\n]）："````"（4 连反引号）这类无内容的
      // 反引号串保持原样，不会被拆成 code"``"。
      const re = /(`+)([^`\n][^\n]*?)\1(?!`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\*[^*]+\*)/g
      // CommonMark：内容以空格开头且以空格结尾、且不只含空格时，去首尾各一个空格。
      const trimCode = (raw) => {
        if (raw.length > 1 && raw[0] === ' ' && raw[raw.length - 1] === ' ' && raw.trim() !== '') {
          return raw.slice(1, -1)
        }
        return raw
      }
      let last = 0
      let m = null
      let k = 0
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) out.push(text.slice(last, m.index))
        const kk = key + '-i' + k
        if (m[1] !== undefined) {
          out.push(createElement('code', { key: kk }, trimCode(m[2])))
        } else if (m[3] !== undefined) {
          out.push(createElement('strong', { key: kk }, m[3].slice(2, -2)))
        } else if (m[4] !== undefined) {
          const lm = m[4].match(/^\[([^\]]+)\]\(([^)]+)\)$/)
          if (lm) {
            out.push(createElement('a', { key: kk, href: lm[2], target: '_blank', rel: 'noreferrer' }, lm[1]))
          } else {
            out.push(m[4])
          }
        } else {
          out.push(createElement('em', { key: kk }, m[5].slice(1, -1)))
        }
        k += 1
        last = m.index + m[0].length
      }
      if (last < text.length) out.push(text.slice(last))
      return out
    }

    // ── 轻量块级 Markdown：代码块 / 标题 / 列表 / 引用 / 段落 ──────────
    function MarkdownView({ text }) {
      const lines = String(text).split('\n')
      const out = []
      let i = 0
      while (i < lines.length) {
        const line = lines[i]
        const fence = line.match(/^```(\w*)\s*$/)
        if (fence) {
          const buf = []
          i += 1
          while (i < lines.length && !/^```\s*$/.test(lines[i])) {
            buf.push(lines[i])
            i += 1
          }
          i += 1
          // Keep the fence language (```mermaid / ```dsh-ui / ```js ...) on the
          // <code> element and wrap the block in the host's `md-code-block`
          // container so third-party renderers that scan the stock DOM
          // structure (dsh-mermaid-render finds `div.md-code-block`,
          // dsh-genui matches the md-code-block surface) can detect it.
          out.push(createElement('div', { key: 'b' + out.length, className: 'md-code-block' },
            createElement('pre', { className: 'tzx-pre' },
              createElement('code', { className: fence[1] ? 'language-' + fence[1] : '' }, buf.join('\n')))))
          continue
        }
        const heading = line.match(/^(#{1,4})\s+(.*)$/)
        if (heading) {
          const level = heading[1].length
          out.push(createElement('h' + level, { key: 'b' + out.length, className: 'tzx-h' },
            ...mdInline(heading[2], 'h' + out.length)))
          i += 1
          continue
        }
        const bullet = line.match(/^\s*[-*+]\s+(.*)$/)
        if (bullet) {
          const items = [bullet[1]]
          i += 1
          while (i < lines.length) {
            const b2 = lines[i].match(/^\s*[-*+]\s+(.*)$/)
            if (!b2) break
            items.push(b2[1])
            i += 1
          }
          out.push(createElement('ul', { key: 'b' + out.length, className: 'tzx-ul' },
            items.map((it, j) => createElement('li', { key: j },
              ...mdInline(it, 'ul' + out.length + '-' + j)))))
          continue
        }
        const num = line.match(/^\s*\d+[.)]\s+(.*)$/)
        if (num) {
          const items = [num[1]]
          i += 1
          while (i < lines.length) {
            const n2 = lines[i].match(/^\s*\d+[.)]\s+(.*)$/)
            if (!n2) break
            items.push(n2[1])
            i += 1
          }
          out.push(createElement('ol', { key: 'b' + out.length, className: 'tzx-ol' },
            ...items.map((it, j) => createElement('li', { key: j },
              ...mdInline(it, 'ol' + out.length + '-' + j)))))
          continue
        }
        const quote = line.match(/^\s*>\s?(.*)$/)
        if (quote) {
          const buf = [quote[1]]
          i += 1
          while (i < lines.length) {
            const q2 = lines[i].match(/^\s*>\s?(.*)$/)
            if (!q2) break
            buf.push(q2[1])
            i += 1
          }
          out.push(createElement('blockquote', { key: 'b' + out.length, className: 'tzx-bq' },
            ...buf.map((l, j) => createElement('p', { key: j }, ...mdInline(l, 'bq' + out.length + '-' + j)))))
          continue
        }
        // 表格：表头行（| a | b |）+ 分隔行（|---|---|）+ 数据行
        const tableHead = line.match(/^\s*\|.*\|\s*$/)
        if (tableHead) {
          const sep = lines[i + 1]
          const isSep = typeof sep === 'string' && /^\s*\|?[\s:\-|]+\|?\s*$/.test(sep) && sep.includes('-')
          if (isSep) {
            const cellsOf = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
            const aligns = cellsOf(sep).map((a) => {
              if (a.startsWith(':') && a.endsWith(':')) return 'center'
              if (a.endsWith(':')) return 'right'
              return 'left'
            })
            const header = cellsOf(line)
            const dataRows = []
            i += 2
            while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
              dataRows.push(cellsOf(lines[i]))
              i += 1
            }
            const cellStyle = (j) => ({ textAlign: aligns[j] ?? 'left' })
            out.push(createElement('table', { key: 'b' + out.length, className: 'tzx-table' },
              createElement('thead', null,
                createElement('tr', null, header.map((c, j) =>
                  createElement('th', { key: j, style: cellStyle(j) },
                    ...mdInline(c, 'th' + out.length + '-' + j))))),
              dataRows.length > 0
                ? createElement('tbody', null,
                    dataRows.map((row, ri) => createElement('tr', { key: ri },
                      row.map((c, j) => createElement('td', { key: j, style: cellStyle(j) },
                        ...mdInline(c, 'td' + out.length + '-' + ri + '-' + j))))))
                : null))
            continue
          }
          // 无分隔行（不是标准表格）：回落到段落逻辑。
        }
        if (line.trim() === '') {
          i += 1
          continue
        }
        const para = [line]
        i += 1
        while (i < lines.length) {
          const nxt = lines[i]
          if (nxt.trim() === '' || /^(#{1,4})\s|^\s*[-*+]\s|^\s*\d+[.)]\s|^\s*>\s?|^```/.test(nxt)) break
          para.push(nxt)
          i += 1
        }
        out.push(createElement('p', { key: 'b' + out.length, className: 'tzx-p' },
          ...mdInline(para.join('\n'), 'p' + out.length)))
      }
      return createElement('div', { className: 'tzx-md' }, out)
    }

    // ── 思考块：默认展开，可点击收起，流式中强制展开 ───────────────────
    function ThinkBlock({ text, running }) {
      const [expanded, setExpanded] = useState(true)
      const open = expanded || running
      const firstLine = (t) => {
        const nl = t.indexOf('\n')
        return nl === -1 ? t : t.slice(0, nl)
      }
      return createElement('div', { className: 'tzx-think', 'data-variant': 'think', 'data-state': running ? 'running' : 'ok' },
        createElement('div', {
          className: 'tzx-think-row',
          role: 'button',
          tabIndex: 0,
          'aria-expanded': open,
          onClick: () => setExpanded((v) => !v),
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setExpanded((v) => !v)
            }
          },
        },
          createElement('span', { className: 'tzx-think-chevron' }, open ? '▾' : '▸'),
          createElement('span', { className: 'tzx-think-title' }, '思考'),
          !open && createElement('span', { className: 'tzx-think-summary' }, firstLine(text)),
        ),
        // 思考内容也走轻量 Markdown 渲染（代码块 / mermaid / 表格 / 列表 /
        // 标题等），否则思考里出现的 markdown 会以原始语法文本显示。
        open && createElement('div', { className: 'tzx-think-body' },
          createElement(MarkdownView, { text })),
      )
    }

    // ── assistant-step 节点渲染器：替换内置单行折叠版 ──────────────────
    function AssistantStepView({ node, renderMessageImages }) {
      const data = node && node.data ? node.data : null
      if (!data || !Array.isArray(data.blocks)) return null
      const streaming = data.status === 'running'
      const interrupted = data.status === 'interrupted'
      const last = data.blocks.length - 1
      const rendered = []
      for (let i = 0; i < data.blocks.length; i += 1) {
        const block = data.blocks[i]
        if (!block) continue
        if (block.kind === 'text' && typeof block.text === 'string') {
          rendered.push(createElement(MarkdownView, { key: 't' + i, text: block.text }))
        } else if (block.kind === 'reasoning' && typeof block.text === 'string') {
          rendered.push(createElement(ThinkBlock, {
            key: 'r' + i,
            text: block.text,
            running: streaming && i === last,
          }))
        } else if (block.kind === 'image' && typeof renderMessageImages === 'function') {
          const start = i
          const group = [block]
          while (i + 1 < data.blocks.length) {
            const next = data.blocks[i + 1]
            if (!next || next.kind !== 'image') break
            group.push(next)
            i += 1
          }
          rendered.push(createElement('div', { key: 'img' + start },
            renderMessageImages({ images: group.map((b) => ({ attachment: b.attachment })), align: 'start' })))
        }
      }
      if (interrupted) {
        rendered.push(createElement('span', { key: 'stopped', className: 'tzx-stopped' }, '已停止'))
      }
      return createElement('div', { className: 'tzx-assistant', 'data-streaming': streaming || undefined },
        createElement('div', { className: 'tzx-assistant-body' }, rendered))
    }

    // ── 样式（DSH 语义 token，随 activation 注入）───────────────────────
    const STYLES = `
.tzx-assistant{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary);font-size:16px;line-height:28px}
.tzx-assistant-body{display:flex;flex-direction:column;gap:16px}
.tzx-md{display:flex;flex-direction:column;gap:8px;min-width:0}
.tzx-md .tzx-p{margin:0}
.tzx-md h1,.tzx-md h2,.tzx-md h3,.tzx-md h4{margin:0;font-weight:600;line-height:1.35}
.tzx-md ul,.tzx-md ol{margin:0;padding-left:26px}
.tzx-md li{margin:2px 0}
.tzx-md .tzx-pre{margin:0;background:var(--dsw-alias-markdown-code-block);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px 16px;overflow:auto;font:var(--dsw-font-markdown-code-block-small)}
.tzx-md code{background:var(--dsw-alias-markdown-code-block);border-radius:4px;padding:0 4px;font:var(--dsw-font-markdown-code-block-small)}
.tzx-md .tzx-pre code{background:none;padding:0}
.tzx-md .tzx-bq{margin:0;padding-left:12px;border-left:3px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
.tzx-md .tzx-bq p{margin:0}
.tzx-md .tzx-table{border-collapse:collapse;margin:0;font-size:14px;line-height:22px}
.tzx-md .tzx-table th,.tzx-md .tzx-table td{border:1px solid var(--dsw-alias-border-l1);padding:4px 10px}
.tzx-md .tzx-table th{background:var(--dsw-alias-markdown-code-block);font-weight:600}
.tzx-md a{color:var(--dsw-alias-accent-primary)}
.tzx-think{display:flex;flex-direction:column;color:var(--dsw-alias-label-tertiary)}
.tzx-think-row{display:flex;align-items:center;gap:8px;min-width:0;cursor:pointer;user-select:none;padding:2px 0;border-radius:6px}
.tzx-think-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.tzx-think-chevron{flex:none;color:var(--dsw-alias-label-secondary);font-size:12px}
.tzx-think-title{flex:none;font-size:14px;font-weight:400;color:var(--dsw-alias-label-secondary)}
.tzx-think-summary{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;font-size:14px;line-height:24px;overflow:hidden}
.tzx-think-body{white-space:pre-wrap;word-break:break-word;padding:4px 0 4px 24px;font-size:14px;line-height:24px;color:var(--dsw-alias-label-tertiary)}
.tzx-stopped{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);border-radius:6px;align-self:flex-start;padding:0 6px;font-size:11px;line-height:18px}
    `

    exports.inject = ['slots']

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

    /**
     * 安装界面中文化：扫描现有文本节点 + MutationObserver 跟随 React 重渲染。
     * 返回 disposer（断开观察器）。
     */
    function installUiLocalize() {
      if (typeof document === 'undefined' || document === null || typeof MutationObserver === 'undefined') return () => {}

      /** 已整体处理过的 Tool Catalog 条目（React 重建后新元素不在集合内，会重新处理）。 */
      const localizedItems = new WeakSet()

      const inSkipped = (element) => {
        let node = element
        while (node && node.nodeType === 1) {
          if (ZH_SKIP_TAGS.has(node.nodeName)) return true
          node = node.parentElement
        }
        return false
      }

      /** 工具调用卡片行（对话 / 轨迹均带 data-chat-call-id 行根）。 */
      const inToolCallRow = (element) => {
        let node = element
        while (node && node.nodeType === 1) {
          if (node.hasAttribute && node.hasAttribute('data-chat-call-id')) return true
          node = node.parentElement
        }
        return false
      }

      /** 轨迹视图 Tool Catalog 容器内。 */
      const inToolCatalog = (element) => {
        let node = element
        while (node && node.nodeType === 1) {
          const cls = node.className
          if (typeof cls === 'string' && cls.indexOf('toolCatalog') !== -1) return true
          node = node.parentElement
        }
        return false
      }

      /** 最近的 Tool Catalog 条目（details.toolCatalogItem）。 */
      const catalogItemOf = (element) => {
        let node = element
        while (node && node.nodeType === 1) {
          const cls = node.className
          if (typeof cls === 'string' && cls.indexOf('toolCatalogItem') !== -1) return node
          node = node.parentElement
        }
        return null
      }

      /**
       * 整体中文化一个 Tool Catalog 条目：工具名（toolCatalogName）、描述
       * （toolCatalogDescription / toolCatalogFullDescription）、参数 JSON 标签
       * （`${tool.name} parameters JSON`）。描述按工具名索引，不依赖英文原文。
       */
      const localizeCatalogItem = (item) => {
        if (localizedItems.has(item)) return
        localizedItems.add(item)
        const nameEl = item.querySelector('[class*="toolCatalogName"]')
        if (!nameEl || !nameEl.firstChild || nameEl.firstChild.nodeType !== 3) return
        const nameNode = nameEl.firstChild
        const en = String(nameNode.nodeValue).trim()
        const zhName = TOOL_NAME_ZH[en]
        if (zhName === undefined) return
        nameNode.nodeValue = String(nameNode.nodeValue).replace(en, zhName)
        const zhDesc = TOOL_DESC_ZH[en]
        if (zhDesc !== undefined) {
          const descEls = item.querySelectorAll('[class*="toolCatalogDescription"], [class*="toolCatalogFullDescription"]')
          for (const el of descEls) {
            if (el.firstChild && el.firstChild.nodeType === 3) {
              el.firstChild.nodeValue = zhDesc
            }
          }
        }
        // `${工具名} parameters JSON` 标签 → `${中文名} 参数 JSON`
        const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT)
        let t = null
        while ((t = walker.nextNode()) !== null) {
          const v = String(t.nodeValue)
          if (v.indexOf(' parameters JSON') !== -1) {
            t.nodeValue = v.replace(' parameters JSON', ' 参数 JSON')
          }
        }
      }

      const translateText = (textNode) => {
        const raw = textNode.nodeValue
        if (typeof raw !== 'string' || raw === '') return
        const trimmed = raw.trim()
        if (trimmed === '') return
        if (inSkipped(textNode.parentElement)) return

        // 工具调用卡片行内：变体标题 / 工具自有标题 / others 摘要的工具名前缀
        if (inToolCallRow(textNode.parentElement)) {
          const cardTitle = CARD_TITLE_ZH[trimmed]
          if (cardTitle !== undefined) {
            textNode.nodeValue = raw.replace(trimmed, cardTitle)
            return
          }
          // others 变体摘要形如 `ask_user_question · {…}`，替换开头的工具名。
          const m = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_]*) · /)
          if (m && TOOL_NAME_ZH[m[1]] !== undefined) {
            textNode.nodeValue = raw.replace(m[1], TOOL_NAME_ZH[m[1]])
            return
          }
        } else if (inToolCatalog(textNode.parentElement)) {
          // 轨迹 Tool Catalog：按条目整体处理一次（名称/描述/参数标签）。
          const item = catalogItemOf(textNode.parentElement)
          if (item) {
            localizeCatalogItem(item)
            return
          }
        }

        const exact = ZH_TABLE[trimmed]
        if (exact !== undefined) {
          textNode.nodeValue = raw.replace(trimmed, exact)
          return
        }
        for (const [pattern, replacement] of ZH_PATTERNS) {
          if (pattern.test(trimmed)) {
            textNode.nodeValue = raw.replace(pattern, replacement)
            return
          }
        }
      }

      const scan = (root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        const hits = []
        let node
        while ((node = walker.nextNode()) !== null) hits.push(node)
        for (const hit of hits) translateText(hit)
      }

      scan(document.body)

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData' && mutation.target.nodeType === 3) {
            translateText(mutation.target)
          } else if (mutation.type === 'childList') {
            for (const added of mutation.addedNodes) {
              if (added.nodeType === 1) scan(added)
              else if (added.nodeType === 3) translateText(added)
            }
          }
        }
      })
      observer.observe(document.body, { childList: true, subtree: true, characterData: true })
      return () => observer.disconnect()
    }

    // ── 纯函数导出（供纯 Node 测试断言映射，不依赖 DOM）─────────────────
    exports.zhToolName = (name) => TOOL_NAME_ZH[name] ?? null
    exports.zhToolDesc = (name) => TOOL_DESC_ZH[name] ?? null
    exports.zhCardTitle = (title) => CARD_TITLE_ZH[title] ?? null
    /** others 卡片摘要 `工具名 · …` 的工具名前缀替换；不匹配时返回 null。 */
    exports.zhCardSummary = (text) => {
      const m = String(text).match(/^([a-zA-Z][a-zA-Z0-9_]*) · /)
      if (m && TOOL_NAME_ZH[m[1]] !== undefined) return String(text).replace(m[1], TOOL_NAME_ZH[m[1]])
      return null
    }

    exports.apply = function apply(ctx) {
      // Inject the shared stylesheet once (torn down with the fiber).
      ctx.effect(() => {
        if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') return () => {}
        const style = document.createElement('style')
        style.setAttribute('data-dsh-think-zh-expand', 'styles')
        style.textContent = STYLES
        document.head.appendChild(style)
        return () => {
          if (style.parentNode) style.parentNode.removeChild(style)
        }
      }, 'dsh-think-zh-expand: styles')

      // Replace the built-in assistant-step renderer: register with a lower
      // priority than the shipped occupant (0) so this entry wins the keyed
      // dispatch, exactly like dsh-better-sidebar shadows built-in seats.
      ctx.effect(() => ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
        name: 'conversation.chat.node',
        key: 'assistant-step',
        priority: -1,
        registrant: 'dsh-think-zh-expand',
      }, (props) => createElement(AssistantStepView, props))), 'dsh-think-zh-expand: assistant-step renderer')

      // UI 标签中文化（词表替换，随 fiber 卸载断开观察器）。
      ctx.effect(() => installUiLocalize(), 'dsh-think-zh-expand: ui localization')
    }

    return module.exports
  },
})
