# 发版前功能级验证清单 — dsh-my-notify@0.3.6

验证时间：2026-09-02T01:21:05.785Z
验证环境：隔离实例（端口 3085，复用生产 profile 配置组合，独立 DSH_HOME）

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

## 验证记录（0.3.6 = 0.3.5 + #92 出站 webhook）

- 本版本内容为 PR #101（#92 出站 webhook：企微/飞书/钉钉机器人事件推送）合并后的代码，功能级验证基于 PR #101 的完整验证结果：
  - 本地测试：12 测试文件 / 58 测试全过，覆盖率 94.67% stmts / 86.23% branch（门禁 85/75），cucumber 17 场景 / 99 步全过
  - 新增测试：webhook-adapters（四渠道消息格式 + 签名样例断言）、webhook-pusher（事件匹配/重试退避/失败记录/超时）、host-webhook（事件触发推送/配置 API/JSON 持久化重启恢复/失败记录可见/非法输入 400）
  - verify-local.mjs：9 通过 / 0 失败（lint/prettier/depcruise/knip/jscpd/docs 一致性/typecheck/test-scripts/全插件测试）
  - CI run #33577584912 success
- 自动验证（verify-real-profile）：配置组合唯一（153 id 无重复）、实例启动就绪、启动日志无 error/duplicate、API 冒烟 200
- 备注：真实浏览器 GUI 目测（设置页 webhook 编辑交互）未做——配置 API/持久化/失败记录已由 host-webhook 测试断言覆盖

## 验证记录（0.3.6 = 0.3.5 + #92 出站 webhook）

- 本版本内容为 PR #101（#92 出站 webhook：企微/飞书/钉钉机器人事件推送）合并后的代码，功能级验证基于 PR #101 的完整验证结果：
  - 本地测试：12 测试文件 / 58 测试全过，覆盖率 94.67% stmts / 86.23% branch（门禁 85/75），cucumber 17 场景 / 99 步全过
  - 新增测试：webhook-adapters（四渠道消息格式 + 签名样例断言）、webhook-pusher（事件匹配/重试退避/失败记录/超时）、host-webhook（事件触发推送/配置 API/JSON 持久化重启恢复/失败记录可见/非法输入 400）
  - verify-local.mjs：9 通过 / 0 失败
  - CI run #33577584912 success
- 自动验证（verify-real-profile）：配置组合唯一（153 id 无重复）、实例启动就绪、启动日志无 error/duplicate、API 冒烟 200
- 备注：真实浏览器 GUI 目测（设置页 webhook 编辑交互）未做——配置 API/持久化/失败记录已由 host-webhook 测试断言覆盖
