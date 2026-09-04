# 发版前功能级验证清单 — dsh-my-guardian@0.3.5

验证时间：2026-09-04T13:24:58.775Z
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

## 功能级验证详情（2026-09-04，隔离实例 3085 + 真实浏览器）

- **两段式加载**：候选区 POST 添加 `fake-simple`（合法 cordis 插件）→ 热挂载成功自动转正 promoted，status=running ✅
- **依赖预检 #86**：候选 `fake-needy`（peerDependencies 含不存在的 `fake-never-installed-dep`）→ 预检拦截，`failureType: dependency` + `missingDeps` + `installHint: dsh plugin add fake-never-installed-dep`，不进入挂载 ✅
- **可选依赖不阻断**：候选 `fake-opt`（optional peer 缺失）→ 预检通过进入挂载（挂载失败为 code 分类）✅
- **失败分类 R17**：dependency（预检拦截）/ code（fake-opt 挂载失败）两类均正确记录 ✅
- **失败自动禁用+记录+通知**：quarantine 事件日志 + attempts 累计 + FREEZE_LIMIT=3 自动冻结（重启后 staged 失败候选显示 frozen）✅
- **安全模式**：开启后卸载转正插件、新候选跳过；关闭后恢复挂载（fake-simple-2 转正）✅
- **重启恢复**：重启实例后 promoted 自动重挂载 running，staged 失败记录保留 frozen ✅
- **持久化**：state.json 原子写落盘，重启后状态完整恢复 ✅
- **client UI**：底部面板「插件守护」页签渲染候选/转正分区 + 安全模式开关 + 分类徽标（候选/转正/冻结/依赖缺失/代码错误/运行中）+ 安装建议行 + 错误详情展开（「缺少依赖 fake-never-installed-dep（请先安装）」）✅
- **插件联动**：与文件活动/任务可靠性/轨迹回放/Git 工具/安全护栏/上下文透镜等面板共存切换正常 ✅（#86 UI 截图已更新 assets/panel-main.png 与 panel-error-detail.png）
