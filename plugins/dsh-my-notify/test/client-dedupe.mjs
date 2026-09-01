/**
 * Client dedupe test for dsh-my-notify (issue #70 重复通知):
 * evals the i18n + render + stream parts in a stubbed factory scope and
 * asserts the client-side dedupe + cross-tab coordination:
 *  - same kind:sessionId within the window is handled once (local Map),
 *  - different keys are each handled,
 *  - two tabs sharing localStorage: only the first claims (cross-tab lock),
 *  - after the window expires the same key is handled again,
 *  - localStorage unavailable falls back to the local window.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import fs from 'node:fs'

/** Stub createElement mirroring React's single-child / array-child semantics. */
function createElement(type, props, ...children) {
  const p = props ? { ...props } : {}
  if (children.length === 1) p.children = children[0]
  else if (children.length > 1) p.children = children
  return { type, props: p }
}

/** In-memory localStorage stub; a single instance is shared across "tabs". */
function createStorageMock() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
}

/** Minimal AudioContext stub: records construction, no-op graph. */
function createAudioStub() {
  const instances = []
  function MockAudioContext() {
    instances.push(this)
    this.currentTime = 0
    this.destination = {}
    this.resume = () => Promise.resolve()
    this.createOscillator = () => ({
      type: '',
      frequency: { value: 0 },
      connect() {},
      start() {},
      stop() {},
    })
    this.createGain = () => ({
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    })
  }
  return { MockAudioContext, instances }
}

/** Notification stub: records constructed notifications. */
function createNotificationStub() {
  const created = []
  function MockNotification(title, options) {
    created.push({ title, options })
    this.close = () => {}
  }
  MockNotification.permission = 'granted'
  MockNotification.requestPermission = () => Promise.resolve('granted')
  return { MockNotification, created }
}

/** Eval the shared icons + i18n + render + stream parts in a factory scope
 *  and return handleNotice / claimNotice. Each call is one independent
 *  "tab" (own localRecent Map); pass the same storage to simulate tabs. */
function loadParts({ storage, audio, notification }) {
  const iconsSrc = fs.readFileSync(new URL('../../dsh-shared/client-parts/icons.part.js', import.meta.url), 'utf8')
  const i18nSrc = fs.readFileSync(new URL('../lib/parts/i18n.js', import.meta.url), 'utf8')
  const renderSrc = fs.readFileSync(new URL('../lib/parts/render.js', import.meta.url), 'utf8')
  const streamSrc = fs.readFileSync(new URL('../lib/parts/stream.js', import.meta.url), 'utf8')
  const windowMock = {
    localStorage: storage,
    AudioContext: audio.MockAudioContext,
    focus() {},
  }
  const factory = new Function(
    'createElement',
    'document',
    'navigator',
    'window',
    'Notification',
    'exports',
    `${iconsSrc}\n${i18nSrc}\n${renderSrc}\n${streamSrc}\nreturn { handleNotice, claimNotice }`,
  )
  return factory(createElement, undefined, { language: 'zh-CN' }, windowMock, notification.MockNotification, {})
}

/** One end notice frame (the shape server emits). */
function endNotice(sessionId) {
  return { type: 'notice', kind: 'end', sessionId, title: `标题-${sessionId}` }
}

test('同 kind:sessionId 窗口内只处理一次（本地去重）', () => {
  const storage = createStorageMock()
  const audio = createAudioStub()
  const notification = createNotificationStub()
  const parts = loadParts({ storage, audio, notification })
  parts.handleNotice(endNotice('s1'), undefined)
  parts.handleNotice(endNotice('s1'), undefined)
  assert.equal(notification.created.length, 1, 'first frame notifies')
  assert.equal(audio.instances.length, 1, 'first frame beeps once')
})

test('不同 kind:sessionId 各自处理（不去重）', () => {
  const storage = createStorageMock()
  const audio = createAudioStub()
  const notification = createNotificationStub()
  const parts = loadParts({ storage, audio, notification })
  parts.handleNotice(endNotice('s1'), undefined)
  parts.handleNotice(endNotice('s2'), undefined)
  parts.handleNotice({ type: 'notice', kind: 'ask', sessionId: 's1' }, undefined)
  assert.equal(notification.created.length, 3, 'distinct keys each notify')
})

test('多标签页共享 localStorage：同一通知只由一个标签页处理', () => {
  const storage = createStorageMock() // 两个「标签页」共享同一存储
  const audioA = createAudioStub()
  const notificationA = createNotificationStub()
  const partsA = loadParts({ storage, audio: audioA, notification: notificationA })
  const audioB = createAudioStub()
  const notificationB = createNotificationStub()
  const partsB = loadParts({ storage, audio: audioB, notification: notificationB })
  partsA.handleNotice(endNotice('s1'), undefined)
  partsB.handleNotice(endNotice('s1'), undefined)
  assert.equal(notificationA.created.length, 1, 'tab A notifies')
  assert.equal(notificationB.created.length, 0, 'tab B stays silent')
  assert.equal(audioB.instances.length, 0, 'tab B does not beep')
})

test('窗口过期后同一 key 重新处理', () => {
  let fakeNow = 1_000_000
  const origNow = Date.now
  Date.now = () => fakeNow
  try {
    const storage = createStorageMock()
    const audio = createAudioStub()
    const notification = createNotificationStub()
    const parts = loadParts({ storage, audio, notification })
    parts.handleNotice(endNotice('s1'), undefined)
    fakeNow += 3000 // 超过 2000ms 客户端窗口
    parts.handleNotice(endNotice('s1'), undefined)
    assert.equal(notification.created.length, 2, 'after the window the same key notifies again')
  } finally {
    Date.now = origNow
  }
})

test('localStorage 不可用时本地窗口兜底', () => {
  const storage = {
    getItem() {
      throw new Error('blocked')
    },
    setItem() {
      throw new Error('blocked')
    },
  }
  const audio = createAudioStub()
  const notification = createNotificationStub()
  const parts = loadParts({ storage, audio, notification })
  parts.handleNotice(endNotice('s1'), undefined)
  parts.handleNotice(endNotice('s1'), undefined)
  assert.equal(notification.created.length, 1, 'local window still dedupes')
})
