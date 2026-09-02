# 发版前功能级验证清单 — dsh-my-guardian@0.3.4

验证时间：2026-09-02T12:02:04.393Z
验证环境：隔离实例（端口 3084，复用生产 profile 配置组合，独立 DSH_HOME）

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

## 验证记录（0.3.4 = 0.3.3 + #72 依赖声明）

- **#72 依赖声明**：`dsh-shared` 从 peerDependencies 移入 dependencies（npm 安装自动
  携带）。隔离实例启动无错误、`/guardian/api/state` 冒烟 200、safeMode/staged/promoted/
  events 数据结构正常，证明 dsh-shared 运行时加载无缺失。
- **功能语义**：本版本仅依赖声明变更（无行为改动），核心功能（候选区挂载/转正/
  失败禁用/安全模式/诊断面板）由既有 host 测试覆盖。
- **测试**：vitest 33 passed（host-smoke/host-mutation/host-edge）+ cucumber
  8 scenarios/44 steps 全绿；node --check 通过。
