/**
 * dsh-file-activity — host half.
 *
 * Tracks file activity for dsh-better-sidebar:
 *  - agent tool file operations arrive as `fs/observed` events (read / write /
 *    edit / str_replace_editor / read_image ...), with the tool execution as
 *    the actor (name + parsed arguments + owning agent).
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

export const name = 'dsh-file-activity'

export const inject = ['webServer', 'sessions', 'webRuntime']

export function apply(ctx) {
  const store = createStore(ctx)

  // ── agent-side file operations ──────────────────────────────────────────
  ctx.on('fs/observed', createFsObserver(store.record))

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
