/**
 * dsh-skill-manager — /skill-manager/api route handler.
 *
 *  - GET  /skill-manager/api/list?cwd=… → the merged skill catalog (global /
 *    project groups) plus the current global/project config; in project view
 *    (cwd set) only project-sourced skills are returned, and the response
 *    carries a diagnostics list of directory entries the official scanner
 *    skipped (missing name + reason);
 *  - GET  /skill-manager/api/rescan?cwd=… → invalidate the official skill
 *    catalog (control.invalidate → revision bump + cache clear) and return a
 *    freshly scanned list payload, so a newly created skill shows up without
 *    a restart;
 *  - PUT  /skill-manager/api/config → save a scope's disabled list (body:
 *    { scope: 'global'|'project', disabled: string[], cwd }), then invalidate
 *    the skill catalog so the change takes effect immediately.
 * Every request passes the trust fence first; responses are JSON with
 * cache-control: no-cache.
 */
import { readJsonBody, writeError, writeJson } from './http.js'
import { readConfigFile, readProjectConfig, globalConfigFile, projectConfigFileOf, writeConfigFile, findProjectRoot } from './config.js'
import { scanSkillRoots, viewRootsOf } from './diagnose.js'

/** 项目来源判定：官方 source 值中 project 前缀只有 project-dsh / project-agents。 */
function isProjectSource(source) {
  return typeof source === 'string' && source.startsWith('project-')
}

export function createApiHandler({ ctx, invalidate, fence }) {
  return async (request, response) => {
    if (!fence(request)) {
      writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      return
    }
    const url = new URL(request.url ?? '/', 'http://dsh.internal')
    try {
      if (url.pathname.endsWith('/list') && request.method === 'GET') {
        await handleList(ctx, url, response)
        return
      }
      if (url.pathname.endsWith('/rescan') && request.method === 'GET') {
        await handleRescan(ctx, url, response, invalidate)
        return
      }
      if (url.pathname.endsWith('/config') && request.method === 'PUT') {
        await handleConfig(request, response, invalidate)
        return
      }
      writeJson(response, 404, { ok: false, error: { message: 'unknown skill-manager API method' } })
    } catch (error) {
      writeError(response, error)
    }
  }
}

/** GET /list — grouped catalog + configs for the cwd. */
async function handleList(ctx, url, response) {
  const safeCwd = cwdOf(url)
  const data = await resolveListData(ctx, safeCwd)
  writeJson(response, 200, { ok: true, value: data })
}

/** GET /rescan — invalidate the official catalog, then return a fresh list. */
async function handleRescan(ctx, url, response, invalidate) {
  const safeCwd = cwdOf(url)
  invalidate()
  const data = await resolveListData(ctx, safeCwd)
  writeJson(response, 200, { ok: true, value: data })
}

/** The cwd query parameter, normalized to undefined when absent. */
function cwdOf(url) {
  const cwd = url.searchParams.get('cwd') ?? ''
  return cwd !== '' ? cwd : undefined
}

/** Fetch the merged catalog + configs for one cwd (''/undefined = global view). */
async function resolveListData(ctx, safeCwd) {
  const catalog = await ctx.skills.list({ cwd: safeCwd })
  const global = await readConfigFile(globalConfigFile())
  const project = safeCwd === undefined ? undefined : await readProjectConfig(safeCwd)
  const projectRoot = safeCwd === undefined ? undefined : await findProjectRoot(safeCwd)
  // 项目视图只显示该项目的 skill；全局 skill 只在全局视角查看。
  const catalogSkills = viewSkills(catalog, safeCwd)
  // 目录扫描与视图一致：项目视图只扫项目 roots，全局视图只扫全局 roots。
  const visibleRoots = viewRoots(await viewRootsOf(safeCwd), safeCwd)
  const scanned = await scanSkillRoots(visibleRoots)
  return {
    cwd: safeCwd ?? '',
    projectRoot: projectRoot ?? '',
    skills: mergeSkills(catalogSkills, scanned.skills, disabledNames(global, project)),
    global: { disabled: global.global.disabled },
    project: projectDisabled(project),
    diagnostics: { missing: scanned.issues },
  }
}

/** 合并官方 catalog 与目录扫描：catalog 优先，目录中缺失的正常条目补充并标记未收录。 */
function mergeSkills(catalogSkills, scannedSkills, disabled) {
  const byName = new Map()
  for (const skill of catalogSkills) {
    byName.set(skill.name, {
      name: skill.name,
      description: skill.description,
      source: skill.source,
      provider: skill.provider,
      // The placeholder provider marks a disabled skill; anything else is enabled.
      disabled: disabled.has(skill.name) && skill.provider === 'skill-manager',
    })
  }
  for (const skill of scannedSkills) {
    if (byName.has(skill.name)) continue
    byName.set(skill.name, {
      name: skill.name,
      description: skill.description,
      source: skill.source,
      provider: 'filesystem',
      disabled: disabled.has(skill.name),
      cataloged: false,
    })
  }
  return [...byName.values()]
}

/** 全局 + 项目禁用名单的并集（项目视图下项目覆盖/扩展全局）。 */
function disabledNames(global, project) {
  return new Set([...global.global.disabled, ...projectDisabled(project)])
}

/** 项目配置的禁用名单（无项目配置时为空）。 */
function projectDisabled(project) {
  return project?.project.disabled ?? []
}

/** 按视图过滤 catalog：项目视图只保留项目来源条目。 */
function viewSkills(catalog, safeCwd) {
  return safeCwd === undefined ? catalog : catalog.filter((skill) => isProjectSource(skill.source))
}

/** 按视图过滤扫描根目录：项目视图只保留项目来源 roots。 */
function viewRoots(roots, safeCwd) {
  return safeCwd === undefined ? roots : roots.filter((root) => isProjectSource(root.source))
}

/** PUT /config — persist a scope's disabled list and invalidate the catalog. */
async function handleConfig(request, response, invalidate) {
  const payload = await readJsonBody(request)
  const scope = payload.scope
  const disabled = Array.isArray(payload.disabled)
    ? payload.disabled.filter((name) => typeof name === 'string' && name !== '')
    : []
  if (scope !== 'global' && scope !== 'project') {
    writeJson(response, 400, { ok: false, error: { message: 'scope must be "global" or "project"' } })
    return
  }
  if (scope === 'global') {
    const file = globalConfigFile()
    const config = await readConfigFile(file)
    config.global.disabled = [...new Set(disabled)]
    await writeConfigFile(file, config)
  } else {
    const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd()
    const file = await projectConfigFileOf(cwd)
    const config = await readConfigFile(file)
    config.project.disabled = [...new Set(disabled)]
    await writeConfigFile(file, config)
  }
  invalidate()
  writeJson(response, 200, { ok: true })
}
