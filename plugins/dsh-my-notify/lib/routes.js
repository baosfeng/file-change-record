/**
 * dsh-my-notify — /notify/api 路由（SSE 长连接 + 远程 hook + 信息查询）。
 *
 * 所有请求先做 loopback 信任围栏（与 /api 网关一致的契约）；stream 为
 * EventSource 长连接（心跳保活，卸载清理），trigger 为远程 webhook（可选
 * apiToken 校验），info 返回当前触发开关。
 */
import { isTrustedApiRequest, header } from './fence.js'

/** 注册 /notify/api 路由与心跳清理（两个 effect，各自返回 disposer）。 */
export function registerNotifyRoutes(ctx, options, bus, onConfigChange) {
  const webRuntime = ctx.get ? ctx.get('webRuntime') : undefined
  const trustedHosts =
    webRuntime !== undefined && webRuntime !== null && Array.isArray(webRuntime.trustedHosts)
      ? webRuntime.trustedHosts
      : []
  const fence = (request) => isTrustedApiRequest(request, trustedHosts)

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: '/notify/api',
        handler: apiHandler(fence, options, bus, onConfigChange),
      }),
    'dsh-my-notify: /notify/api routes',
  )

  // 卸载时清理心跳（客户端集合随各 response close 自动清空）。
  ctx.effect(() => bus.stopHeartbeat, 'dsh-my-notify: heartbeat teardown')
}

// ── 路由分派 ─────────────────────────────────────────────────────────────

/** 构造 /notify/api 统一 handler：fence → 方法分派 → 404/错误兜底。 */
function apiHandler(fence, options, bus, onConfigChange) {
  return async (request, response) => {
    if (!fence(request)) {
      writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      return
    }
    // URL 解析与 fence 同层（畸形 url 异常向上传播，与 /api 网关一致）
    const url = new URL(request.url ?? '/', 'http://dsh.internal')
    const pathname = url.pathname
    const method = pathname.startsWith('/notify/api/') ? pathname.slice('/notify/api/'.length) : undefined
    try {
      const handled = await dispatchMethod(method, request, response, options, bus, onConfigChange)
      if (!handled) {
        writeJson(response, 404, {
          ok: false,
          error: { message: 'unknown dsh-my-notify API method' },
        })
      }
    } catch (error) {
      writeError(response, error)
    }
  }
}

// ── 各路由 handler ──────────────────────────────────────────────────────

/** 方法 + 请求动词匹配（降低 dispatchMethod 分支复杂度）。 */
function isMethod(method, request, name, verb) {
  return method === name && request.method === verb
}

/** 按 method 分派到具体 handler；未识别返回 false（调用方回 404）。 */
async function dispatchMethod(method, request, response, options, bus, onConfigChange) {
  if (isMethod(method, request, 'stream', 'GET')) {
    handleStream(response, bus)
    return true
  }
  if (isMethod(method, request, 'trigger', 'POST')) {
    await handleTrigger(request, response, options, bus)
    return true
  }
  if (isMethod(method, request, 'info', 'GET')) {
    writeJson(response, 200, { ok: true, value: infoValue(options) })
    return true
  }
  if (isMethod(method, request, 'config', 'GET')) {
    writeJson(response, 200, { ok: true, value: configValue(options) })
    return true
  }
  if (isMethod(method, request, 'config', 'PUT')) {
    await handleConfigPut(request, response, onConfigChange)
    return true
  }
  return false
}

/** SSE 长连接：EventSource 消费；断开清理订阅集合；首次订阅启动心跳。 */
function handleStream(response, bus) {
  response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  response.write('retry: 3000\n\n')
  const client = { response }
  bus.clients.add(client)
  const onClose = () => {
    bus.clients.delete(client)
    response.removeListener?.('close', onClose)
  }
  response.on('close', onClose)
  bus.startHeartbeat()
}

/** 远程 hook：任意进程/webhook 触发通知（apiToken 校验 + JSON body）。 */
async function handleTrigger(request, response, options, bus) {
  const token = header(request.headers, 'x-notify-token')
  if (options.apiToken !== '' && token !== options.apiToken) {
    writeJson(response, 403, {
      ok: false,
      error: { code: 'forbidden', message: 'invalid x-notify-token' },
    })
    return
  }
  const payload = await readJsonBody(request)
  bus.emitNotice({
    kind: 'remote',
    sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : '',
    title: typeof payload.title === 'string' ? payload.title : '',
    note: typeof payload.body === 'string' ? payload.body : '',
  })
  writeJson(response, 200, { ok: true })
}

/** 信息查询：当前触发开关（apiToken 只暴露是否启用，绝不暴露值）。 */
function infoValue(options) {
  return {
    end: options.end,
    ask: options.ask,
    approval: options.approval,
    subagentEnd: options.subagentEnd,
    remoteEnabled: true,
    apiToken: options.apiToken !== '',
    dedupeMs: options.dedupeMs,
  }
}

/** 配置查询：当前生效配置（设置页表单回填；apiToken 为明文，仅本机可读）。 */
function configValue(options) {
  return {
    end: options.end,
    ask: options.ask,
    approval: options.approval,
    subagentEnd: options.subagentEnd,
    apiToken: options.apiToken,
    dedupeMs: options.dedupeMs,
  }
}

/** 校验并规整配置 payload（部分字段合法，缺失字段不校验）；非法输入返回 undefined。 */
function normalizeConfig(payload) {
  if (payload === null || typeof payload !== 'object') return undefined
  const result = {}
  for (const key of ['end', 'ask', 'approval', 'subagentEnd']) {
    if (payload[key] === undefined) continue
    if (typeof payload[key] !== 'boolean') return undefined
    result[key] = payload[key]
  }
  if (payload.apiToken !== undefined) {
    if (typeof payload.apiToken !== 'string') return undefined
    result.apiToken = payload.apiToken
  }
  if (payload.dedupeMs !== undefined) {
    if (!Number.isFinite(payload.dedupeMs)) return undefined
    result.dedupeMs = payload.dedupeMs
  }
  return result
}

/** 保存配置：校验 → 持久化 + 更新内存 + 重载监听器（onConfigChange）。 */
async function handleConfigPut(request, response, onConfigChange) {
  const payload = await readJsonBody(request)
  const next = normalizeConfig(payload)
  if (next === undefined) {
    writeJson(response, 400, { ok: false, error: { message: 'invalid config' } })
    return
  }
  await onConfigChange(next)
  writeJson(response, 200, { ok: true })
}

// ── HTTP helpers（与仓库其它插件的路由写法一致）─────────────────────────

/** Read a JSON request body (bounded). */
async function readJsonBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) throw new Error('request body too large')
  }
  if (body === '') return {}
  return JSON.parse(body)
}

function writeJson(response, status, value) {
  const payload = JSON.stringify(value)
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-cache' })
  response.end(payload)
}

function writeError(response, error) {
  const message = error instanceof Error ? error.message : String(error)
  writeJson(response, 400, { ok: false, error: { message } })
}
