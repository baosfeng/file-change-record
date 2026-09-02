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

const { searchNpmPlugins, latestVersionOf, fetchPackageDetail } = await import('../lib/registry.js')

test('searchNpmPlugins maps the npm search payload', async () => {
  responses.push({
    ok: true,
    body: {
      objects: [
        {
          package: {
            name: 'dsh-a',
            version: '1.0.0',
            description: 'desc a',
            author: { name: 'alice' },
            date: '2026-01-01',
            links: { homepage: 'https://a', repository: 'https://r' },
          },
        },
        {
          package: {
            name: 'dsh-b',
            version: '0.2.0',
            description: 'desc b',
            author: 'bob',
            date: '',
            links: {},
          },
        },
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

// ── issue #90: fetchPackageDetail (packument → README/versions/deps) ───────
function packumentOf() {
  return {
    name: 'dsh-x',
    description: 'a plugin',
    homepage: 'https://foo',
    author: { name: 'alice' },
    'dist-tags': { latest: '2.0.0' },
    readme: '# hi\n\nbody',
    time: {
      created: '2026-01-01T00:00:00.000Z',
      modified: '2026-02-01T00:00:00.000Z',
      '1.0.0': '2026-01-01',
      '2.0.0': '2026-02-01',
    },
    versions: {
      '1.0.0': {
        version: '1.0.0',
        dependencies: { a: '^1.0.0' },
        peerDependencies: { react: '^18' },
        license: 'MIT',
        repository: { type: 'git', url: 'git+https://github.com/x/y.git' },
      },
      '2.0.0': {
        version: '2.0.0',
        dependencies: { a: '^2.0.0' },
        peerDependencies: { react: '^18', 'dsh-shared': '^0.1.0' },
        license: 'Apache-2.0',
        repository: { type: 'git', url: 'git+https://github.com/x/y.git' },
        homepage: 'https://repo',
      },
    },
  }
}

test('fetchPackageDetail maps the packument into a detail (latest)', async () => {
  responses.push({ ok: true, body: packumentOf() })
  responses.push({ ok: true, body: { downloads: 1234 } })
  const detail = await fetchPackageDetail('dsh-x')
  assert.equal(detail.name, 'dsh-x')
  assert.equal(detail.version, '2.0.0')
  assert.equal(detail.latest, '2.0.0')
  assert.equal(detail.readme, '# hi\n\nbody')
  assert.equal(detail.downloads, 1234)
  assert.deepEqual(detail.versions, [
    { version: '1.0.0', date: '2026-01-01' },
    { version: '2.0.0', date: '2026-02-01' },
  ])
  assert.deepEqual(detail.dependencies, [{ name: 'a', spec: '^2.0.0' }])
  assert.deepEqual(detail.peerDependencies, [
    { name: 'react', spec: '^18', missing: false },
    { name: 'dsh-shared', spec: '^0.1.0', missing: true },
  ])
  assert.equal(detail.author, 'alice')
  assert.equal(detail.license, 'Apache-2.0')
  assert.equal(detail.homepage, 'https://repo')
  assert.equal(detail.repository, 'https://github.com/x/y')
})

test('fetchPackageDetail surfaces a specific version and normalizes links', async () => {
  responses.push({ ok: true, body: packumentOf() })
  responses.push({ ok: true, body: { downloads: 7 } })
  const detail = await fetchPackageDetail('dsh-x', '1.0.0')
  assert.equal(detail.version, '1.0.0')
  assert.deepEqual(detail.dependencies, [{ name: 'a', spec: '^1.0.0' }])
  assert.deepEqual(detail.peerDependencies, [{ name: 'react', spec: '^18', missing: false }])
  assert.equal(detail.license, 'MIT')
})

test('fetchPackageDetail falls back to latest for an unknown version', async () => {
  responses.push({ ok: true, body: packumentOf() })
  responses.push({ ok: true, body: { downloads: 0 } })
  const detail = await fetchPackageDetail('dsh-x', '9.9.9')
  assert.equal(detail.version, '2.0.0')
})

test('fetchPackageDetail rejects a missing package with a friendly message', async () => {
  responses.push({ ok: false, status: 404 })
  await assert.rejects(() => fetchPackageDetail('ghost'), /未找到 npm 包/)
})

test('fetchPackageDetail rejects an empty name', async () => {
  await assert.rejects(() => fetchPackageDetail('   '), /name is required/)
})

test('fetchPackageDetail degrades download count on fetch failure', async () => {
  responses.push({ ok: true, body: packumentOf() })
  responses.push({ ok: false, status: 500 })
  const detail = await fetchPackageDetail('dsh-x')
  assert.equal(detail.downloads, 0)
})

test('fetchPackageDetail normalizes link forms and hides runtime peers', async () => {
  const pkg = {
    name: 'edge',
    description: '',
    author: 'zz',
    'dist-tags': { latest: '1.0.0' },
    readme: '',
    time: { modified: 'x', '1.0.0': '2026-01-01' },
    versions: {
      '1.0.0': {
        version: '1.0.0',
        license: { type: 'MIT' },
        repository: 'git://github.com/e/e.git',
        dependencies: null,
        peerDependencies: null,
      },
    },
  }
  responses.push({ ok: true, body: pkg })
  responses.push({ ok: true, body: { downloads: 3 } })
  const d = await fetchPackageDetail('edge', '1.0.0')
  assert.equal(d.repository, 'https://github.com/e/e', 'git:// normalized')
  assert.equal(d.license, 'MIT', 'object license .type used')
  assert.deepEqual(d.dependencies, [], 'null deps → empty')
  assert.deepEqual(d.peerDependencies, [], 'null peers → empty')
  assert.equal(d.author, 'zz')
})

test('fetchPackageDetail covers ssh/github/git@ links and runtime peers', async () => {
  const pkg = {
    name: 'edge',
    'dist-tags': { latest: '2.0.0' },
    readme: '',
    time: { '2.0.0': '2026-02-01' },
    versions: {
      '2.0.0': {
        version: '2.0.0',
        license: 'ISC',
        repository: 'ssh://git@github.com:a/b.git',
        dependencies: { 'dsh-y': '^2' },
        peerDependencies: { cordis: '^4', '@deepseek-ai/x': '^1', 'react-dom': '^18', 'dsh-y': '^2' },
      },
    },
  }
  responses.push({ ok: true, body: pkg })
  responses.push({ ok: true, body: { downloads: 'nan' } })
  const d = await fetchPackageDetail('edge')
  assert.equal(d.repository, 'https://github.com/a/b', 'ssh:// normalized')
  assert.equal(d.downloads, 0, 'non-finite downloads → 0')
  const peers = new Map(d.peerDependencies.map((p) => [p.name, p.missing]))
  assert.equal(peers.get('cordis'), false, 'cordis is runtime-provided')
  assert.equal(peers.get('@deepseek-ai/x'), false, 'scoped runtime module not missing')
  assert.equal(peers.get('react-dom'), false, 'react-dom runtime-provided')
  assert.equal(peers.get('dsh-y'), false, 'dep already declared → not missing')
})

test('fetchPackageDetail surfaces a generic message on a non-404 network error', async () => {
  responses.push(new Error('ECONNRESET'))
  await assert.rejects(() => fetchPackageDetail('edge'), /加载插件详情失败/)
})

afterAll(() => {
  vi.unstubAllGlobals()
})
