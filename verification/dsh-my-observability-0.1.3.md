# 发版前功能级验证清单 — dsh-my-observability@0.1.3

验证时间：2026-09-03T13:39:37.979Z（自动项）/ 2026-09-03T21:55 CST（功能级）
验证环境：隔离实例（端口 3081，复用生产 profile 配置组合，独立 DSH_HOME）

## 自动验证项（verify-real-profile.mjs 自动执行）

- [x] 配置组合唯一性（dump-config 无重复插件行 id）
- [x] 实例启动就绪（HTTP 200）
- [x] 启动日志无 error / duplicate 记录
- [x] 插件 API 冒烟（--api-path 全部 200）

## 功能级验证项（需在隔离实例 + 真实浏览器中验证后勾选）

- [x] 核心功能走通（插件主功能在真实 GUI 中可用）
  - 隔离实例启动后，真实会话中发送消息 → 审计事件产生（agent_status running/顶层 + llm_stream start/end ×4 + idle）；
  - `GET /observability/api/status` → `auditCount: 6, sessions: 1`；`/observability/api/events?sessionId=*` 返回完整事件（id/time/type/data）；
  - 实际落盘 `audit.jsonl` 899B / 6 条事件（增量追加，每条 ≈150B，无全量重写放大）。
- [x] 易碎场景（重启恢复 / 会话隔离 / 持久化）
  - 重启验证实例（kill + 重新启动）后 `auditCount` 仍为 6、`audit.jsonl` 保持 899B——事件从 jsonl 完整恢复，无重复/丢失。
- [x] client UI 正常（侧边栏页签 / 设置页 / 交互）
  - 底部面板展开后出现「轨迹回放」页签卡片；激活后时间轴渲染真实事件（「状态 running · 顶层」「模型流」×4「状态 idle · 顶层」）；
  - 面板含会话选择（当前会话/全部会话）+ 工具统计 + Git 工具页签；浏览器 console 无错误。
- [x] 插件间联动不崩（与相邻插件共存）
  - 生产配置组合（153 个插件行 id）下与 dsh-file-activity / dsh-my-context / dsh-md-render 等共存加载，侧边栏多面板正常渲染，启动日志无 error。
- [x] 验证后环境已清理（实例停止 / 临时目录删除 / 端口释放）
  - 验证实例已停止、/tmp/dsh-verify-real-3081 与 /tmp/dsh-obs-ws 已删除、3081 端口已释放、agent-browser 会话已关闭。

> 说明：功能级项由验证者（人工或 agent）在真实浏览器中逐项验证后，将 [ ] 改为 [x]。
> release.mjs 发版门禁会校验本清单功能级项全部勾选，未全勾选将阻断发版（issue #67）。
