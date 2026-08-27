/**
 * Step definitions for dsh-my-notify Gherkin acceptance tests.
 * Boots the plugin against a mocked ctx per scenario, drives events + routes
 * through it, mirroring host-smoke.mjs: end/ask/approval notices, subagent
 * filtering, dedupe, config switches, remote trigger, token gate and SSE.
 *
 * World + helpers live in world.mjs (shared with notify-config.steps.mjs —
 * cucumber allows only one setWorldConstructor).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { mockResponse, mockRequest, topAgent } from './world.mjs'

// ── Given ─────────────────────────────────────────────────────────────────
Given('通知插件已启动', async function () {
  this.boot({})
})

Given('通知插件已启动且配置关闭了 end\\/ask\\/approval', async function () {
  this.boot({ end: false, ask: false, approval: false })
})

Given('通知插件已启动且开启了 subagentEnd', async function () {
  this.boot({ subagentEnd: true })
})

Given('通知插件已启动且配置了 apiToken', async function () {
  this.boot({ apiToken: 'secret-token' })
})

Given('有客户端订阅了实时通道', async function () {
  const res = mockResponse()
  await this.invoke(mockRequest({ url: '/notify/api/stream' }), res)
  this.clients.push(res)
})

// ── When ──────────────────────────────────────────────────────────────────
When('顶层代理 {string} 变为空闲', async function (id) {
  await this.dispatch('agent/status', { agent: topAgent(id), status: 'idle' })
})

When('子代理 {string} 变为空闲', async function (id) {
  await this.dispatch('agent/status', {
    agent: { id, session: { header: { origin: 'subagent' } } },
    status: 'idle',
  })
})

When('无标记子代理 {string} 变为空闲', async function (id) {
  await this.dispatch('agent/status', {
    agent: { id, options: { subagentDepth: 1 }, session: { header: { cwd: '/work/sub' } } },
    status: 'idle',
  })
})

When('顶层代理 {string} 连续空闲 2 次', async function (id) {
  await this.dispatch('agent/status', { agent: topAgent(id), status: 'idle' })
  await this.dispatch('agent/status', { agent: topAgent(id), status: 'idle' })
})

When('代理调用 ask_user_question 工具', async function () {
  this.nextCalled = false
  await this.dispatch('tools/pre-execute',
    { name: 'ask_user_question', agent: topAgent('ask1'), arguments: { questions: [{ header: '确认部署' }] } },
    async () => { this.nextCalled = true })
})

When('代理调用 bash 工具', async function () {
  this.nextCalled = false
  await this.dispatch('tools/pre-execute',
    { name: 'bash', agent: topAgent('b1') },
    async () => { this.nextCalled = true })
})

When('代理发起审批请求', async function () {
  this.nextCalled = false
  await this.dispatch('approval/request',
    { agent: topAgent('ap1'), toolName: 'bash', reason: 'sandbox escalation' },
    async () => { this.nextCalled = true })
})

When('本机 POST 触发接口携带标题 {string}', async function (title) {
  const res = mockResponse()
  await this.invoke(mockRequest({
    url: '/notify/api/trigger',
    method: 'POST',
    secFetchSite: 'same-origin',
    origin: 'http://127.0.0.1:3080',
    body: JSON.stringify({ title, body: '构建成功', sessionId: 'sess-9' }),
  }), res)
  this.lastResponse = { status: res.writeHeadStatus }
})

When('用错误 token 调用触发接口', async function () {
  const res = mockResponse()
  await this.invoke(mockRequest({
    url: '/notify/api/trigger',
    method: 'POST',
    token: 'wrong-token',
    body: '{}',
  }), res)
  this.lastResponse = { status: res.writeHeadStatus }
})

When('该客户端断开连接', async function () {
  for (const client of this.clients) client.emitClose()
})

// ── Then ──────────────────────────────────────────────────────────────────
Then('客户端收到一条通知', async function () {
  const count = this.noticesOf(this.clients[0]).length
  assert.ok(count >= 1, `client received a notice (got ${count})`)
})

Then('客户端收到一条 {string} 通知', async function (kind) {
  const frame = this.noticesOf(this.clients[0]).join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.kind, kind)
})

Then('通知类型为 {string}', async function (kind) {
  const frame = this.noticesOf(this.clients[0]).join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.kind, kind)
})

Then('通知携带会话标题', async function () {
  const frame = this.noticesOf(this.clients[0]).join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.ok(typeof notice.title === 'string' && notice.title !== '', 'title present')
})

Then('通知携带工具名', async function () {
  const frame = this.noticesOf(this.clients[0]).join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.ok(typeof notice.toolName === 'string' && notice.toolName !== '', 'toolName present')
})

Then('通知标题为 {string}', async function (title) {
  const frame = this.noticesOf(this.clients[0]).join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.title, title)
})

Then('通知标记为 {string}', async function (agentType) {
  const frame = this.noticesOf(this.clients[0]).join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.equal(notice.agentType, agentType)
})

Then('通知标题以 {string} 开头', async function (prefix) {
  const frame = this.noticesOf(this.clients[0]).join('')
  const notice = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
  assert.ok(notice.title.startsWith(prefix), `title starts with ${prefix}`)
})

Then('客户端未收到任何通知', async function () {
  assert.equal(this.noticesOf(this.clients[0]).length, 0)
})

Then('该客户端未收到任何通知', async function () {
  assert.equal(this.noticesOf(this.clients[0]).length, 0)
})

Then('客户端只收到 {int} 条通知', async function (count) {
  assert.equal(this.noticesOf(this.clients[0]).length, count)
})

Then('工具流程的 next\\(\\) 被调用', async function () {
  assert.equal(this.nextCalled, true)
})

Then('审批流程的 next\\(\\) 被调用', async function () {
  assert.equal(this.nextCalled, true)
})

Then('响应状态码为 {int}', async function (status) {
  assert.equal(this.lastResponse.status, status)
})
