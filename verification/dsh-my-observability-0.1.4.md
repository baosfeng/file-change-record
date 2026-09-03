# 发版前功能级验证清单 — dsh-my-observability@0.1.4

验证时间：2026-09-03T23:35 CST（功能级）2026-09-03T14:29:42.174Z
验证环境：隔离实例（端口 3082，复用生产 profile 配置组合，独立 DSH_HOME）

## 自动验证项（verify-real-profile.mjs 自动执行）

- [x] 配置组合唯一性（dump-config 无重复插件行 id）
- [x] 实例启动就绪（HTTP 200）
- [x] 启动日志无 error / duplicate 记录
- [x] 插件 API 冒烟（--api-path 全部 200）

## 功能级验证项（需在隔离实例 + 真实浏览器中验证后勾选）

- [x] 核心功能走通（插件主功能在真实 GUI 中可用）
  - 真实会话中 /observability/api/resources 返回 cpuPercent/memoryBytes/fileBytes/writeRateBytesPerHour/alerts；
  - 轨迹回放面板「资源监控」区块渲染四指标（审计文件/写入速率/CPU/内存）与告警列表（隔离实例 3082 + 浏览器实测）。
- [x] 易碎场景（重启恢复 / 会话隔离 / 持久化）
  - 重启验证实例后 /observability/api/resources 仍返回完整结构与告警数组。
- [x] client UI 正常（侧边栏页签 / 设置页 / 交互）
  - 「轨迹回放」页签内新增「资源监控」区块可见：四指标（0.0 MB / 0.0 MB/h / CPU 5% / 内存 165.8 MB）+ 告警列表；控制台无错误。
- [x] 插件间联动不崩（与相邻插件共存）——153 个插件行 id 配置组合下与 16 个 client 插件共存，启动日志无 error。
- [x] 验证后环境已清理（实例停止 / 临时目录删除 / 端口释放）——3082 实例已停、/tmp 与工作区临时目录已删、agent-browser 会话已关。

> 说明：功能级项由验证者（人工或 agent）在真实浏览器中逐项验证后，将 [ ] 改为 [x]。
> release.mjs 发版门禁会校验本清单功能级项全部勾选，未全勾选将阻断发版（issue #67）。
