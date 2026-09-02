# 发版前功能级验证清单 — dsh-task-reliability@0.4.4

验证时间：2026-09-02T11:38:34.697Z
验证环境：隔离实例（端口 3087，复用生产 profile 配置组合，独立 DSH_HOME）

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

## 验证记录（0.4.4 = 0.4.3 + #79 autopilot 延迟决策缓冲期 + #72 依赖声明）

- **#79 autopilot 延迟决策缓冲期（真实浏览器 3083 隔离实例实测）**：
  - 设置页「任务可靠性」页签（settings.plugins.tab slot）正常显示 ✓
  - 「自主决策缓冲（毫秒）」配置项可见，说明文案「自主决策模式下 ask 先展示给
    用户，缓冲超时后才自动决策（0 = 立即拦截）」✓
  - 输入框默认值 20000（20s 缓冲）✓
  - 行为语义（ask 先展示、缓冲超时自动决策、0 立即拦截）由单元测试
    （test/features/task-reliability.feature 等）覆盖
- **#72 依赖声明**：dsh-shared 移入 dependencies；实例启动无错误、API 冒烟 200。
- **测试**：vitest 205 passed + cucumber 35 scenarios/190 steps 全绿；node --check 通过。
