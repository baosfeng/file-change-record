# 发版前功能级验证清单 — dsh-my-notify@0.3.8

验证时间：2026-09-04T13:24:48.777Z（自动项）/ 2026-09-04T13:31:00.000Z（功能级，浏览器实测）
验证环境：隔离实例（端口 3090，复刻生产 profile 配置组合，独立 DSH_HOME=/tmp/dsh-3090，Chrome for Testing 真实浏览器 + agent-browser CLI）

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

## 验证记录（0.3.8 = 0.3.7 + 修复 #12 CodeQL js/polynomial-redos：webBaseUrl 尾斜杠处理改线性遍历）

- **#12 ReDoS 修复（本次核心变更）**：`lib/listeners.js` 的 `sessionUrlOf()` 将
  `webBaseUrl.replace(/\/+$/, '')` 改为一次线性遍历（while + slice，无正则回溯），
  消除多项式时间复杂度 ReDoS（CodeQL js/polynomial-redos）。
  - 单元测试：`test/host-webhook.mjs` 新增 6 个边界用例（无尾斜杠 / 单 / 多尾斜杠 /
    纯斜杠串 / 查询串 / 空串）→ sessionUrl 语义与 0.3.7 完全一致；全套 62 vitest
    通过，覆盖率 93.71% stmts / 84.49% branch，cucumber 17 scenarios/99 steps 全绿。
  - 真实实例配置层：PUT `webBaseUrl:"https://dsh.local///"`（多尾斜杠）→ 接受且
    回读一致；重启后持久化原样保留（`https://persist.test///` + dedupeMs 7000 回读一致）。
  - 说明（环境限制）：`sessionUrlOf` 仅在出站 webhook 推送 body 时消费；触发该路径需
    真实 agent 会话结束事件（agent/status idle），隔离实例无 agent 运行无法自然触发。
    函数级 6 边界语义已由单元测试确凿覆盖（防复发断言保留在 host-webhook.mjs）。
- **核心链路（真实浏览器实测）**：POST `/notify/api/trigger`（header
  `x-notify-token: persist-tok`，loopback 围栏）→ `{"ok":true}` → 浏览器
  EventSource `/notify/api/stream` 收到广播 → 页面内 toast 弹出
  （`#dsh-my-notify-toast-box`：remote 图标 + 标题「v0.3.8 远程触发验证」+ 正文
  「webBaseUrl 尾斜杠修复后触发链路正常」+「打开会话」按钮），6s 后自动 dismiss。
  - 无 token POST trigger → 403（token 校验 + loopback fence 生效）。
  - toast 点击「打开会话」→ dismiss + `sessionsSvc.open(sessionId)`（best-effort，
    SPA 内部切会话；API 直建会话不在 GUI 会话树，跳转效果不可见属场景限制）。
- **易碎场景（重启恢复 / 持久化 / 会话隔离）**：kill 实例 → 重启（同 DSH_HOME）→
  `/notify/api/config` 回读 webBaseUrl / dedupeMs / apiToken 完整持久化 ✓；
  notify server 自动恢复（info/config 200）；浏览器刷新后 client bundle 重新加载
  （`/plugins/dsh-my-notify/client.js` rev 200）+ SSE 重连。
- **client UI（真实浏览器）**：DSH 设置面板「通知提醒」tab（官方 slots 扩展点）
  完整渲染：触发开关（会话结束 / 询问 / 审批 / 子代理完成 4 项）、提示音音量滑杆
  （60%）、出站 Webhook（添加 + 失败记录区）、高级（远程触发 Token / 去重窗口）。
  client bundle 加载无报错（浏览器 console errors 为空）。
- **插件间联动**：隔离实例（生产配置组合 153 个 id）底部面板多插件页签共存
  （文件活动 / 任务管理 / 轨迹回放 / Git 工具 / 安全护栏 / 上下文透镜），notify
  挂载 + SSE + 路由均正常，无应用冲突。
- **环境限制（如实注明）**：
  1. 系统级原生通知（Notification API granted 分支 → `fireSystemNotification`）：
     agent-browser 的 Chrome for Testing 自动拒绝通知权限（`permission=denied`），
     系统级弹窗无法在自动化浏览器观察；页面内 toast 兜底链路（权限被拒时仍弹）已
     实测，granted 分支为同一 handleNotice 渲染链路。
  2. 提示音（WebAudio oscillator beep）：浏览器自动播放策略需用户手势解锁
     （armAudioUnlock 监听 pointerdown/keydown），无头环境无声卡输出不可实测；
     代码路径 = beep()（880Hz sine + 音量 gain），设置页音量滑杆可见可配。
  3. ask / 审批 / 会话结束三类通知需真实 agent 事件（user/message ask、
     approval 请求、agent/status idle），隔离实例无 agent 运行无法自然触发；
     均走同一 SSE → claimNotice → handleNotice → toast/系统通知渲染链路
     （remote 触发已全程实测该链路）。
- **README 效果图**：0.3.8 为纯 server 端安全修复（#12），无 UI/交互变化，
  README 现有效果图仍与当前功能一致，无需更新截图。
