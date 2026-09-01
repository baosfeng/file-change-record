# 发版前功能级验证清单 — dsh-my-notify@0.3.5

验证时间：2026-09-01T15:07:05.837Z
验证环境：隔离实例（端口 3081，复用生产 profile 配置组合，独立 DSH_HOME）

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

## 验证记录（issue #71 音量配置）

- 设置 → 插件 → 通知提醒 页签：音量滑杆（slider "提示音音量"）显示，默认值 0.6（localStorage 无值时 fallback）
- 键盘调节滑杆（ArrowLeft）：localStorage `dsh-notify:volume` 即时写入（0.3 → 0.25），百分比显示同步（25%）
- 刷新页面后重新打开设置：滑杆从 localStorage 恢复 0.25（持久化验证通过）
- 单元测试 `test/volume.mjs` 8 项全过（prefVolume 默认/读写/边界/非法回退、beep 峰值增益缩放、VolumeRow 渲染与 onChange）
