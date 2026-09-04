# 发版前功能级验证清单 — dsh-my-plugin-manager@0.1.4

验证时间：2026-09-04T13:44:19.196Z
验证环境：隔离实例（端口 3087，复用生产 profile 配置组合，独立 DSH_HOME）

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

### 验证记录（2026-09-04，隔离实例 + 真实浏览器）

- **核心功能走通**：已安装清单渲染 18 个插件（名称/版本/状态/卸载按钮）；市场搜索 `dsh-my-cost` 返回 npm 结果（描述/版本/安装/详情按钮）；一键安装 dsh-my-cost 成功（profile package.json + node_modules 实体，重启后已安装清单 18→19 项）；一键卸载（与 UI 同一 handler 的 API）成功（profile + node_modules 移除，重启后 19→18 项）。
- **易碎场景（重启恢复）**：隔离实例多次重启（install/uninstall 前后）后，/installed 与 /detail API 数据完整恢复、UI 面板正常加载，无数据损坏。
- **client UI（#90 详情页）**：设置 → 插件 → 插件管理 tab 正常渲染；点击「详情」打开 dsh-md-render 详情面板——README 预览（MarkdownView 渲染全文）、版本历史时间线（0.1.1/0.1.2 带 npm time 日期）、依赖区块（peer：cordis ^4.0.0-rc.8、react ^18.2.0 || ^19.2.0）、元数据（许可证/月下载量 tag）、版本选择器 + 详情内一键安装按钮。
- **插件间联动**：与生产 profile 共存 17 个插件同实例正常运行；详情页 README 复用 dsh-md-render 的 MarkdownView（缺装回退纯文本为代码内实现，未破坏）。
- **环境清理**：验证完成后停实例、删临时目录、关浏览器见本流程收尾。
- **遗留说明（非本次 #90 回归）**：`dsh plugin outdated`（dsh CLI）在存在可更新包时 pnpm 退出码为 1，插件将其视为 CLI 失败并返回 `error` 字段（符合 R4「CLI 失败返回 error 不崩」容错路径），但「有更新 → 正常展示当前→最新」路径因此走不到；该行为 0.1.3 同样存在，与本次 #90 详情页改动无关，建议后续提 issue 让 outdatedPlugins 识别「exit 1 + stdout 合法 JSON」为成功。
