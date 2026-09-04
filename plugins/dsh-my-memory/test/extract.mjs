/**
 * dsh-my-memory — issue #78 rule-based extractor tests:
 * hits for preference/fact/project/stack/workflow patterns, misses,
 * the autoLearn-off switch (via extractor='llm' placeholder + empty rules),
 * scope suggestion (global vs project), dedup, candidate caps and sentence
 * splitting.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { MAX_CANDIDATES_PER_SESSION, extractCandidates, splitSentences } from '../lib/extract.js'

const NOW = 1_800_000_000_000
const SESSION = 'session-1'

/** One-arg convenience: extract with a fixed session/now. */
function extract(messages, opts = {}) {
  return extractCandidates(messages, { now: NOW, sessionId: SESSION, ...opts })
}

test('extracts a preference candidate from a user preference sentence', () => {
  const candidates = extract(['请用中文回复我'])
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].category, 'preference')
  assert.ok(candidates[0].desc.includes('请用中文回复我'), 'desc keeps the sentence')
  assert.equal(candidates[0].scope, 'global', 'no project hint → global')
  assert.equal(candidates[0].source.sessionId, SESSION)
  assert.equal(candidates[0].createdAt, NOW)
})

test('extracts a fact candidate from a user fact statement', () => {
  const candidates = extract(['我在用 macOS 开发'])
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].category, 'fact')
})

test('extracts a stack candidate from a tech-stack statement', () => {
  const candidates = extract(['这个项目用 pnpm 装依赖'])
  assert.equal(candidates.length >= 1, true)
  const stack = candidates.find((c) => c.category === 'stack')
  assert.ok(stack, 'stack candidate extracted')
  assert.ok(stack.desc.includes('pnpm'))
})

test('extracts a workflow candidate from a habitual-flow statement', () => {
  const candidates = extract(['每次提 issue 前先查档案'])
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].category, 'workflow')
})

test('extracts nothing from a message with no matching patterns', () => {
  const candidates = extract(['今天天气不错，随便聊聊。'])
  assert.deepEqual(candidates, [], 'no pattern hit → no candidates')
})

test('extractor=llm is a reserved placeholder that yields nothing (no silent writes)', () => {
  const candidates = extract(['请用中文回复我'], { extractor: 'llm' })
  assert.deepEqual(candidates, [], 'llm extractor is a placeholder (no rule extraction)')
})

test('project-scope candidate carries the session cwd and project scope', () => {
  const candidates = extract(['本项目用 vitest 测试'], { cwd: '/work/proj' })
  assert.equal(candidates.length >= 1, true)
  const project = candidates.find((c) => c.scope === 'project')
  assert.ok(project, 'project candidate suggested')
  assert.equal(project.cwd, '/work/proj', 'candidate carries the cwd for project writes')
})

test('project hint without a session cwd falls back to global scope', () => {
  const candidates = extract(['本项目用 vitest 测试'])
  const all = candidates.filter((c) => c.scope === 'project')
  assert.deepEqual(all, [], 'no cwd → no project-scope candidate')
})

test('dedups identical candidates within one extraction pass', () => {
  const candidates = extract(['请用中文回复我。请用中文回复我。'])
  const prefsOnly = candidates.filter((c) => c.category === 'preference')
  assert.equal(prefsOnly.length, 1, 'repeated identical sentence yields one candidate')
})

test('caps the number of candidates per session', () => {
  const messages = Array.from({ length: 30 }, (_, i) => `请记住第 ${i} 条偏好`)
  const candidates = extract(messages)
  assert.ok(candidates.length <= MAX_CANDIDATES_PER_SESSION, 'candidate cap enforced')
  assert.equal(candidates.length, MAX_CANDIDATES_PER_SESSION, 'cap reached for abundant content')
})

test('custom max overrides the per-session cap', () => {
  const messages = Array.from({ length: 10 }, (_, i) => `请记住第 ${i} 条偏好`)
  const candidates = extract(messages, { max: 3 })
  assert.equal(candidates.length, 3)
})

test('tolerates non-string messages and empty input', () => {
  assert.deepEqual(extract([]), [])
  assert.deepEqual(extract([null, undefined, 42, '   ']), [], 'junk messages ignored')
  assert.deepEqual(extract(['']), [], 'empty message ignored')
})

test('splitSentences splits on zh/en sentence boundaries and keeps single sentences', () => {
  assert.deepEqual(splitSentences('第一句。第二句！第三句？'), ['第一句。', '第二句！', '第三句？'])
  assert.deepEqual(splitSentences('一句没有边界'), ['一句没有边界'])
  assert.deepEqual(splitSentences(''), [])
  assert.deepEqual(splitSentences('   '), [])
})
