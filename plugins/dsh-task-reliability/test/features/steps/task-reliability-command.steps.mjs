/**
 * Step definitions for the /task slash command (issue #35) Gherkin acceptance
 * tests. Drives the registered command handler directly (mirroring how the
 * DSH command runtime invokes it), asserting sub-command outcomes and reuse
 * of existing store/API logic.
 *
 * World + helpers live in world.mjs (shared with the other steps files).
 */
import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

function taskCommand(world) {
  const def = world.commandDefs.find((d) => d.name === 'task')
  assert.ok(def, 'task command registered')
  return def
}

async function invoke(world, rawInput) {
  const def = taskCommand(world)
  world.lastCommandResult = await def.handler({
    commandId: 'cmd-1',
    agent: world.mainAgent,
    rawInput,
    attachments: [],
    signal: { aborted: false },
  })
}

// ── When ──────────────────────────────────────────────────────────────────
When('我执行 \\/task 命令 {string}', async function (rawInput) {
  await invoke(this, rawInput)
})

When('我回答待确认问题 {string}', async function (answer) {
  const qid = this.store.questions[0]?.id ?? 'q-missing'
  await invoke(this, `answer ${qid} ${answer}`)
})

// ── Then ──────────────────────────────────────────────────────────────────
Then('命令返回成功', function () {
  assert.equal(this.lastCommandResult.kind, 'success')
})

Then('命令返回失败', function () {
  assert.equal(this.lastCommandResult.kind, 'error')
})

Then('命令输出包含 {string}', function (text) {
  assert.ok(this.lastCommandResult.text.includes(text), `output should include: ${text}`)
})

Then('自主决策模式已开启', function () {
  assert.equal(this.store.mode.autopilot, true)
})

Then('自主决策模式已关闭', function () {
  assert.equal(this.store.mode.autopilot, false)
})

Then('问题 {string} 已被回答', function (question) {
  const q = this.store.questions.find((item) => item.question === question)
  assert.ok(q, 'question found')
  assert.ok(q.answer !== undefined, 'question answered')
})
