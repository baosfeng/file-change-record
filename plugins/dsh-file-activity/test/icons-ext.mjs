import { test } from 'vitest'
/**
 * Unit tests for fileIconByExt — the per-extension file icon dispatcher in
 * lib/parts/icons.part.js (issue #24).
 *
 * The parts are plain text spliced into the client bundle factory scope, so
 * this suite evals the part source in a tiny stub scope and asserts on the
 * produced element trees: known extensions must yield a brand-colored badge
 * (rect fill = brand color), unknown / extension-less names must fall back to
 * the neutral stroke file icon (no fill rect).
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'

/** Stub createElement mirroring React's single-child / array-child semantics. */
function createElement(type, props, ...children) {
  const p = props ? { ...props } : {}
  if (children.length === 1) p.children = children[0]
  else if (children.length > 1) p.children = children
  return { type, props: p }
}

/** Eval the icons part source in a factory scope and return its internals. */
function loadIcons() {
  const src = fs.readFileSync(new URL('../lib/parts/icons.part.js', import.meta.url), 'utf8')
  const factory = new Function('createElement', `${src}\nreturn { icon, fileIconByExt }`)
  return factory(createElement)
}

const { fileIconByExt } = loadIcons()

/** The first <rect> inside a badge svg, or null for the fallback file icon. */
function badgeFill(svg) {
  assert.equal(svg.type, 'svg', 'file icon is an <svg> element')
  const children = Array.isArray(svg.props.children) ? svg.props.children : [svg.props.children]
  const rect = children.find((c) => c && c.type === 'rect')
  return rect ? rect.props.fill : null
}

// ── known extensions → branded badge with the brand fill ───────────────────
const BRAND_FILLS = {
  // JS / TS
  js: '#F7DF1E',
  mjs: '#F7DF1E',
  cjs: '#F7DF1E',
  ts: '#3178C6',
  mts: '#3178C6',
  cts: '#3178C6',
  tsx: '#3178C6',
  jsx: '#3178C6',
  // 后端语言
  java: '#007396',
  c: '#A8B9CC',
  cpp: '#00599C',
  cxx: '#00599C',
  cc: '#00599C',
  hpp: '#00599C',
  h: '#A8B9CC',
  hh: '#A8B9CC',
  cs: '#68217A',
  csharp: '#68217A',
  go: '#00ADD8',
  rs: '#CE422B',
  rb: '#B51624',
  php: '#777BB4',
  py: '#3776AB',
  swift: '#F05138',
  kt: '#7F52FF',
  kotlin: '#7F52FF',
  dart: '#0175C2',
  scala: '#DC322F',
  lua: '#2C2C7C',
  pl: '#0298C3',
  r: '#336DC3',
  m: '#C1272D',
  mm: '#C1272D',
  // Web / 前端
  html: '#E34F26',
  htm: '#E34F26',
  css: '#663399',
  scss: '#CD6799',
  sass: '#CD6799',
  vue: '#42B883',
  svelte: '#FF3E00',
  // 数据 / 结构化
  json: '#F7DF1E',
  sql: '#00758F',
  csv: '#2E7D32',
  db: '#0F62FE',
  sqlite: '#0F62FE',
  sqlite3: '#0F62FE',
  xml: '#FF6F00',
  svg: '#FF6F00',
  // 文档
  md: '#42A5F5',
  markdown: '#42A5F5',
  txt: '#90A4AE',
  text: '#90A4AE',
  log: '#90A4AE',
  pdf: '#E5202B',
  doc: '#2B579A',
  docx: '#2B579A',
  xls: '#217346',
  xlsx: '#217346',
  ppt: '#D24726',
  pptx: '#D24726',
  // 配置 / 构建
  yml: '#CB171E',
  yaml: '#CB171E',
  toml: '#8D6E63',
  ini: '#546E7A',
  cfg: '#546E7A',
  config: '#546E7A',
  env: '#F9A825',
  properties: '#7B1FA2',
  lock: '#37474F',
  dockerfile: '#2496ED',
  docker: '#2496ED',
  makefile: '#607D8B',
  gradle: '#02303A',
  cmake: '#265774',
  ipynb: '#F37726',
  // 脚本 / Shell
  sh: '#89E051',
  bash: '#89E051',
  zsh: '#89E051',
  ps1: '#012456',
  bat: '#546E7A',
  cmd: '#546E7A',
  // 打包 / 二进制
  zip: '#FFA726',
  tar: '#FFA726',
  gz: '#FFA726',
  '7z': '#FFA726',
  rar: '#FFA726',
  exe: '#0078D4',
  msi: '#0078D4',
  wasm: '#654FF0',
  // 图片 / 媒体
  png: '#8E44AD',
  jpg: '#8E44AD',
  jpeg: '#8E44AD',
  gif: '#8E44AD',
  webp: '#8E44AD',
  ico: '#8E44AD',
  bmp: '#8E44AD',
  // 版本控制
  gitignore: '#F05032',
  gitattributes: '#F05032',
}

test('known extensions resolve to their branded badge fill (issue #24)', () => {
  for (const [ext, fill] of Object.entries(BRAND_FILLS)) {
    assert.equal(badgeFill(fileIconByExt(ext)), fill, `ext "${ext}" → ${fill}`)
  }
})

test('extension lookup is case-insensitive and tolerates a leading dot', () => {
  assert.equal(badgeFill(fileIconByExt('JS')), badgeFill(fileIconByExt('js')))
  assert.equal(badgeFill(fileIconByExt('.MD')), badgeFill(fileIconByExt('md')))
  assert.equal(badgeFill(fileIconByExt('Py')), badgeFill(fileIconByExt('py')))
})

test('unknown extension falls back to the neutral file icon', () => {
  for (const ext of ['xyz', 'abc', 'unknownext', 'weird']) {
    const svg = fileIconByExt(ext)
    assert.equal(badgeFill(svg), null, `unknown ext "${ext}" must not badge`)
  }
})

test('missing / empty / dotted extension falls back to the neutral file icon', () => {
  for (const ext of ['', undefined, null, '.DS_Store', 'README', 'notes.']) {
    const svg = fileIconByExt(ext)
    assert.equal(badgeFill(svg), null, `ext "${ext}" must not badge`)
  }
})

test('fallback icon keeps the currentColor stroke style (theme-agnostic)', () => {
  const svg = fileIconByExt('xyz')
  assert.equal(svg.props.stroke, 'currentColor', 'fallback icon strokes with currentColor')
  assert.equal(svg.props.fill, 'none', 'fallback icon keeps outline style')
})

test('badge text uses brand contrast ink and is present for a sample', () => {
  const js = fileIconByExt('js')
  const text = Array.isArray(js.props.children) ? js.props.children.find((c) => c.type === 'text') : null
  assert.ok(text, 'js badge carries a text label')
  assert.equal(text.props.fill, '#323330', 'js label is dark-on-yellow')
  const md = fileIconByExt('md')
  const mdText = Array.isArray(md.props.children) ? md.props.children.find((c) => c.type === 'text') : null
  assert.equal(mdText.props.fill, '#ffffff', 'markdown label is white-on-blue')
})

test('badge icons are self-colored (fixed fill, no currentColor dependency)', () => {
  const svg = fileIconByExt('py')
  assert.notEqual(svg.props.fill, 'currentColor')
  const children = Array.isArray(svg.props.children) ? svg.props.children : [svg.props.children]
  const rect = children.find((c) => c.type === 'rect')
  assert.equal(rect.props.fill, '#3776AB')
})

/** The <text> mark inside a badge svg, or null for the fallback file icon. */
function badgeMark(svg) {
  const children = Array.isArray(svg.props.children) ? svg.props.children : [svg.props.children]
  const text = children.find((c) => c && c.type === 'text')
  return text ? { label: text.props.children, fontSize: text.props.fontSize, fill: text.props.fill } : null
}

test('new common-language groups carry their brand mark (issue #24)', () => {
  const expected = {
    java: 'JAVA',
    c: 'C',
    cpp: 'C++',
    cs: 'C#',
    go: 'GO',
    rs: 'RS',
    rb: 'RB',
    php: 'PHP',
    swift: 'SWIFT',
    kt: 'KT',
    dart: 'DART',
    scala: 'SCALA',
    sql: 'SQL',
    csv: 'CSV',
    db: 'DB',
    xml: 'XML',
    pdf: 'PDF',
    vue: 'VUE',
    zip: 'ZIP',
    exe: 'EXE',
    png: 'IMG',
    ps1: 'PS1',
    dockerfile: 'DOCK',
    ipynb: 'JNB',
  }
  for (const [ext, mark] of Object.entries(expected)) {
    const badge = badgeMark(fileIconByExt(ext))
    assert.ok(badge, `ext "${ext}" must carry a badge mark`)
    assert.equal(badge.label, mark, `ext "${ext}" mark should be "${mark}"`)
  }
})

test('badge mark font scales with mark length (issue #24)', () => {
  assert.equal(badgeMark(fileIconByExt('js')).fontSize, 9, '2-char mark uses 9px')
  assert.equal(badgeMark(fileIconByExt('java')).fontSize, 7, '4-char mark uses 7px')
  assert.equal(badgeMark(fileIconByExt('swift')).fontSize, 5.5, '5+ char mark uses 5.5px')
  assert.equal(badgeMark(fileIconByExt('scala')).fontSize, 5.5, '5-char mark uses 5.5px')
})
