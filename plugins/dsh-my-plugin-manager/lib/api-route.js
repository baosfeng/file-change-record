/**
 * dsh-my-plugin-manager — /my-plugin-manager/api route handler.
 *
 *  - GET  /my-plugin-manager/api/installed  → loader 已安装清单 + 版本；
 *  - GET  /my-plugin-manager/api/search?q=… → npm registry 市场搜索；
 *  - POST /my-plugin-manager/api/install    → `dsh plugin --profile <p> add`;
 *  - POST /my-plugin-manager/api/uninstall  → `dsh plugin --profile <p> remove`;
 *  - GET  /my-plugin-manager/api/updates    → `pnpm outdated --json`（更新检查）。
 * Every request passes the trust fence first; responses are JSON with
 * cache-control: no-cache.
 */
import { readJsonBody, writeError, writeJson } from './http.js'
import { installedVersionOf, installPlugin, uninstallPlugin, outdatedPlugins } from './manage.js'
import { searchNpmPlugins } from './registry.js'

export function createApiHandler({ ctx, profile, profileDir, fence }) {
  const handlers = {
    installed: { method: 'GET', run: (url, request, response) => handleInstalled(ctx, profileDir, response) },
    search: { method: 'GET', run: (url, request, response) => handleSearch(url, response) },
    updates: { method: 'GET', run: (url, request, response) => handleUpdates(profile, response) },
    install: { method: 'POST', run: (url, request, response) => handleInstall(profile, request, response) },
    uninstall: { method: 'POST', run: (url, request, response) => handleUninstall(profile, request, response) },
  }
  return async (request, response) => {
    if (!fence(request)) {
      writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      return
    }
    const url = new URL(request.url ?? '/', 'http://dsh.internal')
    try {
      const method = apiMethodOf(url)
      const spec = method === undefined ? undefined : handlers[method]
      if (spec === undefined || spec.method !== request.method) {
        writeJson(response, 404, { ok: false, error: { message: 'unknown my-plugin-manager API method' } })
        return
      }
      await spec.run(url, request, response)
    } catch (error) {
      writeError(response, error)
    }
  }
}

/** Strip the /my-plugin-manager/api/ prefix; undefined for anything else. */
function apiMethodOf(url) {
  const pathname = url.pathname
  return pathname.startsWith('/my-plugin-manager/api/') ? pathname.slice('/my-plugin-manager/api/'.length) : undefined
}

/**
 * 官方/内置包命名空间（issue #28）：DSH 官方 bundle（@deepseek-ai/*）、
 * Cordis 核心 loader 条目（cordis / cordis:*）、Cordis 官方生态组织
 * （@koishijs/*）。其余命名空间一律视为用户安装的插件。
 */
const OFFICIAL_PREFIXES = ['@deepseek-ai/', '@koishijs/']

/** 判断 moduleName 是否为官方/内置插件（用于「已安装」列表过滤）。 */
export function isOfficialModule(moduleName) {
  if (moduleName === 'cordis' || moduleName.startsWith('cordis:')) return true
  return OFFICIAL_PREFIXES.some((prefix) => moduleName.startsWith(prefix))
}

/** GET /installed — user-installed loader entries with resolved versions. */
function handleInstalled(ctx, profileDir, response) {
  const inventory = ctx.pluginInventory.list()
  const entries = inventory.entries
    .map((entry) => ({
      moduleName: entry.moduleName,
      enabled: entry.enabled,
      fiberPhase: entry.fiberPhase,
      version: installedVersionOf(profileDir, entry.moduleName),
      official: isOfficialModule(entry.moduleName),
    }))
    .filter((entry) => !entry.official)
  writeJson(response, 200, { ok: true, value: { entries } })
}

/** GET /search?q=… — npm registry market search. */
async function handleSearch(url, response) {
  const query = url.searchParams.get('q') ?? ''
  const size = Number(url.searchParams.get('size') ?? 30)
  if (query.trim() === '') {
    writeJson(response, 200, { ok: true, value: { results: [] } })
    return
  }
  const results = await searchNpmPlugins(query.trim(), safeSize(size))
  writeJson(response, 200, { ok: true, value: { results } })
}

/** GET /updates — pnpm outdated --json parsed into a flat list. */
async function handleUpdates(profile, response) {
  const result = await outdatedPlugins(profile)
  if (!result.ok) {
    writeJson(response, 200, { ok: true, value: { outdated: [], error: result.error } })
    return
  }
  writeJson(response, 200, { ok: true, value: { outdated: result.outdated } })
}

/** POST /install { source } — install a npm package or link: path. */
async function handleInstall(profile, request, response) {
  const payload = await readJsonBody(request)
  const source = typeof payload.source === 'string' ? payload.source.trim() : ''
  if (source === '') {
    writeJson(response, 400, { ok: false, error: { message: 'source is required' } })
    return
  }
  const result = await installPlugin(profile, source)
  writeJson(response, 200, {
    ok: result.ok,
    error: result.ok ? undefined : { message: result.stderr.trim() || result.stdout.trim() || `exit ${result.code}` },
  })
}

/** POST /uninstall { name } — remove an installed package. */
async function handleUninstall(profile, request, response) {
  const payload = await readJsonBody(request)
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  if (name === '') {
    writeJson(response, 400, { ok: false, error: { message: 'name is required' } })
    return
  }
  const result = await uninstallPlugin(profile, name)
  writeJson(response, 200, {
    ok: result.ok,
    error: result.ok ? undefined : { message: result.stderr.trim() || result.stdout.trim() || `exit ${result.code}` },
  })
}

/** Clamp the search size to 1..50. */
function safeSize(size) {
  if (!Number.isFinite(size) || size < 1) return 30
  return Math.min(size, 50)
}
