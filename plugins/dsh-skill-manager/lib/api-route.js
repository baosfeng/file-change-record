/**
 * dsh-skill-manager — /skill-manager/api route handler.
 *
 *  - GET  /skill-manager/api/list?cwd=… → the merged skill catalog (global /
 *    project groups) plus the current global/project config;
 *  - PUT  /skill-manager/api/config → save a scope's disabled list (body:
 *    { scope: 'global'|'project', disabled: string[], cwd }), then invalidate
 *    the skill catalog so the change takes effect immediately.
 * Every request passes the trust fence first; responses are JSON with
 * cache-control: no-cache.
 */
import { readJsonBody, writeError, writeJson } from './http.js'
import { readConfigFile, readProjectConfig, globalConfigFile, projectConfigFileOf, writeConfigFile, findProjectRoot } from './config.js'

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
  const disabled = new Set([
    ...global.global.disabled,
    ...(project?.project.disabled ?? []),
  ])
  const skills = catalog.map((skill) => ({
    name: skill.name,
    description: skill.description,
    source: skill.source,
    provider: skill.provider,
    // The placeholder provider marks a disabled skill; anything else is enabled.
    disabled: disabled.has(skill.name) && skill.provider === 'skill-manager',
  }))
  return {
    cwd: safeCwd ?? '',
    projectRoot: projectRoot ?? '',
    skills,
    global: { disabled: global.global.disabled },
    project: project?.project.disabled ?? [],
  }
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
