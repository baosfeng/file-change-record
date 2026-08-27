/**
 * dsh-my-memory — memory_query tool tests: read-only semantics, scope
 * filtering, keyword filtering, session-cwd resolution, output rendering.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMemoryQueryTool, filterItems, renderQueryResult } from '../lib/tool.js'

const dir = mkdtempSync(join(tmpdir(), 'dmm-tool-test-'))
process.env.DSH_HOME = dir

/** A fake global store with a fixed item list. */
function fakeStore(items) {
  return { list: () => items }
}

/** A fake project-store resolver keyed by cwd. */
function fakeProjectStores(map) {
  return async (cwd) => fakeStore(map.get(cwd) ?? [])
}

const GLOBAL_ITEMS = [
  { id: 'g1', desc: '回复使用中文', createdAt: 1, updatedAt: 2 },
  { id: 'g2', desc: '代码注释用中文', createdAt: 1, updatedAt: 3 },
]
const PROJECT_ITEMS = [
  { id: 'p1', desc: '本项目使用 vitest', createdAt: 1, updatedAt: 2 },
]

test('global query returns the global items (read-only)', async () => {
  const tool = createMemoryQueryTool({ globalStore: fakeStore(GLOBAL_ITEMS), getProjectStore: fakeProjectStores(new Map()) })
  const value = await tool.execute({ scope: 'global' }, {})
  assert.equal(value.scope, 'global')
  assert.equal(value.items.length, 2)
  assert.equal(value.items[0].desc, '回复使用中文')
})

test('keyword filter narrows the result (case-insensitive)', async () => {
  const tool = createMemoryQueryTool({ globalStore: fakeStore(GLOBAL_ITEMS), getProjectStore: fakeProjectStores(new Map()) })
  const value = await tool.execute({ scope: 'global', keyword: '中文' }, {})
  assert.equal(value.items.length, 2, 'both items contain 中文')
  const narrow = await tool.execute({ scope: 'global', keyword: '代码' }, {})
  assert.equal(narrow.items.length, 1)
  assert.equal(narrow.items[0].id, 'g2')
  const none = await tool.execute({ scope: 'global', keyword: '不存在的词' }, {})
  assert.equal(none.items.length, 0)
})

test('project query resolves the cwd from the calling agent session', async () => {
  const tool = createMemoryQueryTool({ globalStore: fakeStore(GLOBAL_ITEMS), getProjectStore: fakeProjectStores(new Map([[dir, PROJECT_ITEMS]])) })
  const exec = { agent: { session: { header: { cwd: dir } } } }
  const value = await tool.execute({ scope: 'project' }, exec)
  assert.equal(value.scope, 'project')
  assert.equal(value.cwd, dir)
  assert.equal(value.items.length, 1)
  assert.equal(value.items[0].desc, '本项目使用 vitest')
})

test('project query accepts an explicit cwd argument', async () => {
  const tool = createMemoryQueryTool({ globalStore: fakeStore(GLOBAL_ITEMS), getProjectStore: fakeProjectStores(new Map([[dir, PROJECT_ITEMS]])) })
  const value = await tool.execute({ scope: 'project', cwd: dir }, {})
  assert.equal(value.cwd, dir)
  assert.equal(value.items.length, 1)
})

test('project query without any cwd returns an empty result', async () => {
  const tool = createMemoryQueryTool({ globalStore: fakeStore(GLOBAL_ITEMS), getProjectStore: fakeProjectStores(new Map()) })
  const value = await tool.execute({ scope: 'project' }, {})
  assert.equal(value.cwd, '')
  assert.equal(value.items.length, 0, 'no cwd → no project memories')
})

test('the tool never mutates the stores (read-only)', async () => {
  const globalStore = fakeStore(GLOBAL_ITEMS)
  const tool = createMemoryQueryTool({ globalStore, getProjectStore: fakeProjectStores(new Map([[dir, PROJECT_ITEMS]])) })
  await tool.execute({ scope: 'global' }, {})
  await tool.execute({ scope: 'project', cwd: dir }, {})
  assert.equal(globalStore.list().length, 2, 'global store untouched')
})

test('filterItems handles a missing keyword', () => {
  assert.equal(filterItems(GLOBAL_ITEMS, undefined).length, 2)
  assert.equal(filterItems(GLOBAL_ITEMS, '').length, 2)
  assert.equal(filterItems(GLOBAL_ITEMS, '   ').length, 2, 'whitespace keyword → no filter')
  // 空关键词返回原数组引用（不执行过滤）
  assert.equal(filterItems(GLOBAL_ITEMS, ''), GLOBAL_ITEMS, 'empty keyword returns the original array')
})

test('filterItems matches case-insensitively on mixed-case keywords', () => {
  const items = [{ id: 'e1', desc: 'Use Vitest for tests', createdAt: 1, updatedAt: 2 }]
  assert.equal(filterItems(items, 'Vitest').length, 1, 'mixed-case keyword matches')
  assert.equal(filterItems(items, 'vitest').length, 1, 'lowercase keyword matches')
  assert.equal(filterItems(items, 'VITEST').length, 1, 'uppercase keyword matches')
  assert.equal(filterItems(items, 'jest').length, 0, 'non-matching keyword excluded')
})

test('renderQueryResult renders scopes, counts and items', () => {
  const text = renderQueryResult({ scope: 'global', cwd: '', projectRoot: '', items: GLOBAL_ITEMS })
  assert.ok(text.includes('全局记忆'), 'global label')
  assert.ok(text.includes('2 条'), 'count')
  assert.ok(text.includes('回复使用中文'), 'item desc')
  const project = renderQueryResult({ scope: 'project', cwd: dir, projectRoot: dir, items: PROJECT_ITEMS })
  assert.ok(project.includes('项目记忆'), 'project label')
  assert.ok(project.includes(dir), 'project root shown')
  const empty = renderQueryResult({ scope: 'global', cwd: '', projectRoot: '', items: [] })
  assert.equal(empty, '没有找到全局记忆。', 'empty global result message')
  const unknown = renderQueryResult({ scope: 'project', cwd: '', projectRoot: '', items: [] })
  assert.ok(unknown.includes('项目目录未知'), 'unknown project dir message')
  // 全局 scope 即使带 projectRoot 也不显示项目根（scope 决定 where）
  const globalWithRoot = renderQueryResult({ scope: 'global', cwd: '', projectRoot: '/x', items: [] })
  assert.ok(!globalWithRoot.includes('（项目：'), 'global scope never shows a project root')
})

test('project query tolerates a missing exec (no agent session)', async () => {
  const tool = createMemoryQueryTool({ globalStore: fakeStore(GLOBAL_ITEMS), getProjectStore: fakeProjectStores(new Map()) })
  const value = await tool.execute({ scope: 'project' }, undefined)
  assert.equal(value.cwd, '')
  assert.equal(value.items.length, 0, 'no exec → no project memories, no throw')
})

test('the tool schema declares scope required with global/project enum', () => {
  const tool = createMemoryQueryTool({ globalStore: fakeStore(GLOBAL_ITEMS), getProjectStore: fakeProjectStores(new Map()) })
  const params = tool.parameters
  assert.equal(params.type, 'object')
  assert.deepEqual(params.required, ['scope'], 'scope is the only required parameter')
  assert.deepEqual(params.properties.scope.enum, ['global', 'project'], 'scope enum')
  assert.equal(params.properties.scope.type, 'string')
  assert.equal(params.properties.keyword.type, 'string', 'keyword is a string')
  assert.equal(params.properties.cwd.type, 'string', 'cwd is a string')
  assert.equal(params.additionalProperties, false, 'no extra parameters')
})

test('the tool output schema declares the query result shape', () => {
  const tool = createMemoryQueryTool({ globalStore: fakeStore(GLOBAL_ITEMS), getProjectStore: fakeProjectStores(new Map()) })
  const schema = tool.output.schema
  assert.equal(schema.type, 'object')
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.required, ['scope', 'cwd', 'projectRoot', 'items'], 'top-level fields required')
  const props = schema.properties
  assert.equal(props.scope.type, 'string')
  assert.equal(props.cwd.type, 'string')
  assert.equal(props.projectRoot.type, 'string')
  assert.equal(props.items.type, 'array')
  const itemSchema = props.items.items
  assert.equal(itemSchema.type, 'object')
  assert.deepEqual(itemSchema.required, ['id', 'desc', 'createdAt', 'updatedAt'], 'item fields required')
  const itemProps = itemSchema.properties
  assert.equal(itemProps.id.type, 'string')
  assert.equal(itemProps.desc.type, 'string')
  assert.equal(itemProps.createdAt.type, 'number')
  assert.equal(itemProps.updatedAt.type, 'number')
})

test('the tool render produces text blocks', () => {
  const tool = createMemoryQueryTool({ globalStore: fakeStore(GLOBAL_ITEMS), getProjectStore: fakeProjectStores(new Map()) })
  const blocks = tool.output.render({ scope: 'global' }, { scope: 'global', cwd: '', projectRoot: '', items: GLOBAL_ITEMS })
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'text')
  assert.ok(blocks[0].text.includes('回复使用中文'))
})

test('cleanup', () => {
  rmSync(dir, { recursive: true, force: true })
})
