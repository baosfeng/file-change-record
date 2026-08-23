# Changelog

本文件记录 dsh-notify 的所有版本变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-23

### 新增

- **三类自动触发提醒**：会话结束（`agent/status` idle）、agent 询问问题（`ask_user_question`）、审批请求（`approval/request`），默认全开、可配置单独关闭；自动过滤子代理会话；同类 3 秒去重。
- **浏览器通知 + 提示音 + 页面 toast**：Notification API 系统通知（标题=会话标题，正文=类型+摘要），点击跳转对应会话；Web Audio 合成短促「滴」声；通知权限被拒时页面右上角 toast 兜底；通知/声音/toast 可经 localStorage 独立关闭。
- **实时通道**：`GET /notify/api/stream` SSE 长连接（EventSource 消费，25s 心跳，断线自动重连），多标签页同时订阅。
- **远程 hook 扩展接口**：`POST /notify/api/trigger` 支持任意本机进程/webhook 触发自定义通知（`kind: remote`，可带 `sessionId` 跳转）；loopback 信任围栏 + 可选 `apiToken`（`x-notify-token` 头）门禁。
- **查询接口**：`GET /notify/api/info` 返回当前触发开关。
- **冒烟测试**：`test/host-smoke.mjs` 覆盖三类触发（含 waterfall `next()` 透传）、子代理过滤、去重、SSE 清理、fence/token 门禁。

**真实环境验证**（独立端口 3081 隔离实例）：
- 真实 agent 完成一轮对话 → SSE 收到 `kind: end` 通知帧；
- 真实 agent 调用 `ask_user_question` → SSE 收到 `kind: ask` 通知帧（含真实会话标题「通知插件端到端验证」与问题摘要）；
- `POST /notify/api/trigger` → SSE 广播 `kind: remote` 帧；跨域/非标 host 请求被 403 拒绝。
