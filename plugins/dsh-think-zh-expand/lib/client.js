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
    function mdInline(text, key) {
      const out = []
      const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g
      let last = 0
      let m = null
      let k = 0
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) out.push(text.slice(last, m.index))
        const tok = m[0]
        const kk = key + '-i' + k
        if (tok[0] === '`') {
          out.push(createElement('code', { key: kk }, tok.slice(1, -1)))
        } else if (tok.startsWith('**')) {
          out.push(createElement('strong', { key: kk }, tok.slice(2, -2)))
        } else if (tok.startsWith('*')) {
          out.push(createElement('em', { key: kk }, tok.slice(1, -1)))
        } else {
          const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
          if (lm) {
            out.push(createElement('a', { key: kk, href: lm[2], target: '_blank', rel: 'noreferrer' }, lm[1]))
          } else {
            out.push(tok)
          }
        }
        k += 1
        last = m.index + tok.length
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
          out.push(createElement('pre', { key: 'b' + out.length, className: 'tzx-pre' },
            createElement('code', null, buf.join('\n'))))
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
        open && createElement('div', { className: 'tzx-think-body' }, text),
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

    /**
     * 安装界面中文化：扫描现有文本节点 + MutationObserver 跟随 React 重渲染。
     * 返回 disposer（断开观察器）。
     */
    function installUiLocalize() {
      if (typeof document === 'undefined' || document === null || typeof MutationObserver === 'undefined') return () => {}

      const inSkipped = (element) => {
        let node = element
        while (node && node.nodeType === 1) {
          if (ZH_SKIP_TAGS.has(node.nodeName)) return true
          node = node.parentElement
        }
        return false
      }

      const translateText = (textNode) => {
        const raw = textNode.nodeValue
        if (typeof raw !== 'string' || raw === '') return
        const trimmed = raw.trim()
        if (trimmed === '') return
        if (inSkipped(textNode.parentElement)) return
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
