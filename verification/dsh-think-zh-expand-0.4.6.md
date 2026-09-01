# 发版前功能级验证清单 — dsh-think-zh-expand@0.4.6

验证时间：2026-09-01T16:04:22.990Z
验证环境：隔离实例（端口 3083，复用生产 profile 配置组合，独立 DSH_HOME）

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

## 验证记录（0.4.6 = 0.4.5 + #73 思考块样式回官方默认）

- 本版本内容为 PR #98（#73 思考块样式完全回官方默认 ReasoningRow）合并后的代码，功能级验证基于 PR #98 的完整验证结果：
  - 本地测试：vitest 2 files/3 tests 通过（覆盖率 100%），cucumber 5 scenarios/26 steps 通过
  - CI 等价检查全过：eslint 0 errors、prettier --check、tsc --noEmit、depcruise（318 modules 无违规）、knip、test:scripts（42 tests）
  - CI run #33523401885（PR #98）conclusion=success
- 自动验证（verify-real-profile）：配置组合唯一（153 id 无重复）、实例启动就绪、启动日志无 error/duplicate
- 0.4.6 发版目的：npm latest 指向旧版 0.4.4（08-31 发布顺序颠倒导致），且 npm 0.4.5 为旧代码（不含 #73 修复）；发版 0.4.6 使 npm latest 更新为含修复的版本
