/**
 * PART: 界面中文化 DOM 精准替换逻辑 + 纯函数导出。
 *
 * 由 scripts/build.mjs 拼入 lib/client.js 的 factory 作用域（纯函数声明
 * 文本，无 import/export）。依赖 factory 内的 ZH_TABLE / ZH_PATTERNS /
 * ZH_SKIP_TAGS / CARD_TITLE_ZH / TOOL_NAME_ZH / TOOL_DESC_ZH 词表与
 * document / MutationObserver。行为与拆分前等价：只替换「完全等于」词表
 * key 的叶子文本节点，排除代码块/输入区/脚本区，MutationObserver 跟随
 * React 重渲染持续生效，fiber teardown 时断开观察器。
 */

/** 祖先链上是否命中「内容一律不动」的标签（代码、输入、脚本）。 */
function inSkipped(element) {
  let node = element
  while (node && node.nodeType === 1) {
    if (ZH_SKIP_TAGS.has(node.nodeName)) return true
    node = node.parentElement
  }
  return false
}

/** 工具调用卡片行（对话 / 轨迹均带 data-chat-call-id 行根）。 */
function inToolCallRow(element) {
  let node = element
  while (node && node.nodeType === 1) {
    if (node.hasAttribute && node.hasAttribute('data-chat-call-id')) return true
    node = node.parentElement
  }
  return false
}

/** 轨迹视图 Tool Catalog 容器内。 */
function inToolCatalog(element) {
  let node = element
  while (node && node.nodeType === 1) {
    const cls = node.className
    if (typeof cls === 'string' && cls.indexOf('toolCatalog') !== -1) return true
    node = node.parentElement
  }
  return false
}

/** 最近的 Tool Catalog 条目（details.toolCatalogItem）。 */
function catalogItemOf(element) {
  let node = element
  while (node && node.nodeType === 1) {
    const cls = node.className
    if (typeof cls === 'string' && cls.indexOf('toolCatalogItem') !== -1) return node
    node = node.parentElement
  }
  return null
}

/** 把 Tool Catalog 条目的描述元素替换为中文描述。 */
function localizeCatalogDesc(item, zhDesc) {
  const descEls = item.querySelectorAll('[class*="toolCatalogDescription"], [class*="toolCatalogFullDescription"]')
  for (const el of descEls) {
    if (el.firstChild && el.firstChild.nodeType === 3) {
      el.firstChild.nodeValue = zhDesc
    }
  }
}

/** 把 `${工具名} parameters JSON` 标签 → `${中文名} 参数 JSON`。 */
function localizeParamsJsonLabel(item) {
  const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT)
  let t
  while ((t = walker.nextNode()) !== null) {
    const v = String(t.nodeValue)
    if (v.indexOf(' parameters JSON') !== -1) {
      t.nodeValue = v.replace(' parameters JSON', ' 参数 JSON')
    }
  }
}

/**
 * 整体中文化一个 Tool Catalog 条目：工具名（toolCatalogName）、描述
 * （toolCatalogDescription / toolCatalogFullDescription）、参数 JSON 标签
 * （`${tool.name} parameters JSON`）。描述按工具名索引，不依赖英文原文。
 * localizedItems 为「已整体处理过的条目」集合（React 重建后新元素不在
 * 集合内，会重新处理）。
 */
function localizeCatalogItem(item, localizedItems) {
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
  if (zhDesc !== undefined) localizeCatalogDesc(item, zhDesc)
  localizeParamsJsonLabel(item)
}

/** 工具卡片变体标题（CARD_TITLE_ZH 精确匹配）；命中则替换并返回 true。 */
function tryCardTitle(textNode, trimmed) {
  const cardTitle = CARD_TITLE_ZH[trimmed]
  if (cardTitle === undefined) return false
  textNode.nodeValue = textNode.nodeValue.replace(trimmed, cardTitle)
  return true
}

/** others 变体摘要 `工具名 · …` 的工具名前缀替换；未映射时返回 false。 */
function trySummaryPrefix(textNode, trimmed) {
  const m = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_]*) · /)
  if (!m || TOOL_NAME_ZH[m[1]] === undefined) return false
  textNode.nodeValue = textNode.nodeValue.replace(m[1], TOOL_NAME_ZH[m[1]])
  return true
}

/** 全局词表精确匹配（ZH_TABLE）；命中则替换并返回 true。 */
function tryExactText(textNode, trimmed) {
  const exact = ZH_TABLE[trimmed]
  if (exact === undefined) return false
  textNode.nodeValue = textNode.nodeValue.replace(trimmed, exact)
  return true
}

/** 动态格式匹配（ZH_PATTERNS，保持原始数字/单位）；命中则替换并返回 true。 */
function tryPatternText(textNode, trimmed) {
  for (const [pattern, replacement] of ZH_PATTERNS) {
    if (pattern.test(trimmed)) {
      textNode.nodeValue = textNode.nodeValue.replace(pattern, replacement)
      return true
    }
  }
  return false
}

/** 工具调用卡片行内的翻译（变体标题优先，其次 others 摘要工具名前缀）。 */
function translateToolCallText(textNode, trimmed) {
  if (tryCardTitle(textNode, trimmed)) return true
  return trySummaryPrefix(textNode, trimmed)
}

/** 翻译单个文本节点（词表/动态格式/卡片/条目），不匹配则不动。 */
function translateTextNode(textNode, localizedItems) {
  const raw = textNode.nodeValue
  if (typeof raw !== 'string' || raw === '') return
  const trimmed = raw.trim()
  if (trimmed === '') return
  if (inSkipped(textNode.parentElement)) return
  if (inToolCallRow(textNode.parentElement)) {
    translateToolCallText(textNode, trimmed)
    return
  }
  if (inToolCatalog(textNode.parentElement)) {
    const item = catalogItemOf(textNode.parentElement)
    if (item) {
      localizeCatalogItem(item, localizedItems)
      return
    }
  }
  if (tryExactText(textNode, trimmed)) return
  tryPatternText(textNode, trimmed)
}

/**
 * 安装界面中文化：扫描现有文本节点 + MutationObserver 跟随 React 重渲染。
 * 返回 disposer（断开观察器）。
 */
function installUiLocalize() {
  if (typeof document === 'undefined' || document === null || typeof MutationObserver === 'undefined') return () => {}

  /** 已整体处理过的 Tool Catalog 条目（React 重建后新元素不在集合内，会重新处理）。 */
  const localizedItems = new WeakSet()

  const scan = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const hits = []
    let node
    while ((node = walker.nextNode()) !== null) hits.push(node)
    for (const hit of hits) translateTextNode(hit, localizedItems)
  }

  scan(document.body)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData' && mutation.target.nodeType === 3) {
        translateTextNode(mutation.target, localizedItems)
      } else if (mutation.type === 'childList') {
        for (const added of mutation.addedNodes) {
          if (added.nodeType === 1) scan(added)
          else if (added.nodeType === 3) translateTextNode(added, localizedItems)
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
