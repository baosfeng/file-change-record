# 发版前功能级验证清单 — dsh-file-activity@0.5.6

验证时间：2026-09-04T13:25:58.994Z
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

## 验证记录（0.5.6 = 0.5.5 + #111 HTML 预览内容撑满浮窗）

- **#111 浮窗 HTML 预览内容撑满（隔离实例 3084 + agent-browser 实测）**：
  - 点击 demo.html（2829 字节长 HTML）打开浮窗预览 → iframe 高度 312px，浮窗主体 `.dfa-fp-body` 高 402px，iframe 底边（485.5）与 body 底边（495.5）对齐（差 = padding 10px），内容撑满浮窗、无下方深色留白 ✓
  - `.dfa-fp-body` 计算样式 = `display:flex; flex-direction:column; min-height:0; overflow-y:auto`（#111 修复内容实证）✓
  - 预览 / 编辑 模式切换：编辑模式替换 iframe 为 CodeMirror 编辑器（`.editorCm`），再切回预览 iframe 恢复且撑满依旧 ✓
  - 浮窗内 HTML 通过 `/sidebar/html/<session>/<path>` 沙箱渲染 ✓
- **文件事件记录（API 造数据 → GUI 展示全链路）**：
  - read：demo.html/config.json/new-created.js/readme.txt → 最近访问「读取」+ 文件统计计数 ✓
  - 新增/修改区分：`write` 首次 → create（新增），再次 `write` → modify（修改），`edit` → modify；GUI 显示「增 1 改 1」「读 5 增 1 改 2」与 PY/TXT/JS/{} 文件类型图标 ✓
- **重启恢复**：`pkill` 杀掉实例 → `$DSH_HOME/file-activity.json` 落盘（2 会话、knows/counts 完整）→ 重启 3084 → stats API 完整返回 + 浏览器刷新后面板记录完好 ✓
- **会话隔离**：会话 2 初始 recent 为空（不见会话 1 数据）；会话 2 造数据后仅自己可见；会话 1 stats 查不到会话 2 数据 ✓
- **client UI / 交互**：预览/编辑切换、点击浮窗外自动关闭（pointerdown 在 `.dfa-fp` 外，#76 回归 ✓）、Esc 关闭（#76 回归 ✓）、刷新按钮数据保持、清空按钮弹确认对话框「确定清空当前会话的全部文件活动记录？」接受后 recent/counts 清空 ✓
- **插件联动**：隔离实例（端口 3084）含 better-sidebar 等相邻插件共存无 JS 异常（console errors 为空；better-sidebar agent-terminals 流连接失败为隔离实例无对应后端流的预期现象，非插件问题）
- **测试**：vitest 96 passed（覆盖率 100/94.44）+ cucumber 59 scenarios/298 steps 全绿；node --check 通过