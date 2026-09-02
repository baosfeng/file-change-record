// ── utils: pure display helpers (truncation / relative time / sort) ──────
// 纯展示层辅助函数：不触碰服务端状态，供客户端视图使用并可被单测直接调用。
// 长条目截断 + 展开为纯展示层（issue #110 视觉设计）——不依赖 #105 的服务端逻辑。
const TRUNCATE_LEN = 60

/** 按字符截断长条目：返回截断后的文本与是否被截断（截断时用「…」收尾）。 */
function truncateText(text, max = TRUNCATE_LEN) {
  const value = String(text ?? '').trim()
  if (value.length <= max) return { text: value, truncated: false }
  return { text: `${value.slice(0, max)}…`, truncated: true }
}

/** 更新时间相对化：「刚刚」「n 分钟前」「n 小时前」「n 天前」，超过 30 天回退绝对时间。 */
function relativeTime(ts) {
  const time = Number(ts)
  if (!Number.isFinite(time)) return ''
  const diff = Date.now() - time
  if (diff < 0) return strings.updatedAt(time) // 未来时间（时钟偏移）回退绝对时间
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return strings.justNow()
  if (minutes < 60) return strings.minutesAgo(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return strings.hoursAgo(hours)
  const days = Math.floor(hours / 24)
  if (days < 30) return strings.daysAgo(days)
  return strings.updatedAt(time)
}

/** 按更新时间排序（dir: 'desc' 最新在顶 / 'asc' 最旧在顶）；返回新数组，不改原列表。 */
function sortMemories(items, dir = 'desc') {
  const copy = items.slice()
  copy.sort((a, b) => (dir === 'asc' ? a.updatedAt - b.updatedAt : b.updatedAt - a.updatedAt))
  return copy
}

// 导出纯函数供单测直接断言（插件只消费 apply，多余导出在 client 端无副作用）。
exports.truncateText = truncateText
exports.relativeTime = relativeTime
exports.sortMemories = sortMemories
