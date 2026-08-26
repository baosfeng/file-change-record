/**
 * dsh-plugin-manager — host half.
 *
 * 公共插件管理面板（issue #2）：在 DSH 设置页统一维护插件生命周期——
 * 市场浏览/搜索（npm registry）、一键安装/卸载（`dsh plugin` CLI）、
 * 更新检查（pnpm outdated）、已安装清单（官方 pluginInventory）。
 *
 * 纯官方依赖：server 只用 pluginInventory / webServer / webRuntime 服务；
 * client 面板挂在官方 slots 扩展点（设置 → 插件），不依赖第三方插件。
 * 安装/卸载通过 `dsh plugin --profile <p> add|remove` 落盘（与 CLI 同一
 * 数据源），新插件在下次重启时由 loader（或 guardian 候选区）加载。
 */
import { join } from 'node:path'
import { homedir } from 'node:os'
import { isTrustedApiRequest } from './fence.js'
import { createApiHandler } from './api-route.js'

export const name = 'dsh-plugin-manager'

export const inject = ['pluginInventory', 'webServer', 'webRuntime']

/** Profile 名：进程参数 --profile 优先，否则默认 web。 */
export function currentProfile() {
  const argv = process.argv
  const idx = argv.indexOf('--profile')
  if (idx !== -1 && typeof argv[idx + 1] === 'string' && argv[idx + 1] !== '') return argv[idx + 1]
  return 'web'
}

/** Profile 目录：$DSH_HOME/profiles/<profile>（fallback ~/.dsh/profiles/…）。 */
export function profileDirOf(profile) {
  const home = process.env.DSH_HOME
  const base = typeof home === 'string' && home !== '' ? `${home}/profiles` : `${homedir()}/.dsh/profiles`
  return join(base, profile)
}

export function apply(ctx) {
  const profile = currentProfile()
  const profileDir = profileDirOf(profile)
  const fence = (request) => isTrustedApiRequest(request, ctx.webRuntime.trustedHosts)
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/plugin-manager/api',
    handler: createApiHandler({ ctx, profile, profileDir, fence }),
  }), 'dsh-plugin-manager: /plugin-manager/api routes')
}
