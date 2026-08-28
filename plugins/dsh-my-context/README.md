# dsh-my-context

[![插件生态](https://img.shields.io/badge/插件生态-topic%20dsh-4d6bfe)](https://github.com/topics/dsh)

<div align="center">
  <img alt="上下文透镜面板：概览卡片（累计 token / KV 缓存命中率）+ 上下文构成条 + 请求记录 + 预算告警 + 预算设置" src="https://unpkg.com/dsh-my-context/assets/context-panel.png" width="640" />
</div>

**DSH 上下文透镜 + 成本治理插件**：**上下文透镜**统计每次请求的 token 用量与上下文构成（system / tools / user / 注入 / assistant / 工具结果），KV 缓存命中率可视化，按会话隔离、重启后恢复；**成本治理**提供每轮 / 每会话 token 预算配置，超限提醒（warn）或拦截（deny）。

## 功能

### 1. 上下文透镜（token 用量可视化）

Server 端监听 `session/event` 统计每次请求的上下文：

| 事件                | 统计内容                   | 说明                                                                                                                              |
| ------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `request/header`    | system prompt + tools 估算 | 与 dsh token-meter 一致的固定密度估算（~4 字符 ≈ 1 token + 4/block + 4/role）                                                     |
| `assistant/message` | 真实 usage                 | `inputTokens` / `outputTokens` / `cacheReadTokens` / `cacheWriteTokens`（disjoint 计数，prompt = input + cacheRead + cacheWrite） |
| `user/message`      | user / 注入构成            | 注入来源（source.kind 非 user 或带 form）计入 inject 分类                                                                         |
| `tool/result`       | tool 构成                  | 工具结果消息估算                                                                                                                  |
| `request/context`   | 模型 / 上下文窗口          | contextWindow 展示                                                                                                                |

- **KV 缓存命中率**：`cacheRead / (input + cacheRead)`，长会话的缓存收益一目了然；
- **上下文构成**：按 system / tools / user / inject / assistant / tool 六类拆分，每次请求快照构成；
- **会话隔离**：统计按会话分桶，切换会话互不串扰；
- **重启恢复**：持久化到 `$DSH_HOME/context/context.json`（防抖 + 原子写），重启后完整恢复；
- **防膨胀**：每会话请求记录最多 500 条（FIFO 淘汰）、告警 50 条。

### 2. 成本治理（预算控制）

- **token 计量**：真实 usage 累加（input / output / cacheRead / cacheWrite / reasoning）；
- **预算配置**：每轮（perTurn）/ 每会话（perSession）token 上限（0 = 不限制）+ 模式；
- **超限提醒（warn）**：记录预算告警，不打断 agent 流程；
- **超限拦截（deny）**：`agent/pre-step` waterfall 返回 `{ kind: 'reject' }`，优雅结束本轮（blocked），不破坏 agent 循环；
- **告警冷却**：同一会话同一 scope 60s 内不重复告警（防刷屏）；
- **动态配置**：`POST /context/api/budget` 随时更新预算（面板保存或 API）。

### 3. 上下文透镜面板（侧边栏）

侧边栏「上下文透镜」页签（`dsh-my-context:context`）：

- **概览卡片**：累计 token（输入 / 输出 / 缓存命中）+ KV 缓存命中率 + 模型 + 上下文窗口；
- **上下文构成条**：六类构成占比（水平条形图）；
- **请求记录列表**：每次请求的轮/步、prompt / output token、缓存命中率；
- **预算设置**：每轮 / 每会话上限 + 提醒 / 拦截模式 + 保存；
- **预算告警列表**：超限记录（scope / used / limit / 提醒或拦截）。

面板可见时 5s 轮询、隐藏时暂停（省请求）。

## 工作原理

- **Server 端**（`lib/index.js`）：`events.js` 监听 `session/event`（统计）+ `agent/pre-step`（预算拦截）；`meter.js` token 估算纯函数；`budget.js` 预算检查纯函数；`store.js` + `persist.js` 会话统计持久化；`routes.js` 提供 `/context/api` 路由（全部经 loopback 信任围栏）。
- **Client 端**（`lib/client.js`）：侧边栏页签 `dsh-my-context:context`（概览 + 构成 + 请求 + 预算），样式走 DSH 语义 token，随 fiber 卸载无残留。

> 📌 **调研结论**：DSH 核心**没有 `llm/request` 事件**（dsh-llm / dsh-agent-loop / dsh-session 均无）。token 计量改用 `session/event` 通道的 `assistant/message`（携带真实 usage），预算拦截用 `agent/pre-step` waterfall（返回 `{ kind: 'reject' }`）。

## 安装

> 💡 **npm 安装（普通用户推荐）**：`dsh plugin --profile web add dsh-my-context`——无需克隆本仓库；以下 link 方式供本仓库开发者使用。

```bash
# 1) 克隆本仓库（如已克隆可跳过）
git clone https://github.com/baosfeng/my-dsh-plugins.git

# 2) 以本地 link 方式安装（将 <仓库路径> 替换为上面的克隆目录）
dsh plugin --profile web add link:<仓库路径>/plugins/dsh-my-context
```

安装后重启 `dsh web`（server 端改动需重启；client 端改动浏览器硬刷新 Cmd/Ctrl+Shift+R）。

## 配置

插件配置（`cordis.yml` 中 `my-context` 行的 `config:` 块，均可省略）：

| 配置项       | 默认值   | 说明                                |
| ------------ | -------- | ----------------------------------- |
| `perTurn`    | `0`      | 每轮 token 上限（0 = 不限制）       |
| `perSession` | `0`      | 每会话 token 上限（0 = 不限制）     |
| `mode`       | `'warn'` | 超限行为：`warn` 提醒 / `deny` 拦截 |

也可在侧边栏面板「预算设置」中动态修改（`POST /context/api/budget`）。

## 与现有插件的关系

- **dsh-my-observability**：它记录 agent 行为审计（事件轨迹），本插件统计上下文占用与 token 成本——互补不冲突；
- **dsh-task-reliability**：它接管 `agent/request-error` 重试与 turn-stopping，本插件只读 `session/event` + `agent/pre-step`（warn 模式透传、deny 模式返回 reject）——互不干扰；
- **dsh-my-guard**：它监听 `tools/pre-execute` 与 `user/message`，本插件监听 `session/event` 与 `agent/pre-step`——事件通道不同，无冲突。

## 开发

```bash
cd plugins/dsh-my-context
npm test          # vitest 单元测试 + 覆盖率 + cucumber Gherkin 验收
node scripts/build.mjs   # 重新构建 lib/client.js（改 client.src.js / parts 后）
```
