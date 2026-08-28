/**
 * dsh-my-guard — /guard/api routes.
 *
 * 所有请求先做 loopback 信任围栏（与 /api 网关一致的契约）。方法分派：
 *  - GET  /status                  — 状态 + 护栏配置
 *  - GET  /alerts?sessionId&type&limit — 告警列表（最新在前）
 *  - POST /scan                    — 投毒扫描（body { target: 包名或路径 }）
 *  - POST /scan-prompt             — 提示注入检测（body { text }）
 *  - POST /alerts/confirm          — 确认告警（body { id }，用户确认机制）
 */
import { isTrustedApiRequest, readJsonBody, writeJson, writeError } from 'dsh-shared'
import { resolveAndScan, localPathOf } from './poison.js'
import { detectPromptInjection } from './injection.js'

/** 注册 /guard/api 路由（effect 持有 disposer）。 */
export function registerGuardRoutes(ctx, store, options) {
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
        path: '/guard/api',
        handler: apiHandler(fence, store, options),
      }),
    'dsh-my-guard: /guard/api routes',
  )
}

/** 统一 handler：fence → 方法分派 → 404/错误兜底。 */
function apiHandler(fence, store, options) {
  return async (request, response) => {
    if (!fence(request)) {
      writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      return
    }
    const url = new URL(request.url ?? '/', 'http://dsh.internal')
    const pathname = url.pathname
    const method = pathname.startsWith('/guard/api/') ? pathname.slice('/guard/api/'.length) : undefined
    try {
      const handled = await dispatchMethod(method, request, response, url, store, options)
      if (!handled) {
        writeJson(response, 404, {
          ok: false,
          error: { message: 'unknown dsh-my-guard API method' },
        })
      }
    } catch (error) {
      writeError(response, error)
    }
  }
}

/** 方法 + 请求动词匹配。 */
function isMethod(method, request, name, verb) {
  return method === name && request.method === verb
}

/** 按 method 分派到具体 handler；未识别返回 false（调用方回 404）。 */
async function dispatchMethod(method, request, response, url, store, options) {
  if (isMethod(method, request, 'status', 'GET')) {
    writeJson(response, 200, { ok: true, value: statusValue(store, options) })
    return true
  }
  if (isMethod(method, request, 'alerts', 'GET')) {
    writeJson(response, 200, {
      ok: true,
      value: store.alerts(queryOf(url, 'sessionId'), queryOf(url, 'type'), limitOf(url)),
    })
    return true
  }
  if (isMethod(method, request, 'scan', 'POST')) {
    await handleScan(request, response)
    return true
  }
  if (isMethod(method, request, 'scan-prompt', 'POST')) {
    await handleScanPrompt(request, response)
    return true
  }
  if (isMethod(method, request, 'alerts/confirm', 'POST')) {
    await handleConfirm(request, response, store)
    return true
  }
  return false
}

// ── handlers ───────────────────────────────────────────────────────────────

/** 状态：告警统计 + 护栏配置。 */
function statusValue(store, options) {
  return {
    alertCount: store.count(),
    mode: options.mode,
    poisonScan: options.poisonScan,
    injection: options.injection,
  }
}

/** 投毒扫描：body { target }（包名或本地路径/tarball 路径）。 */
async function handleScan(request, response) {
  const payload = await readJsonBody(request)
  const target = typeof payload.target === 'string' ? payload.target.trim() : ''
  if (target === '') {
    writeJson(response, 400, { ok: false, error: { message: 'target required' } })
    return
  }
  const result = await scanTarget(target)
  if (!result.ok) {
    writeJson(response, 400, { ok: false, error: { message: result.error } })
    return
  }
  writeJson(response, 200, { ok: true, value: result })
}

/** 提示注入检测：body { text }。 */
async function handleScanPrompt(request, response) {
  const payload = await readJsonBody(request)
  const text = typeof payload.text === 'string' ? payload.text : ''
  if (text === '') {
    writeJson(response, 400, { ok: false, error: { message: 'text required' } })
    return
  }
  writeJson(response, 200, { ok: true, value: { hits: detectPromptInjection(text) } })
}

/** 确认告警：body { id }。 */
async function handleConfirm(request, response, store) {
  const payload = await readJsonBody(request)
  const id = payload.id
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    writeJson(response, 400, { ok: false, error: { message: 'id required' } })
    return
  }
  writeJson(response, 200, { ok: true, value: { confirmed: store.confirm(id) } })
}

/** 扫描目标：tarball 路径解压扫；本地路径/包名经 resolveAndScan。 */
async function scanTarget(target) {
  if (target.endsWith('.tgz') || target.endsWith('.tar.gz')) {
    const { scanTarball } = await import('./poison.js')
    return scanTarball(target)
  }
  const local = localPathOf(target)
  if (local !== '') return resolveAndScan(local)
  return resolveAndScan(target)
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

function queryOf(url, name) {
  return url.searchParams.get(name) ?? ''
}

function limitOf(url) {
  const raw = url.searchParams.get('limit')
  const parsed = raw === null ? 0 : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}
