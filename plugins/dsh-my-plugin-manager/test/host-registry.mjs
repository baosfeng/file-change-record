/**
 * dsh-my-plugin-manager — registry.js unit tests (global fetch stubbed).
 */
import { test, afterAll, vi } from 'vitest'
import assert from 'node:assert/strict'

// ── stub global.fetch ──────────────────────────────────────────────────────
const fetchLog = []
vi.stubGlobal('fetch', (url, options) => {
  fetchLog.push({ url: String(url), options })
  const next = responses.shift()
  if (next instanceof Error) return Promise.reject(next)
  return Promise.resolve({
    ok: next?.ok ?? true,
    status: next?.status ?? 200,
    json: async () => next?.body ?? {},
  })
})

const responses = []

const { searchNpmPlugins, latestVersionOf } = await import('../lib/registry.js')

test('searchNpmPlugins maps the npm search payload', async () => {
  responses.push({
    ok: true,
    body: {
      objects: [
        { package: { name: 'dsh-a', version: '1.0.0', description: 'desc a', author: { name: 'alice' }, date: '2026-01-01', links: { homepage: 'https://a', repository: 'https://r' } } },
        { package: { name: 'dsh-b', version: '0.2.0', description: 'desc b', author: 'bob', date: '', links: {} } },
        { package: {} },
      ],
    },
  })
  const results = await searchNpmPlugins('dsh', 30)
  assert.equal(results.length, 2, 'empty-name entries filtered')
  assert.deepEqual(results[0], {
    name: 'dsh-a',
    version: '1.0.0',
    description: 'desc a',
    author: 'alice',
    date: '2026-01-01',
    homepage: 'https://a',
    repository: 'https://r',
  })
  assert.equal(results[1].author, 'bob')
  assert.ok(fetchLog[0].url.includes('text=dsh'))
})

test('searchNpmPlugins propagates non-ok responses as errors', async () => {
  responses.push({ ok: false, status: 503 })
  await assert.rejects(() => searchNpmPlugins('dsh'), /503/)
})

test('latestVersionOf returns the version or empty on failure', async () => {
  responses.push({ ok: true, body: { version: '9.9.9' } })
  assert.equal(await latestVersionOf('dsh-x'), '9.9.9')
  responses.push({ ok: false, status: 404 })
  assert.equal(await latestVersionOf('ghost'), '')
  responses.push(new Error('network down'))
  assert.equal(await latestVersionOf('ghost'), '')
})

afterAll(() => {
  vi.unstubAllGlobals()
})
