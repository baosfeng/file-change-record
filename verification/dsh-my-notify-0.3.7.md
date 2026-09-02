# 发版前功能级验证清单 — dsh-my-notify@0.3.7

验证时间：2026-09-02T02:17:24.728Z
验证环境：隔离实例（端口 3081，复用生产 profile 配置组合，独立 DSH_HOME）

## 自动验证项（verify-real-profile.mjs 自动执行）

- [x] 配置组合唯一性（dump-config 无重复插件行 id）
- [x] 实例启动就绪（HTTP 200）
- [x] 启动日志无 error / duplicate 记录
- [x] 插件 API 冒烟（--api-path 全部 200）

## 功能级验证项（需在隔离实例 + 真实浏览器中验证后勾选）

- [x] 核心功能走通（插件主功能在真实 GUI 中可用）
- [x] 易碎场景（重启恢复 / 会话隔离 / 持久化）
- [x] client UI 正常（侧边栏页签 / 设置页 / 交互）
- [x] 插件间联动不崩（与相邻插件共存）
- [x] 验证后环境已清理（实例停止 / 临时目录删除 / 端口释放）

> 说明：功能级项由验证者（人工或 agent）在真实浏览器中逐项验证后，将 [ ] 改为 [x]。
> release.mjs 发版门禁会校验本清单功能级项全部勾选，未全勾选将阻断发版（issue #67）。

## 验证记录（0.3.7 = 0.3.6 + 修复 #70 竞态 + 修复 #92 构建顺序 TDZ）

- **#70 跨标签页竞态修复（Web Locks）**：原 localStorage get→check→set 非原子，
  两个标签页并发收到同一 SSE 帧时双双通过检查导致**双弹**（真实浏览器实测复现
  S3/S5/S6 三次双弹；单元测试串行调用测不出来）。改用 `navigator.locks.request`
  浏览器级跨标签页互斥后：H1/H2 两次并发实验均**只弹一次**（t2 弹、t1 静默），
  窗口过期后同 key 可重新处理；无 Web Locks 时降级回原逻辑。
- **#92 构建顺序 TDZ 修复**：0.3.6 的 client.js 中 `settings.js` 顶层
  `SETTINGS_STYLES = ... + WEBHOOK_STYLES` 在 `WEBHOOK_STYLES` 声明前引用 → 客户端
  挂载失败（真实浏览器报 Cannot access 'WEBHOOK_STYLES' before initialization，
  通知功能整体不可用）。修复：webhook-settings.js 拼接顺序提前到 settings.js 之前
  （依赖方向：webhook 只依赖 i18n 的 strings，不依赖 settings 符号）。
  修复后真实浏览器 console 无错误、通知链路完整可用。
- **测试**：vitest 59 passed（含新增「多标签页并发 claim 只弹一次」回归用例）+
  cucumber 17 scenarios/99 steps 全绿；`node --check` 通过。
- **真实浏览器**：隔离实例 3081 双标签页（共享 localStorage/Web Locks）并发触发
  远程通知 H1/H2：均只弹一次；本地窗口去重、窗口过期重弹、多标签页静默均符合预期。
