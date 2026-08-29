import { test } from 'vitest'
/**
 * Unit tests for the sidebar tab selected-state styling in
 * lib/parts/styles.part.js.
 *
 * Issue #25 originally injected a brand-fill override for the selected tab
 * (`[class*="tab"][class*="tabActive"]` → `--dsw-alias-state-business-primary`,
 * light #4176e6 / dark #679efe) because the host's grey selected state was
 * considered too subtle. That colored the active sidebar tab blue, which the
 * user reported as unwanted in issue #60: the request is to keep the host's
 * original state. Per #60 we therefore REMOVE the override entirely and let the
 * host (dsh-better-sidebar) render its own `.tabActive` (interactive-bg-active
 * grey + label-primary ink).
 *
 * These tests lock in the #60 contract: the plugin must NOT inject any
 * `[class*="tab"][class*="tabActive"]` / `[class*="tabActive"]` rule that
 * restyles the host's selected tab, so a future regression (accidentally
 * re-adding the blue fill) fails here.
 *
 * The parts are plain text spliced into the client bundle factory scope, so
 * this suite evals the styles part source and asserts on the CSS text.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'

/** Eval the styles part source in a factory scope and return STYLES. */
function loadStyles() {
  const src = fs.readFileSync(new URL('../lib/parts/styles.part.js', import.meta.url), 'utf8')
  const factory = new Function(`${src}\nreturn { STYLES }`)
  return factory().STYLES
}

const STYLES = loadStyles()

/** STYLES with CSS comments stripped, so prose can't trip string asserts. */
const CSS = STYLES.replace(/\/\*[\s\S]*?\*\//g, '')

/** Escape a CSS selector fragment for use inside a RegExp. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Extract the declaration block for a selector, or null when absent. */
function ruleFor(css, selector) {
  const m = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`))
  return m ? m[1] : null
}

const ACTIVE = '[class*="tab"][class*="tabActive"]'
const ACTIVE_HOVER = '[class*="tab"][class*="tabActive"]:hover'

test('plugin must not inject any tabActive selected-state override (issue #60)', () => {
  // The double-attribute selector that (issue #25) colored the selected tab
  // blue must be gone: the host renders its own selected state now.
  const rule = ruleFor(CSS, ACTIVE)
  assert.equal(rule, null, 'no [class*="tab"][class*="tabActive"] rule allowed (issue #60 removed it)')
  assert.equal(ruleFor(CSS, ACTIVE_HOVER), null, 'no [class*="tab"][class*="tabActive"]:hover rule allowed')
})

test('plugin must not inject a bare single-attribute tabActive rule either (issue #60)', () => {
  const bare = CSS.match(/(^|[^\]])\[class\*="tabActive"\]\s*\{/)
  assert.equal(bare, null, 'no bare single-attribute tabActive rule allowed')
})

test('no tab-override rule may reference the brand fill (issue #60)', () => {
  // `--dsw-alias-state-business-primary` was the blue brand fill used by the
  // removed #25 override; any tab rule referencing it would re-introduce the bug.
  const tabRules = CSS.split('}').filter((chunk) => chunk.includes('tabActive'))
  for (const chunk of tabRules) {
    assert.ok(!chunk.includes('--dsw-alias-state-business-primary'), 'tab overrides must not use the brand fill')
  }
  assert.equal(tabRules.length, 0, 'no tab override chunks should exist')
})

test('tab overrides never reference the undefined --dsw-alias-accent variable (issue #25, belt & suspenders)', () => {
  // `--dsw-alias-accent` is not defined anywhere in the DSH theme token set
  // (verified against dsh-client-ui-theme / dsh-web-frontend assets), so a
  // var() reference to it resolves to an invalid value and silently inherits.
  const tabRules = CSS.split('}').filter((chunk) => chunk.includes('tabActive'))
  for (const chunk of tabRules) {
    assert.ok(!chunk.includes('--dsw-alias-accent'), 'tab overrides must use defined tokens only')
  }
})

test('tab overrides rely on the host, not on !important (issue #25/#60)', () => {
  const tabRules = CSS.split('}').filter((chunk) => chunk.includes('tabActive'))
  for (const chunk of tabRules) {
    assert.ok(!chunk.includes('!important'), 'no !important in tab overrides')
  }
})
