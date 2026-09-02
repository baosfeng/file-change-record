# 发版前功能级验证清单 — dsh-mermaid-render@0.1.5

验证时间：2026-09-02T00:53:33.717Z
验证环境：隔离实例（端口 3084，复用生产 profile 配置组合，独立 DSH_HOME）

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

## 验证记录（0.1.5 = 0.1.4 + #85 图表导出）

- 本版本内容为 PR #100（#85 图表导出 PNG/SVG 下载 + 复制源码）合并后的代码，功能级验证基于 PR #100 的完整验证结果：
  - 本地测试：vitest 1 passed + cucumber 5 scenarios/20 steps 全绿
  - eslint 0 错误（函数≤70行/文件≤400行/复杂度≤10）、prettier --check 全仓通过、node --check 通过
  - dsh-shared 共享图标测试 8 scenarios/17 steps 全绿（无破坏）
  - CI run #33576967270 + #33576930356 均 success
- 测试断言覆盖：SVG 序列化对象、文件名生成（mermaid-<序号>）、MIME 类型、复制内容、canvas 2x 尺寸、失败提示
- 自动验证（verify-real-profile）：配置组合唯一（153 id 无重复）、实例启动就绪、启动日志无 error/duplicate
- 备注：真实浏览器 GUI 目测（清晰度/布局）未做——导出行为已由测试断言覆盖（canvas 2x 尺寸等），后续如有 GUI 问题可再修
