# dsh-task-reliability

> DSH 插件：任务可靠性保障 —— 模型超时/请求失败自动重试、任务未完成自动继续、思考重复检测干预、休眠/重启后任务恢复、独立完成度校验 agent、自主决策模式（出行防中断）、远程触发接口。

![任务可靠性面板](https://unpkg.com/dsh-task-reliability/assets/screenshot-panel.png)

## 功能

| 能力 | 说明 |
|------|------|
| **任务注册表** | 手动注册/自动跟踪任务，持久化到 `$DSH_HOME/task-reliability.json`（原子写 + 防抖） |
| **超时/失败自动重试** | `agent/request-error` 接管 TIMEOUT / ETIMEDOUT / ECONNRESET / TRANSPORT 等瞬态失败，指数退避 + 次数上限 |
| **任务自动继续** | 回合即将结束时，存在活动任务则注入继续指令（含防死循环护栏：循环上限/冷却/全局速率限制） |
| **完成度校验 agent** | 开启校验模式后，会话结束后用**独立 agent** 判断任务是否真正完成，未完成自动唤醒继续（带校验结论） |
| **思考重复干预** | 检测 reasoning 段落重复（n-gram 相似度），终止循环回合并注入分级打断指令 |
| **休眠/重启恢复** | 插件启动时扫描活动任务，`agents.resume` 恢复会话并注入「继续完成之前的任务」 |
| **自主决策模式** | 出行模式：拦截 `ask_user_question` 自动决策，问题收集到待确认列表（回来后可批量回答）；审批策略切换为自动批准 |
| **远程触发接口** | `POST /task-reliability/api/trigger`（loopback 信任围栏 + 可选 token），支持注册任务 / 切换模式 / 回答待确认问题 / 查询状态 |

## 安装

> 💡 **npm 安装（普通用户推荐）**：`dsh plugin --profile web add dsh-task-reliability`——无需克隆本仓库；以下 link 方式供本仓库开发者使用。


```bash
dsh plugin --profile web add link:<本目录绝对路径>
```

## 使用

1. **注册任务**：侧边栏「任务可靠性」页签 → 输入任务描述 → 注册（默认当前会话）；或在任意会话 `agent` 执行中通过远程 hook 注册。
2. **开启校验**：页签内打开「完成度校验」开关 —— 会话结束后独立校验 agent 判断完成度，未完成自动继续。
3. **出行模式**：页签内打开「自主决策」开关（或 `POST /task-reliability/api/trigger` 远程开启）—— 之后 agent 不会再 ask 打断你，被拦截的问题进入「待确认问题」列表，回来后可批量回答。
4. **远程触发**：

```bash
curl -X POST http://127.0.0.1:3080/task-reliability/api/trigger \
  -H "Content-Type: application/json" \
  -d '{"action":"mode","autopilot":true}'
```

## 配置

| 字段 | 默认 | 说明 |
|------|------|------|
| `apiToken` | 空 | 远程接口令牌；配置后 trigger/mode/answer 要求 `x-task-reliability-token` 头 |
| `retryMax` | 3 | 单次模型请求失败重试上限 |
| `maxLoop` | 8 | 每任务自动继续次数上限（防死循环） |
| `maxVerify` | 3 | 每任务完成度校验次数上限 |
| `retryableCodes` | TIMEOUT/ETIMEDOUT/… | 触发自动重试的错误码集合 |
| `autopilot` | false | 默认自主决策开关 |

## 安全

所有 `/task-reliability/api/*` 路由先做 loopback 信任围栏（与 DSH `/api` 网关契约一致），非本机来源一律 403；配置 `apiToken` 后，远程动作（trigger / mode / answer）额外要求 token 头。

## 需求与测试

- 需求清单见 [docs/任务可靠性/需求清单.md](../../docs/任务可靠性/需求清单.md)
- 测试：`npm test`（vitest 单元 + 覆盖率门禁 + cucumber 验收），`npx stryker run`（变异测试 ≥70%）

## License

MIT
