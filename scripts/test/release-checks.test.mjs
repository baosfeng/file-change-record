/**
 * release-checks.test.mjs — 发版校验纯函数单元测试（issue #39 跨插件依赖校验）。
 *
 * 覆盖：extractDshRequires / findUndeclaredPeers / rangeMin / versionGte /
 * findUnpublishedDeps / collectClientSources / buildPluginIndex / findFreePort。
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  extractDshRequires,
  findUndeclaredPeers,
  rangeMin,
  versionGte,
  findUnpublishedDeps,
  collectClientSources,
  buildPluginIndex,
  findFreePort,
} from '../lib/release-checks.mjs'

// ── extractDshRequires ────────────────────────────────────────────────────
describe('extractDshRequires', () => {
  it('提取单引号 require 的 dsh-* 包', () => {
    expect(extractDshRequires("const M = require('dsh-md-render').MarkdownView")).toEqual(['dsh-md-render'])
  })

  it('提取双引号 require 的 dsh-* 包', () => {
    expect(extractDshRequires('const M = require("dsh-md-render")')).toEqual(['dsh-md-render'])
  })

  it('提取 import from 的 dsh-* 包', () => {
    expect(extractDshRequires("import M from 'dsh-md-render'")).toEqual(['dsh-md-render'])
  })

  it('子路径归为包名', () => {
    expect(extractDshRequires("require('dsh-md-render/lib/x')")).toEqual(['dsh-md-render'])
  })

  it('去重并排序', () => {
    const src = "require('dsh-b'); require('dsh-a'); require('dsh-b')"
    expect(extractDshRequires(src)).toEqual(['dsh-a', 'dsh-b'])
  })

  it('忽略非 dsh- 前缀与 scoped 官方包', () => {
    const src = "require('react'); require('@deepseek-ai/dsh-client-runtime'); require('lodash')"
    expect(extractDshRequires(src)).toEqual([])
  })

  it('空文本返回空数组', () => {
    expect(extractDshRequires('')).toEqual([])
  })
})

// ── findUndeclaredPeers ───────────────────────────────────────────────────
describe('findUndeclaredPeers', () => {
  it('全部声明 → 空', () => {
    expect(findUndeclaredPeers(['dsh-md-render'], { 'dsh-md-render': '^0.1.1' })).toEqual([])
  })

  it('部分未声明 → 返回未声明列表', () => {
    expect(findUndeclaredPeers(['dsh-a', 'dsh-b'], { 'dsh-a': '^0.1.0' })).toEqual(['dsh-b'])
  })

  it('全部未声明 → 返回全部', () => {
    expect(findUndeclaredPeers(['dsh-a'], {})).toEqual(['dsh-a'])
  })
})

// ── rangeMin ───────────────────────────────────────────────────────────────
describe('rangeMin', () => {
  it.each([
    ['^0.1.1', '0.1.1'],
    ['~0.1.1', '0.1.1'],
    ['>=0.1.1', '0.1.1'],
    ['0.1.1', '0.1.1'],
    ['^0.1.1-rc.1', '0.1.1'],
  ])('范围 %s → %s', (range, expected) => {
    expect(rangeMin(range)).toBe(expected)
  })

  it('无版本号 → null', () => {
    expect(rangeMin('*')).toBeNull()
    expect(rangeMin('')).toBeNull()
  })
})

// ── versionGte ────────────────────────────────────────────────────────────
describe('versionGte', () => {
  it.each([
    ['0.1.1', '0.1.1', true],
    ['0.1.2', '0.1.1', true],
    ['1.0.0', '0.9.9', true],
    ['0.1.0', '0.1.1', false],
    ['0.1.1', '0.1', true], // 缺位按 0
  ])('%s >= %s → %s', (a, b, expected) => {
    expect(versionGte(a, b)).toBe(expected)
  })
})

// ── findUnpublishedDeps ───────────────────────────────────────────────────
describe('findUnpublishedDeps', () => {
  const pluginIndex = new Map([
    ['dsh-md-render', { dir: 'dsh-md-render', version: '0.1.1' }],
    ['dsh-other', { dir: 'dsh-other', version: '0.2.0' }],
  ])
  const published = () => true
  const tagged = () => true

  it('依赖已发布且已打 tag → 空', () => {
    expect(findUnpublishedDeps({ 'dsh-md-render': '^0.1.1' }, pluginIndex, published, tagged)).toEqual([])
  })

  it('依赖未发布 → 报错（含依赖先发版提示）', () => {
    const problems = findUnpublishedDeps({ 'dsh-md-render': '^0.1.1' }, pluginIndex, () => false, tagged)
    expect(problems).toHaveLength(1)
    expect(problems[0].dep).toBe('dsh-md-render')
    expect(problems[0].reason).toContain('未发布')
  })

  it('依赖已发布但未打 tag → 报错（发布顺序校验）', () => {
    const problems = findUnpublishedDeps({ 'dsh-md-render': '^0.1.1' }, pluginIndex, published, () => false)
    expect(problems).toHaveLength(1)
    expect(problems[0].reason).toContain('未打 tag')
  })

  it('非仓库内依赖（官方包）→ 跳过不校验', () => {
    const peers = { '@deepseek-ai/dsh-session-title': '^0.1.1', 'dsh-better-sidebar': '^0.14.0' }
    expect(findUnpublishedDeps(peers, pluginIndex, published, tagged)).toEqual([])
  })

  it('多个问题全部返回', () => {
    const peers = { 'dsh-md-render': '^0.1.1', 'dsh-other': '^0.2.0' }
    const problems = findUnpublishedDeps(peers, pluginIndex, () => false, tagged)
    expect(problems).toHaveLength(2)
  })
})

// ── collectClientSources ──────────────────────────────────────────────────
describe('collectClientSources', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'relchk-'))
  afterAll(() => rmSync(tmp, { recursive: true, force: true }))

  it('client.src.js 优先（含 lib/parts/*.js）', () => {
    const dir = join(tmp, 'p1')
    mkdirSync(join(dir, 'lib', 'parts'), { recursive: true })
    writeFileSync(join(dir, 'lib', 'client.src.js'), '')
    writeFileSync(join(dir, 'lib', 'client.js'), '')
    writeFileSync(join(dir, 'lib', 'parts', 'a.part.js'), '')
    writeFileSync(join(dir, 'lib', 'parts', 'b.part.js'), '')
    const files = collectClientSources(dir)
    expect(files).toContain(join(dir, 'lib', 'client.src.js'))
    expect(files).not.toContain(join(dir, 'lib', 'client.js'))
    expect(files).toHaveLength(3)
  })

  it('仅 client.src.js（无 client.js）也正确', () => {
    const dir = join(tmp, 'p1b')
    mkdirSync(join(dir, 'lib'), { recursive: true })
    writeFileSync(join(dir, 'lib', 'client.src.js'), '')
    expect(collectClientSources(dir)).toEqual([join(dir, 'lib', 'client.src.js')])
  })

  it('parts 目录忽略非 .js 文件', () => {
    const dir = join(tmp, 'p1c')
    mkdirSync(join(dir, 'lib', 'parts'), { recursive: true })
    writeFileSync(join(dir, 'lib', 'client.src.js'), '')
    writeFileSync(join(dir, 'lib', 'parts', 'a.part.js'), '')
    writeFileSync(join(dir, 'lib', 'parts', 'notes.txt'), '')
    expect(collectClientSources(dir)).toEqual([join(dir, 'lib', 'client.src.js'), join(dir, 'lib', 'parts', 'a.part.js')])
  })

  it('无 client.src.js 时回退 client.js', () => {
    const dir = join(tmp, 'p2')
    mkdirSync(join(dir, 'lib'), { recursive: true })
    writeFileSync(join(dir, 'lib', 'client.js'), '')
    expect(collectClientSources(dir)).toEqual([join(dir, 'lib', 'client.js')])
  })

  it('无 client 文件 → 空数组', () => {
    const dir = join(tmp, 'p3')
    mkdirSync(join(dir, 'lib'), { recursive: true })
    expect(collectClientSources(dir)).toEqual([])
  })
})

// ── buildPluginIndex ──────────────────────────────────────────────────────
describe('buildPluginIndex', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'relidx-'))
  afterAll(() => rmSync(tmp, { recursive: true, force: true }))

  it('按 package.json name 建索引（目录名 ≠ 包名也正确）', () => {
    mkdirSync(join(tmp, 'plugins', 'dir-a'), { recursive: true })
    mkdirSync(join(tmp, 'plugins', 'dir-b'), { recursive: true })
    mkdirSync(join(tmp, 'plugins', 'dir-c'), { recursive: true })
    writeFileSync(join(tmp, 'plugins', 'dir-a', 'package.json'), JSON.stringify({ name: 'dsh-a', version: '1.2.3' }))
    writeFileSync(join(tmp, 'plugins', 'dir-b', 'package.json'), JSON.stringify({ name: 'dsh-b', version: '0.1.0' }))
    writeFileSync(join(tmp, 'plugins', 'dir-c', 'package.json'), JSON.stringify({ name: 'dsh-c', version: '0.0.1' }))
    const index = buildPluginIndex(tmp)
    expect(index.get('dsh-a')).toEqual({ dir: 'dir-a', version: '1.2.3' })
    expect(index.get('dsh-b')).toEqual({ dir: 'dir-b', version: '0.1.0' })
    expect(index.get('dsh-c')).toEqual({ dir: 'dir-c', version: '0.0.1' })
    expect(index.size).toBe(3)
  })

  it('无 package.json 的目录跳过', () => {
    const dir = join(tmp, 'plugins', 'no-pkg')
    mkdirSync(dir, { recursive: true })
    expect(buildPluginIndex(tmp).has('no-pkg')).toBe(false)
  })
})

// ── findFreePort ──────────────────────────────────────────────────────────
describe('findFreePort', () => {
  it('返回的端口可再次监听（空闲）', async () => {
    const port = await findFreePort(3087)
    expect(port).toBeGreaterThanOrEqual(3087)
    const { createServer } = await import('node:net')
    await new Promise((resolve, reject) => {
      const server = createServer()
      server.once('error', reject)
      server.listen(port, () => server.close(resolve))
    })
  })
})
