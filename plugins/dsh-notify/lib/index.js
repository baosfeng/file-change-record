/**
 * dsh-notify — host half.
 *
 * Watches DSH agent lifecycle events and broadcasts browser notices through a
 * Server-Sent Events (SSE) channel to every subscribed client tab:
 *
 *  - `agent/status` idle           → kind `end`      （本轮对话结束）
 *  - `tools/pre-execute` 命中 ask  → kind `ask`      （等待用户回答问题）
 *  - `approval/request`            → kind `approval`（等待用户批准）
 *
 * 所有约定均为「只读观察」：对 waterfall 事件（tools/pre-execute、
 * approval/request）只调用 next() 透传，绝不改变工具/审批流程。
 *
 * 远程 hook 扩展接口：`POST /notify/api/trigger` —— 任意本机进程（或经
 * 反向代理 + 配置 apiToken 的远程服务）可以推送自定义通知 `kind: remote`，
 * 与内建触发共用同一条 SSE 广播通道，后续扩展（cron、CI、其他插件）都走
 * 这里。
 *
 * 通道：
 *  - GET  /notify/api/stream  — SSE 长连接（EventSource 消费）
 *  - GET  /notify/api/info    — 当前触发开关（供客户端/调试）
 *  - POST /notify/api/trigger — 远程触发（webhook）
 *
 * 安全：所有请求先做 loopback 信任围栏（与 /api 网关一致的契约）；配置
 * `apiToken` 后 trigger 额外要求 `x-notify-token` 头，供远程主机调用。
 *
 * 注意：可选服务（webRuntime / sessionTitle）一律经 `ctx.get` 读取——未
 * 注入时对 Cordis Context 做属性访问不可靠。
 */

export const name = 'dsh-notify'

export const inject = ['webServer']

// ── Host-header trust fence (same behavioral contract as the /api gateway) ──
function isTrustedApiRequest(request, trustedHosts) {
  const host = header(request.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

function header(headers, name) {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function canonicalAuthority(entry, entryUrl) {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

function isTrustedAuthority(hostUrl, trustedHosts) {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
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

// ── 会话信息 helper ─────────────────────────────────────────────────────
/** 顶层会话判定：跳过子代理（subagent）会话，只提醒用户直接查看的会话。 */
function isTopLevelAgent(agent) {
  const header = agent?.session?.header
  if (header === undefined || header === null) return false
  if (header.origin === 'subagent') return false
  if (typeof header.delegationDepth === 'number' && header.delegationDepth > 0) return false
  return true
}

/** 会话标题：优先 sessionTitle 快照，回退 cwd 末段，再回退空串（由 client 显示短 id）。 */
function titleOf(ctx, agent) {
  try {
    const session = agent?.session
    // 可选服务必须经 ctx.get 读取（未注入时直接属性访问在 Cordis 上不可靠）
    const titleService = ctx.get ? ctx.get('sessionTitle') : undefined
    const snapshot = titleService?.get?.(session)
    if (snapshot !== undefined && snapshot !== null && typeof snapshot.title === 'string' && snapshot.title !== '') {
      return snapshot.title
    }
    const cwd = session?.header?.cwd
    if (typeof cwd === 'string' && cwd !== '') {
      const norm = cwd.replace(/\/+$/, '')
      const idx = norm.lastIndexOf('/')
      const name = idx === -1 ? norm : norm.slice(idx + 1)
      if (name !== '') return name
    }
  } catch {
    // title is best-effort; never let lookup break the notice path
  }
  return ''
}

/** ask 参数摘要：取第一个问题的 header/question 首行（尽力而为）。 */
function askNoteOf(argumentsValue) {
  try {
    const questions = argumentsValue?.questions
    if (!Array.isArray(questions) || questions.length === 0) return ''
    const first = questions[0]
    if (first === null || typeof first !== 'object') return ''
    if (typeof first.header === 'string' && first.header !== '') return first.header
    if (typeof first.question === 'string' && first.question !== '') {
      const line = first.question.split('\n')[0]
      return line.length > 80 ? `${line.slice(0, 80)}…` : line
    }
  } catch {
    // ignore
  }
  return ''
}

export function apply(ctx, config) {
  // ── 配置（应用层 config 覆盖，默认全部开启）─────────────────────────
  const options = {
    end: config?.end !== false,
    ask: config?.ask !== false,
    approval: config?.approval !== false,
    apiToken: typeof config?.apiToken === 'string' ? config.apiToken : '',
    dedupeMs: Number.isFinite(config?.dedupeMs) ? config.dedupeMs : 3000,
  }

  // ── SSE 客户端集合 ────────────────────────────────────────────────────
  const clients = new Set() // { response }

  /** 广播一条通知到所有已订阅客户端（逐条容忍失败，失败即摘除）。 */
  function broadcast(notice) {
    const payload = `data: ${JSON.stringify(notice)}\n\n`
    for (const client of [...clients]) {
      try {
        client.response.write(payload)
      } catch {
        clients.delete(client)
        try { client.response.destroy() } catch { /* ignore */ }
      }
    }
  }

  // ── 通知构造 + 同类去重窗口 ───────────────────────────────────────────
  const recent = new Map() // `${kind}:${sessionId ?? ''}` -> lastPushTime

  function emitNotice(notice) {
    const key = `${notice.kind}:${notice.sessionId ?? ''}`
    const now = Date.now()
    if (recent.has(key) && now - recent.get(key) < options.dedupeMs) return
    // 淘汰过期去重条目，避免 Map 无限增长
    if (recent.size > 128) {
      for (const [k, t] of recent) {
        if (now - t >= options.dedupeMs) recent.delete(k)
      }
    }
    recent.set(key, now)
    broadcast({
      type: 'notice',
      kind: notice.kind,
      sessionId: typeof notice.sessionId === 'string' ? notice.sessionId : '',
      title: typeof notice.title === 'string' ? notice.title : '',
      note: typeof notice.note === 'string' ? notice.note : '',
      toolName: typeof notice.toolName === 'string' ? notice.toolName : '',
      time: now,
    })
  }

  // ── 事件监听（只读观察；waterfall 一律透传 next()）──────────────────
  if (options.end) {
    ctx.on('agent/status', ({ agent, status }) => {
      if (status !== 'idle') return
      if (!isTopLevelAgent(agent)) return
      emitNotice({ kind: 'end', sessionId: agent.id, title: titleOf(ctx, agent) })
    })
  }

  if (options.ask) {
    ctx.on('tools/pre-execute', async (exec, next) => {
      if (exec !== undefined && exec !== null && exec.name === 'ask_user_question') {
        const agent = exec.agent
        if (isTopLevelAgent(agent)) {
          emitNotice({ kind: 'ask', sessionId: agent.id, title: titleOf(ctx, agent), note: askNoteOf(exec.arguments) })
        }
      }
      return next()
    })
  }

  if (options.approval) {
    ctx.on('approval/request', async (req, next) => {
      if (req !== undefined && req !== null && isTopLevelAgent(req.agent)) {
        emitNotice({
          kind: 'approval',
          sessionId: req.agent.id,
          title: titleOf(ctx, req.agent),
          note: typeof req.reason === 'string' ? req.reason : '',
          toolName: typeof req.toolName === 'string' ? req.toolName : '',
        })
      }
      return next()
    })
  }

  // ── 路由 ───────────────────────────────────────────────────────────────
  const webRuntime = ctx.get ? ctx.get('webRuntime') : undefined
  const trustedHosts = webRuntime !== undefined && webRuntime !== null && Array.isArray(webRuntime.trustedHosts)
    ? webRuntime.trustedHosts
    : []
  const fence = (request) => isTrustedApiRequest(request, trustedHosts)

  let heartbeatTimer = null
  const stopHeartbeat = () => {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/notify/api',
    handler: async (request, response) => {
      if (!fence(request)) {
        writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      const url = new URL(request.url ?? '/', 'http://dsh.internal')
      const pathname = url.pathname
      const method = pathname.startsWith('/notify/api/') ? pathname.slice('/notify/api/'.length) : undefined
      try {
        // ── SSE 长连接：EventSource 消费 ──────────────────────────────
        if (method === 'stream' && request.method === 'GET') {
          response.writeHead(200, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
            'x-accel-buffering': 'no',
          })
          response.write('retry: 3000\n\n')
          const client = { response }
          clients.add(client)
          const onClose = () => {
            clients.delete(client)
            response.removeListener?.('close', onClose)
          }
          response.on('close', onClose)
          if (heartbeatTimer === null) {
            heartbeatTimer = setInterval(() => {
              for (const c of [...clients]) {
                try {
                  c.response.write(': ping\n\n')
                } catch {
                  clients.delete(c)
                }
              }
            }, 25_000)
          }
          return
        }

        // ── 远程 hook：任意进程/webhook 触发通知 ─────────────────────
        if (method === 'trigger' && request.method === 'POST') {
          const token = header(request.headers, 'x-notify-token')
          if (options.apiToken !== '' && token !== options.apiToken) {
            writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'invalid x-notify-token' } })
            return
          }
          const payload = await readJsonBody(request)
          emitNotice({
            kind: 'remote',
            sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : '',
            title: typeof payload.title === 'string' ? payload.title : '',
            note: typeof payload.body === 'string' ? payload.body : '',
          })
          writeJson(response, 200, { ok: true })
          return
        }

        // ── 信息查询：当前触发开关 ────────────────────────────────────
        if (method === 'info' && request.method === 'GET') {
          writeJson(response, 200, {
            ok: true,
            value: {
              end: options.end,
              ask: options.ask,
              approval: options.approval,
              remoteEnabled: true,
              apiToken: options.apiToken !== '',
              dedupeMs: options.dedupeMs,
            },
          })
          return
        }

        writeJson(response, 404, { ok: false, error: { message: 'unknown dsh-notify API method' } })
      } catch (error) {
        writeError(response, error)
      }
    },
  }), 'dsh-notify: /notify/api routes')

  // 卸载时清理心跳（客户端集合随各 response close 自动清空）。
  ctx.effect(() => stopHeartbeat, 'dsh-notify: heartbeat teardown')
}
