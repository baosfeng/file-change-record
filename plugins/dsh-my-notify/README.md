# dsh-my-notify

[![插件生态](https://img.shields.io/badge/插件生态-topic%20dsh-4d6bfe)](https://github.com/topics/dsh)

<div align="center">
  <img alt="远程触发通知：页面右下角 toast 卡片（通知权限未授予时的兜底呈现）" src="https://unpkg.com/dsh-my-notify/assets/notify-toast.png" width="640" />
</div>

**DSH 通知提醒插件**：在**会话（本轮对话）结束**、**agent 询问问题**（`ask_user_question`）、**等待你要批准**（审批请求）时，发出**浏览器系统通知 + 提示音（滴一声）**；点击通知直接**跳转到对应会话**。预留了**远程 hook 触发接口**——任意进程 / cron / CI / webhook 都能推送自定义通知。

## 功能

### 1. 三类自动触发（默认全开，可单独关闭）

| 触发类型               | 时机                                              | 通知内容                                   |
| ---------------------- | ------------------------------------------------- | ------------------------------------------ |
| **结束**（`end`）      | `agent/status` 变为 idle（本轮对话完成 / 被中断） | 会话标题 + 「会话已结束」                  |
| **询问**（`ask`）      | agent 调用 `ask_user_question` 工具               | 会话标题 + 「需要你回答」+ 问题摘要        |
| **审批**（`approval`） | 出现需要用户批准的请求（如沙箱、文件操作）        | 会话标题 + 「等待你的批准」+ 工具名 / 原因 |

- **自动过滤子代理（subagent）会话**：只提醒用户直接查看的顶层会话，不打扰子代理批量完成；判定白名单化（`origin` / `delegationDepth` / 运行时 `subagentDepth` 任一命中即子代理，无法确认的会话保守视为子代理）。配置 `subagentEnd: true` 后子代理完成也提醒，通知标题带「子代理」前缀，与主会话一眼区分。
- **同类去重**：同一会话同一类型 3 秒内只提醒一次，避免重复弹窗。

### 2. 通知呈现（Client 端）

- **系统通知**（Notification API）：标题 = **会话标题**，正文 = 类型 + 摘要（如「需要你回答 · 选择方案」）；
- **点击通知 → 聚焦窗口并打开对应会话**（`ctx.sessions.open`）；
- **提示音**：Web Audio 合成短促「滴」声（880 Hz / 0.22 s，无音频文件）；受浏览器自动播放策略约束，首次与页面交互后解锁；
- **页面内 toast 兜底**：通知权限被拒 / 关闭系统通知时，右上角弹出提示卡（点击同样跳转）；
- **本地开关**（localStorage，默认全开）：

| 键                  | 值  | 含义             |
| ------------------- | --- | ---------------- |
| `dsh-notify:notify` | `0` | 关闭系统通知     |
| `dsh-notify:sound`  | `0` | 关闭提示音       |
| `dsh-notify:toast`  | `0` | 关闭页面内 toast |

（可随时在浏览器控制台 `localStorage.setItem('dsh-notify:sound','0')` 关闭。）

### 3. 远程 hook 扩展接口

`POST /notify/api/trigger` —— 任何本机进程、cron 定时任务、CI 流水线、其他插件都能触发通知：

```bash
# 本机触发（loopback 信任围栏）
curl -X POST http://127.0.0.1:3080/notify/api/trigger \
  -H 'content-type: application/json' \
  -d '{"title":"CI 构建完成","body":"构建成功，可发布","sessionId":"session-xxx"}'
```

- `sessionId` 可选：填写后点击通知可跳到该会话；
- **远程主机触发**：在插件配置中设置 `apiToken`，请求需带 `x-notify-token` 头（适用于经反向代理暴露给远程服务的场景）：
  ```bash
  curl -X POST https://your-dsh/notify/api/trigger \
    -H 'content-type: application/json' \
    -H 'x-notify-token: <你的 token>' \
    -d '{"title":"部署完成","body":"staging 已更新"}'
  ```
- 后续扩展（监听任意 DSH 事件、出站 webhook 等）都建议复用该接口 + 同一条 SSE 通道，互不干扰。

## 工作原理

- **Server 端**（`lib/index.js`）：
  - 监听 `agent/status`（idle → `end`）、`tools/pre-execute`（`ask_user_question` → `ask`，透传 `next()` 不影响工具执行）、`approval/request`（→ `approval`，透传 `next()` 不影响审批流程）；
  - 通过 `webServer.register` 提供 `/notify/api` 前缀路由：`GET /stream`（SSE 长连接，EventSource 消费，25s 心跳）、`POST /trigger`（远程触发）、`GET /info`（开关状态）；
  - 所有请求先过 **loopback 信任围栏**（与 DSH `/api` 网关一致契约）；配置 `apiToken` 后 trigger 再校验 `x-notify-token`；
  - 可选服务（`webRuntime` / `sessionTitle`）经 `ctx.get` 读取——`sessionTitle` 提供真实会话标题，缺失时回退工作目录名 / 会话短 id。
- **Client 端**（`lib/client.js`）：`EventSource('/notify/api/stream')` 实时接收帧 → 系统通知 / 提示音 / toast → 点击跳转；样式走 DSH 语义 token，随 fiber 卸载（无残留）。

## 安装

> 💡 **npm 安装（普通用户推荐）**：`dsh plugin --profile web add dsh-my-notify`——无需克隆本仓库；以下 link 方式供本仓库开发者使用。依赖 `dsh-shared`（server 端共享工具包）随 npm 自动安装，无需手动处理。

```bash
# 1) 克隆本仓库（任意目录）
git clone https://github.com/baosfeng/my-dsh-plugins.git
# 2) 以本地 link 方式安装（将 <仓库路径> 替换为上面的克隆目录）
dsh plugin --profile web add link:<仓库路径>/plugins/dsh-my-notify
```

- server 端改动需重启 `dsh web`；client 端改动浏览器硬刷新（Cmd/Ctrl+Shift+R）即可。

## 配置

插件级配置（`cordis.patch.yml` 对应插件行的 `config` 字段，均为可选）：

```yaml
- insert:
    - id: notify
      name: 'dsh-my-notify'
    - config: # 传给 apply(ctx, config)
        end: true # 会话结束提醒（默认 true）
        ask: true # 询问提醒（默认 true）
        approval: true # 审批提醒（默认 true）
        subagentEnd: false # 子代理完成也提醒（默认 false；开启后标题带「子代理」前缀）
        apiToken: '' # 远程触发 token；非空时 trigger 需 x-notify-token 头
        dedupeMs: 3000 # 同类去重窗口（毫秒，默认 3000）
```

### 设置页可视化（推荐）

所有配置项也可在 **设置 → 插件 → 通知提醒** 页签中可视化查看和编辑（官方 slots 扩展点，无需手动编辑配置文件）：

- **触发开关**：会话结束 / 询问 / 审批 / 子代理完成 四个开关；
- **高级**：远程触发 Token（文本）、去重窗口（毫秒，数字）；
- 点击「保存」即生效（写入 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`，DSH 热重载 + 内存即时更新），重启不丢。

## 依赖

| 依赖                             | 用途                                                     | 可选               |
| -------------------------------- | -------------------------------------------------------- | ------------------ |
| `cordis`                         | 插件运行时                                               | 是（宿主提供）     |
| `@deepseek-ai/dsh-session-title` | 会话标题读取（缺失时回退）                               | 是                 |
| `dsh-shared`                     | server 端共享工具包（信任围栏 / HTTP JSON / 配置持久化） | 否（npm 自动安装） |

## 限制与说明

- **通知权限**：浏览器首次收到通知时会发起权限请求（此时用户正好需要它）；拒绝后自动用页面内 toast 兜底。
- **自动播放策略**：提示音需用户与页面有过至少一次交互（点击/按键）后才能发声，这是浏览器安全限制。
- **SSE 会话**：多标签页同时打开时全部收到通知；EventSource 断线自动重连（3s）。

## 相关文档

→ [通知提醒模块文档](../../docs/通知提醒/概述.md) · [需求清单](../../docs/通知提醒/需求清单.md) · [CHANGELOG](CHANGELOG.md)
