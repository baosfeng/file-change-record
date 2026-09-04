/**
 * dsh-my-memory — system-prompt injection.
 *
 * Registers one section (`dsh-my-memory`, order -95 — before the deployment
 * persona at 0 and before dsh-think-zh's -90) whose text is a provider
 * evaluated at every prompt assembly: it reads the GLOBAL memory cache and
 * renders the newest `maxItems` entries, each summarized to
 * `maxDescLength` characters — the summary prefers the full first sentence
 * and never cuts mid-sentence (issue #105). An empty memory renders an
 * empty section, which the prompt renderer drops — so the injection costs
 * nothing until the user actually stores memories. Because the text is
 * re-evaluated per assembly, a memory saved mid-session is visible to the
 * agent on the very next turn without a restart.
 */
import { DEFAULT_MAX_DESC_LENGTH, summarizeDesc } from './memory-text.js'

/** Default cap on how many global memories are injected. */
const DEFAULT_MAX_ITEMS = 5

/**
 * Truncate one desc to the length cap, preferring the full first sentence
 * (semantic truncation — never cuts mid-sentence when a sentence boundary
 * fits; issue #105). Kept as the historical export name for callers/tests;
 * the implementation now lives in memory-text.js.
 */
export function truncateDesc(desc, maxLength) {
  return summarizeDesc(desc, maxLength)
}

/** Render the injected section text for a list of global memories. */
export function renderMemorySection(items, { maxItems, maxDescLength }) {
  const picked = items.slice(0, maxItems)
  if (picked.length === 0) return ''
  const lines = picked.map((item) => `- ${truncateDesc(item.desc, maxDescLength)}`)
  return `## 用户记忆（全局）
以下是你需要始终携带的用户长期偏好与关键约定（来自 dsh-my-memory 插件）：
${lines.join('\n')}`
}

/** Build the system-prompt section registration for a global store. */
export function createMemorySection(globalStore, config) {
  const maxItems = Number.isInteger(config?.maxItems) && config.maxItems > 0 ? config.maxItems : DEFAULT_MAX_ITEMS
  const maxDescLength =
    Number.isInteger(config?.maxDescLength) && config.maxDescLength > 0 ? config.maxDescLength : DEFAULT_MAX_DESC_LENGTH
  return {
    name: 'dsh-my-memory',
    order: -95,
    text: () => renderMemorySection(globalStore.list(), { maxItems, maxDescLength }),
  }
}
