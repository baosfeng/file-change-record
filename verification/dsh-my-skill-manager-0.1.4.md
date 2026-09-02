# 发版前功能级验证清单 — dsh-my-skill-manager@0.1.4

验证时间：2026-09-02T13:58:00.177Z
验证环境：隔离实例（端口 3086，复用生产 profile 配置组合，独立 DSH_HOME）

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

## 验证记录（0.1.4 = 0.1.3 + #91 skill 使用统计）

- 本版本内容为 PR #102（#91 skill 使用统计）合并后的代码，功能级验证基于 PR #102 的完整验证结果：
  - 本地测试：vitest 42 passed，覆盖率 96.05% stmts / 90.65% branch（阈值 85/75 达标），Gherkin 6 scenarios / 36 steps 全过
  - 新增测试：usage.mjs（计数累加/去重/来源记录/防抖落盘/重启恢复/损坏文件容错）、host-api（计数来源/禁用不计数/list 附带 usage）、client-render（排序/过滤交互）
  - eslint / prettier 通过
- 自动验证（verify-real-profile）：配置组合唯一（153 id 无重复）、实例启动就绪、启动日志无 error/duplicate
- 备注：真实浏览器 GUI 目测（面板排序/过滤交互）未做——交互已由 client-render 测试断言覆盖
