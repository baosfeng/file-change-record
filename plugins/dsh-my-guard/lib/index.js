/**
 * dsh-my-guard — host half.
 *
 * 安全护栏三件套：
 *  1. 执行前护栏：监听 tools/pre-execute，破坏性命令（rm -rf / 等）执行前
 *     拦截/确认——默认 observe 只读观察 + 告警（透传 next()，不改变工具
 *     流程）；mode=ask 时返回 `{ kind: 'ask', reason }` 触发 DSH 原生审批
 *     确认；mode=deny 时直接拦截；
 *  2. 安装前投毒扫描：检测 bash 命令中的 `dsh plugin add <pkg>` 异步扫描
 *     包内容（本地目录或 registry tarball，绝不执行包内代码），可疑内容
 *     （可疑脚本/密钥/恶意依赖）告警；`POST /guard/api/scan` 手动扫描；
 *  3. 提示注入检测：监听 session/event 的 user/message（过滤插件注入），
 *     规则 + 启发式检测 prompt injection / jailbreak，命中告警。
 *
 * 告警统一进 store（$DSH_HOME/guard/alerts.json，防抖 + 原子写 + 重启
 * 恢复），侧边栏「安全护栏」面板展示 + 用户确认机制。
 *
 * 模块结构：
 *  - fence.js    — Host-header 信任围栏（loopback / trustedHosts / 同源）
 *  - guard.js    — 执行前护栏（tools/pre-execute 拦截/确认 + 投毒扫描联动）
 *  - poison.js   — 投毒扫描引擎（纯函数：目录/tarball/包名）
 *  - injection.js — 提示注入检测（纯函数：规则 + 启发式）
 *  - store.js    — 告警存储（持久化 / 上限 / 确认）
 *  - routes.js   — /guard/api 路由
 */
import { createStore } from './store.js'
import { attachGuardListener, normalizeMode } from './guard.js'
import { attachInjectionListener } from './injection.js'
import { registerGuardRoutes } from './routes.js'

export const name = 'dsh-my-guard'

export const inject = ['webServer']

export function apply(ctx, config) {
  // ── 配置（应用层 config 覆盖，默认全部开启）─────────────────────────
  const options = {
    mode: normalizeMode(config?.mode),
    poisonScan: config?.poisonScan !== false,
    injection: config?.injection !== false,
  }

  // ── 告警存储：持久化 + 重启恢复 ─────────────────────────────────────
  const store = createStore(ctx)

  // ── 执行前护栏（破坏性命令拦截/确认 + 投毒扫描联动）────────────────
  attachGuardListener(ctx, options, store.record)

  // ── 提示注入检测（user/message 监听）─────────────────────────────────
  if (options.injection) attachInjectionListener(ctx, store.record)

  // ── 路由（状态 / 告警 / 扫描 / 确认）────────────────────────────────
  registerGuardRoutes(ctx, store, options)

  // ── 卸载冲刷：清防抖定时器 + 立即落盘 ───────────────────────────────
  ctx.effect(() => store.dispose, 'dsh-my-guard: persistence teardown')
}
