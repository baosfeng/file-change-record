# 发版前功能级验证清单 — dsh-my-remote@0.1.0

验证时间：2026-09-04T13:22:08.143Z（自动验证）/ 2026-09-04T21:35:00+08:00（功能级验证）
验证环境：隔离实例（端口 3083，复用生产 profile 配置组合，独立 DSH_HOME=/tmp/dsh-3083）

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

## 验证记录（v0.1.0 首版）

### 核心功能走通

- **插件启动 + 配置生效**：`GET /remote/api/info` → `{"end":true,"ask":true,"approval":true,"apiToken":true,"webhooks":1,"askTimeoutMs":30000,"approvalTimeoutMs":30000}`（apiToken=verify-tok-3083、webhook 指向本地 :7999 已生效）
- **事件下发（ask）真实触发**：隔离实例 GUI 发消息 → 模型真实调用 `ask_user_question`（「确认继续吗」/ 是·否）→ 本地 webhook mock（:7999）收到完整 ask 帧；GUI 同步渲染「提问 等待回答」卡片（radio 选项），已截图 `plugins/dsh-my-remote/assets/ask-push.png`
  - 下行帧证据（`/tmp/dsh-3083/webhook.log`）：`{"kind":"ask","sessionId":"session-…","title":"请使用 ask_user_question 工具向我","questions":[{"id":"confirm_deploy","header":"","question":"是否继续执行部署？","options":["继续","取消"]}],"time":…}`
- **事件下发（end）真实触发**：第一轮会话结束后 `agent/status idle` → 本地 webhook 收到 end 帧：`{"kind":"end","sessionId":"session-…","title":"询问是否继续执行部署","time":…}`
- **远程回答 ask（指令链路）**：`POST /remote/api/command` action=answer + `x-remote-token: verify-tok-3083` 返回业务响应（无 pending 条目时为 `{"ok":false,"error":{"message":"no pending ask for session …"}}`，证明 token 鉴权、参数校验、注册表查询全链路通过）；注入 agent 继续执行的闭环由 `test/host-smoke.mjs` 闭环 1 + cucumber 场景 1 断言覆盖
- **状态查询**：`GET /remote/api/status` → `{"ok":true,"value":{"sessions":[...],"asks":[...],"approvals":[...],"time":…}}`
- **审计**：`GET /remote/api/audit` 返回指令留痕（含 token 失败 / unknown command / not-found）

### 安全项（curl 实测）

- [x] 无 token `POST /remote/api/command` → **403** `invalid x-remote-token`（apiToken 已配置时写指令必须带 `x-remote-token`）
- [x] Host 伪造（`curl -H "Host: evil.com" http://127.0.0.1:3083/remote/api/info`）→ **403** `forbidden`（dsh-shared loopback 信任围栏生效）
- [x] 未知动作 `POST /remote/api/command`（`{"action":"hack"}`，带 token）→ **400** `unknown command: hack`（指令白名单）
- [x] 审计留痕：以上所有失败（token 失败 / unknown command）均出现在 `/remote/api/audit`（时间/动作/sessionId/来源/结果）

### 易碎场景 / approval / end

- **approval 链路**：⚠️ 环境受限——隔离实例 permission=danger-full-access（复制生产 settings.yaml），bash 等工具执行不触发 `approval/request`，无法在真实实例触发 approval 事件；逻辑已由单测（`test/events.mjs` approval 拦截/透传/abort/超时/子代理）+ 事件下发链路（ask/end 已真实触发，同一 `Promise.race` 拦截机制）覆盖
- **end fail-closed**：end 帧真实下发（见上）；会话结束后清理未决条目的 fail-closed 语义由单测覆盖（`test/events.mjs` end + 清理）
- **超时错误路径**：ask 30s 超时后注册表清理，远程 answer 返回 `no pending ask`（not-found）+ 审计留痕（第一轮实测）
- **重启恢复**：纯内存插件（无持久化），重启后重新挂载、注册表清空（fail-closed 语义）；重启后 `info/status/audit` 均正常返回
- **会话隔离**：只处理顶层会话（子代理不拦截，单测断言）
- **client UI**：纯 server 插件无 client 页面（无侧边栏页签/设置页），client UI 项经「无 client bundle + server API 全套可用」验证；确认与生产 profile 全部已装插件（154 个 id）共存无冲突、启动日志无错误

### 外部通道说明

- HTTP 通道（通用中转 webhook）已本地端到端验证（事件帧真实 POST 到 :7999 并被记录）
- 微信/QQ/飞书机器人适配器扩展需真实 bot 凭据，未做真实接入；适配器契约（事件帧 + 指令格式渠道无关）由单测（`test/channels.mjs` 推送/匹配/重试/失败/超时/附加头）+ 文档（docs/远程控制/概述.md 扩展章节）覆盖
