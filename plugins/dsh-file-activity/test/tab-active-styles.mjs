import { test } from 'vitest'
/**
 * Unit tests for the sidebar tab selected-state style overrides in
 * lib/parts/styles.part.js (issue #25).
 *
 * The host (dsh-better-sidebar) renders tabs with CSS-modules hashed class
 * names (e.g. `tabActive_xxxxx`) and no data attributes, so the plugin can
 * only target them with `[class*="..."]` substring selectors. The host's own
 * `.tabActive` (0,1,0) and `.tab:hover` (0,2,0) rules must be beaten by
 * specificity, not by load order: the plugin stylesheet is injected after the
 * host's, but relying on that alone is fragile. The overrides therefore use
 * the double-attribute selector `[class*="tab"][class*="tabActive"]` (0,2,0)
 * and its `:hover` variant (0,3,0), and must keep working if the host ever
 * renames its classes (substring match is the fallback contract).
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

test('selected-tab override targets the hashed class via double substring selector (issue #25)', () => {
  assert.ok(CSS.includes(ACTIVE), 'STYLES must contain the double-attribute tabActive selector')
  // The double attribute selector (0,2,0) beats the host `.tabActive` (0,1,0)
  // by specificity alone; a bare `[class*="tabActive"]` (0,1,0) would tie with
  // the host rule and depend on injection order — lock the design in.
  const bare = CSS.match(/(^|[^\]])\[class\*="tabActive"\]\s*\{/)
  assert.equal(bare, null, 'no bare single-attribute tabActive rule allowed')
})

test('selected tab gets the theme-aware brand fill (issue #25)', () => {
  const block = ruleFor(STYLES, ACTIVE)
  assert.ok(block, 'selected-tab rule must exist')
  assert.match(block, /background:\s*var\(--dsw-alias-state-business-primary\)/, 'selected fill must be the brand business primary (light #4176e6 / dark #679efe)')
})

test('selected tab text uses the brand-contrast ink (issue #25)', () => {
  const block = ruleFor(STYLES, ACTIVE)
  assert.ok(block, 'selected-tab rule must exist')
  assert.match(block, /color:\s*var\(--dsw-alias-label-primary-foreground\)/, 'selected text must be the foreground-on-brand ink (light #fff / dark #0f1115)')
})

test('selected tab keeps its brand fill on hover, beating the host .tab:hover (issue #25)', () => {
  const block = ruleFor(STYLES, ACTIVE_HOVER)
  assert.ok(block, 'selected-tab :hover rule must exist')
  assert.match(block, /background:\s*var\(--dsw-alias-state-business-primary\)/, 'hover must not fall back to the host grey fill')
  assert.match(block, /color:\s*var\(--dsw-alias-label-primary-foreground\)/, 'hover must keep the contrast ink readable')
})

test('selected-tab close button stays readable on the brand fill (issue #25)', () => {
  const block = ruleFor(STYLES, `${ACTIVE} [class*="tabClose"]`)
  assert.ok(block, 'selected-tab close button must be overridden')
  assert.match(block, /color:\s*var\(--dsw-alias-label-primary-foreground\)/, 'close icon must use the contrast ink on the brand fill')
})

test('tab overrides never reference the undefined --dsw-alias-accent variable (issue #25)', () => {
  // `--dsw-alias-accent` is not defined anywhere in the DSH theme token set
  // (verified against dsh-client-ui-theme / dsh-web-frontend assets), so a
  // var() reference to it resolves to an invalid value and silently inherits.
  const tabRules = CSS.split('}').filter((chunk) => chunk.includes('tabActive'))
  for (const chunk of tabRules) {
    assert.ok(!chunk.includes('--dsw-alias-accent'), 'tab overrides must use defined tokens only')
  }
})

test('tab overrides rely on specificity, not !important (issue #25)', () => {
  const tabRules = CSS.split('}').filter((chunk) => chunk.includes('tabActive'))
  for (const chunk of tabRules) {
    assert.ok(!chunk.includes('!important'), 'no !important in tab overrides')
  }
})
