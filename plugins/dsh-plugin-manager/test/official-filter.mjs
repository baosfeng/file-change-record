/**
 * dsh-plugin-manager — isOfficialModule unit tests (issue #28).
 *
 * The installed list must only show user-installed plugins: official /
 * built-in namespaces (@deepseek-ai/*, the cordis core, @koishijs/*) are
 * filtered out, every other namespace is kept.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { isOfficialModule } from '../lib/api-route.js'

test('isOfficialModule flags official namespaces', () => {
  assert.equal(isOfficialModule('@deepseek-ai/dsh-base'), true, 'DSH official bundle plugin')
  assert.equal(isOfficialModule('@deepseek-ai/cordis-plugin-timer'), true, 'DSH official timer plugin')
  assert.equal(isOfficialModule('cordis:include'), true, 'cordis core loader entry')
  assert.equal(isOfficialModule('cordis'), true, 'bare cordis core')
  assert.equal(isOfficialModule('@koishijs/plugin-xxx'), true, 'cordis ecosystem official scope')
})

test('isOfficialModule keeps user namespaces', () => {
  assert.equal(isOfficialModule('dsh-a'), false, 'plain user package')
  assert.equal(isOfficialModule('@scope/dsh-b'), false, 'user scoped package')
  assert.equal(isOfficialModule('bsfeng-dsh-notify'), false, 'user personal namespace')
  assert.equal(isOfficialModule('@anionex/dsh-vision-toolkit'), false, 'third-party scoped package')
  assert.equal(isOfficialModule('dsh-think-zh-expand'), false, 'link-installed local plugin')
})

test('isOfficialModule boundary cases do not over-match', () => {
  assert.equal(isOfficialModule('@deepseek-ai'), false, 'bare scope without slash')
  assert.equal(isOfficialModule('@deepseek-ai-other/x'), false, 'similar scope is not official')
  assert.equal(isOfficialModule('cordis-helper'), false, 'cordis-prefixed user package is not the core')
  assert.equal(isOfficialModule(''), false, 'empty name')
})
