# Changelog

本文件记录 dsh-my-context 的所有版本变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-28

### 新增

- **上下文透镜（issue #51）**：监听 `session/event` 统计每次请求的 token 用量与上下文构成——`request/header`（system prompt + tools 估算，与 dsh token-meter 一致的固定密度：~4 字符 ≈ 1 token + 4/block + 4/role）、`assistant/message`（真实 usage：inputTokens/outputTokens/cacheReadTokens/cacheWriteTokens，disjoint 计数，prompt = input + cacheRead + cacheWrite）、`user/message`（user/inject 分类，注入来源计入 inject）、`tool/result`（tool 构成）、`request/context`（模型/上下文窗口）；KV 缓存命中率 = cacheRead / (input + cacheRead)。
- **统计持久化**：`$DSH_HOME/context/context.json`（防抖 500ms + 原子写 tmp+rename + teardown flush），启动异步加载（加载前变更缓冲不丢），重启后完整恢复；按会话隔离；请求记录 500 条 / 告警 50 条上限防膨胀。
- **成本治理**：每轮（perTurn）/ 每会话（perSession）token 预算配置（0 = 不限制）+ 模式（warn 提醒 / deny 拦截）；`agent/pre-step` waterfall 检查（total = input + output + cacheRead + cacheWrite），超限时 warn 记录告警透传 next()、deny 返回 `{ kind: 'reject' }` 结束本轮（blocked）；同一会话同一 scope 60s 告警冷却防刷屏；`POST /context/api/budget` 动态更新配置。
- **上下文透镜面板**：侧边栏页签 `dsh-my-context:context`（dsh-better-sidebar 服务）——会话选择 + 概览卡片（累计 token / KV 缓存命中率 / 模型 / 上下文窗口）+ 上下文构成条（六类占比）+ 请求记录列表（轮/步、prompt/output、缓存命中率）+ 预算设置（每轮/每会话上限 + 模式 + 保存）+ 预算告警列表；可见时 5s 轮询、隐藏时暂停。
- **查询接口**：`GET /context/api/session?sessionId=`（会话统计详情）、`GET /context/api/sessions`（会话列表）、`GET /context/api/status`（状态 + 预算配置）、`GET /context/api/alerts`（预算告警）；全部经 loopback 信任围栏。
- **测试**：`test/host-meter.mjs`（token 估算纯函数）、`test/host-budget.mjs`（预算检查/配置校验）、`test/host-store.mjs`（会话隔离/重启恢复/上限/持久化）、`test/host-events.mjs`（事件统计/预算拦截/告警冷却）、`test/host-mutation.mjs`（fence 变体/路由/边界）、Gherkin 验收（context.feature 8 场景）；覆盖率 行 98% / 分支 85%；变异测试 ≥70%。

**真实环境验证**（独立端口 3081 隔离实例）：
- 侧边栏「上下文透镜」页签出现，概览/构成/请求/预算展示正常；
- 与 dsh-task-reliability 等现有插件共存无冲突；
- 重启验证实例后统计恢复。
