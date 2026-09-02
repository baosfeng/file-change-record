/**
 * dsh-my-memory — host half.
 *
 * 全局/项目两级记忆（issue #38）：
 *  - 持久化：全局 `$DSH_HOME/memory.json` + 项目 `<projectRoot>/.dsh/memory.json`
 *    （按 cwd 向上找 .git 定位项目根，与 dsh-my-skill-manager 同模式），
 *    原子写（tmp+rename）+ 防抖（300ms 合并写盘），启动时 load() 恢复缓存；
 *  - 系统提示词注入：注册 `dsh-my-memory` section（order -95，persona 之前），
 *    text 为 provider 函数——每次组装系统提示词时读取全局记忆缓存，注入
 *    最新 maxItems 条（默认 5），每条截断 maxDescLength 字符（默认 200）；
 *    空记忆渲染空 section（renderPrompt 自动丢弃），零成本；
 *  - 工具：`memory_query`（只读，全局/项目过滤 + 关键词过滤，项目 cwd 取
 *    会话工作目录）；
 *  - 写操作 API：`POST /my-memory/api/memory`（add/update/delete），必须携带
 *    `confirmed: true` 用户同意标记，否则 400 拒绝——记忆绝不静默变更；
 *  - Client：官方 slots 设置页签（全局/项目分区 + 自定义确认 UI：删除红色、
 *    保存绿色）。
 */
import { createApiHandler } from './api-route.js'
import { isTrustedApiRequest } from 'dsh-shared'
import { createMemorySection } from './prompt.js'
import { createStore, globalMemoryFile, projectMemoryFileOf } from './store.js'
import { createMemoryQueryTool } from './tool.js'

export const name = 'dsh-my-memory'

export const inject = ['systemPrompt', 'tools', 'webServer', 'webRuntime', 'sessions']

export function apply(ctx, config) {
  // ── stores：全局一个实例；项目按 cwd 懒创建并缓存 ────────────────────
  const globalStore = createStore({ file: globalMemoryFile() })
  const projectStores = new Map()
  const getProjectStore = async (cwd) => {
    const file = await projectMemoryFileOf(cwd)
    let store = projectStores.get(file)
    if (store === undefined) {
      store = createStore({ file })
      await store.load()
      projectStores.set(file, store)
    }
    return store
  }

  ctx.effect(() => {
    globalStore.load().catch(() => {})
    return () => {
      globalStore.flush().catch(() => {})
      for (const store of projectStores.values()) store.flush().catch(() => {})
    }
  }, 'dsh-my-memory: store lifecycle')

  // ── 系统提示词注入（每次组装求值，记忆变更即时生效）────────────────
  ctx.effect(
    () => ctx.systemPrompt.section(createMemorySection(globalStore, config)),
    'dsh-my-memory: system prompt section',
  )

  // ── memory_query 只读工具 ─────────────────────────────────────────────
  ctx.effect(
    () => ctx.tools.register(createMemoryQueryTool({ globalStore, getProjectStore })),
    'dsh-my-memory: memory_query tool',
  )

  // ── 写操作 API（需用户同意标记）──────────────────────────────────────
  const fence = (request) => isTrustedApiRequest(request, ctx.webRuntime.trustedHosts)
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: '/my-memory/api',
        handler: createApiHandler({ globalStore, getProjectStore, fence, sessions: ctx.sessions }),
      }),
    'dsh-my-memory: /my-memory/api routes',
  )
}
