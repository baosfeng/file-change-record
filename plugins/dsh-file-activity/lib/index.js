/**
 * dsh-file-activity — host half.
 *
 * Tracks file activity for dsh-better-sidebar:
 *  - agent tool file operations arrive as `fs/observed` events (read / write /
 *    edit / str_replace_editor / read_image ...), with the tool execution as
 *    the actor (name + parsed arguments + owning agent).
 *  - bash tool calls carry file-touching commands (rm/touch/mv/…): the
 *    `tools/pre-execute` observer parses them and records the intents.
 *  - sidebar operations (files opened / saved through the better-sidebar
 *    explorer & editor) are reported by our client half through the
 *    `/file-activity/api/record` route.
 *
 * State (recent history + per-file counts) is kept per session and persisted
 * to $DSH_HOME/file-activity.json (atomic tmp+rename, debounced).
 */
import { isTrustedApiRequest } from './fence.js'
import { createApiHandler } from './api-route.js'
import { createMediaHandler } from './media-route.js'
import { createFsObserver } from './observer.js'
import { createStore } from './store.js'
import { parseBashFileOps } from './bash-parse.js'
import { sessionCwdOf } from './http.js'

export const name = 'dsh-file-activity'

export const inject = ['webServer', 'sessions', 'webRuntime']

/** 观察型监听：只读取 bash 命令隐含的文件操作并上报，不拦截（返回 next()）。 */
function observeBashIntents(exec, ctx, store) {
  const sessionId = bashSessionOf(exec)
  const command = bashCommandOf(exec)
  if (sessionId === '' || command === '') return
  const baseDir = bashBaseDirOf(exec, ctx, sessionId)
  for (const touched of parseBashFileOps(command, baseDir)) {
    store.record(sessionId, touched.path, touched.op, Date.now())
  }
}

/** 会话 id：仅 bash 工具、agent id 非空时返回。 */
function bashSessionOf(exec) {
  if (exec?.name !== 'bash') return ''
  const id = exec.agent?.id
  return typeof id === 'string' && id !== '' ? id : ''
}

/** 命令文本：仅非空字符串时返回。 */
function bashCommandOf(exec) {
  const command = exec.arguments?.command
  return typeof command === 'string' && command !== '' ? command : ''
}

/** 相对路径基准：workdir 参数优先，否则会话 cwd。 */
function bashBaseDirOf(exec, ctx, sessionId) {
  const workdir = exec.arguments?.workdir
  return typeof workdir === 'string' && workdir !== '' ? workdir : sessionCwdOf(ctx, sessionId)
}

export function apply(ctx) {
  const store = createStore(ctx)

  // ── agent-side file operations ──────────────────────────────────────────
  ctx.on('fs/observed', createFsObserver(store.record))
  ctx.on('tools/pre-execute', (exec, next) => {
    observeBashIntents(exec, ctx, store)
    return next()
  })

  // ── routes ──────────────────────────────────────────────────────────────
  const fence = (request) => isTrustedApiRequest(request, ctx.webRuntime.trustedHosts)

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/file-activity/api',
    handler: createApiHandler({ ctx, store, fence }),
  }), 'dsh-file-activity: /file-activity/api routes')

  // Media route for the floating preview (see media-route.js for the
  // authorization model: recorded paths only, same trust fence).
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/file-activity/file',
    handler: createMediaHandler({ ctx, store, fence }),
  }), 'dsh-file-activity: /file-activity/file media route')

  // Tear down on unload: flush pending persistence.
  ctx.effect(() => store.dispose, 'dsh-file-activity: persistence teardown')
}
