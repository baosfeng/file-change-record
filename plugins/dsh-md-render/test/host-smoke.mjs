/**
 * Smoke test for the dsh-md-render host half: mounts the plugin against a
 * mocked context and asserts the empty-shell contract (name + apply no-op).
 * The client half is browser-only (lib/client.js, __ModuleLoader__ format);
 * CI checks its syntax with `node --check`.
 *
 * NOTE: assertions live INSIDE test() (not at module top level) so Stryker's
 * vitest-runner correctly attributes mutant kills to this test file.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { name, apply } from '../lib/index.js'

test('host half exposes the plugin name and a no-op apply', async () => {
  assert.equal(name, 'dsh-md-render', 'plugin name')
  assert.equal(typeof apply, 'function', 'apply is a function')
  // apply must not throw against a bare ctx (client-only shell contract)
  apply({})
})

test('inject list is absent (client-only plugin has no host dependencies)', async () => {
  const mod = await import('../lib/index.js')
  assert.equal(mod.inject, undefined, 'no inject list for client-only shell')
})
