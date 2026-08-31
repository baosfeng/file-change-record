import { test } from 'vitest'
/**
 * Settings-panel toggle style tests for dsh-task-reliability (issue #58).
 *
 * 问题背景：开关关闭态此前用 --dsw-alias-bg-layer-3（浅色主题下≈白色），
 * 与设置面板背景几乎融为一体、边框又淡，用户难以一眼判断开关状态
 * （issue #58）。修复：关态改灰色轨道（label-tertiary 30% 混合），开态
 * 圆点改对比墨色（label-primary-foreground），开启色保持 info-primary
 * 语义（与 dsh-my-notify / dsh-my-skill-manager 方案一致）。
 *
 * 本套件为防复发测试：断言 toggle 样式规则**必须**是灰色轨道 + 对比圆点
 * 方案，且不得回退为 bg-layer-3 白底。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'

/** Extract the STYLES template string from the client bundle source. */
function loadStyles() {
  const src = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const m = src.match(/const STYLES = `([\s\S]*?)`\n/)
  assert.ok(m, 'STYLES template string must exist in client.js')
  return m[1]
}

/** STYLES with CSS comments stripped, so prose can't trip string asserts. */
const CSS = loadStyles().replace(/\/\*[\s\S]*?\*\//g, '')

const TOGGLE = '.dtr-toggle{'
const TOGGLE_ON = '.dtr-toggle[data-on="true"]{'
const TOGGLE_AFTER = '.dtr-toggle::after{'
const TOGGLE_ON_AFTER = '.dtr-toggle[data-on="true"]::after{'

function ruleBlock(selector) {
  const start = CSS.indexOf(selector)
  assert.ok(start !== -1, `rule must exist: ${selector}`)
  return CSS.slice(start, CSS.indexOf('}', start) + 1)
}

test('off-state toggle uses a visible grey track, not a white layer-3 fill (issue #58)', () => {
  const block = ruleBlock(TOGGLE)
  assert.ok(
    block.includes('color-mix(in srgb, var(--dsw-alias-label-tertiary) 30%, transparent)'),
    'off track must be the grey tertiary mix',
  )
  assert.ok(!block.includes('bg-layer-3'), 'off track must not fall back to the invisible white layer-3 fill')
})

test('on-state toggle keeps the info accent and clears the border (issue #58)', () => {
  const block = ruleBlock(TOGGLE_ON)
  assert.ok(block.includes('var(--dsw-alias-state-info-primary)'), 'on track must be the info accent (semantic)')
  assert.ok(block.includes('border-color:transparent'), 'on state clears the border')
})

test('thumb sits on the left in off state with primary ink (issue #58)', () => {
  const block = ruleBlock(TOGGLE_AFTER)
  assert.ok(block.includes('var(--dsw-alias-label-primary)'), 'off thumb must use primary ink on the grey track')
  assert.ok(!block.includes('translateX'), 'off thumb must not be translated')
})

test('on-state thumb slides right and switches to contrast ink (issue #58)', () => {
  const block = ruleBlock(TOGGLE_ON_AFTER)
  assert.ok(block.includes('translateX(12px)'), 'on thumb must slide right 12px')
  assert.ok(
    block.includes('var(--dsw-alias-label-primary-foreground)'),
    'on thumb must use foreground ink for contrast on the accent fill',
  )
})
