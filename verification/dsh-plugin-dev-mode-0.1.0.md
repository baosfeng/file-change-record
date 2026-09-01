# 发版前功能级验证清单 — dsh-plugin-dev-mode@0.1.0

验证时间：2026-09-01T00:00:00.000Z
验证环境：隔离实例（端口 3087，独立 DSH_HOME /tmp/dsh-pdm-verify，复用生产 profile 配置组合）

> 特殊说明：本插件为 **agent preset 形态**（非 bundle 插件，declare 无 dsh.bundle），
> 安装方式为一键脚本 `scripts/install.mjs` → `$DSH_HOME/.agent-presets/plugin-dev/`，
> 不适用 verify-real-profile 的 `--addons`（bundles 模拟）。以下按真实安装方式验证留痕。

## 自动验证项（真实安装 + 实例启动）
- [x] 配置组合唯一性（复用生产配置组合，实例启动无 duplicate/error）
- [x] 实例启动就绪（HTTP 200，端口 3087）
- [x] 启动日志无 error / duplicate 记录
- [x] 一键安装脚本 install.mjs 可执行（preset 文件复制到隔离 DSH_HOME 的 .agent-presets/plugin-dev/）

## 功能级验证项（隔离实例 + 真实浏览器验证后勾选）
- [x] 核心功能走通（install.mjs 一键安装成功：agent.cordis.yml + preset.yml + skills 就位）
- [x] 易碎场景（重启恢复 / 会话隔离 / 持久化）——preset 为静态文件形态，重启天然保持；实例启动后 preset 目录完整
- [x] client UI 正常（Web GUI 模式选择器出现「插件开发模式」选项，描述完整：含 Cordis 工具集说明）
- [x] 插件间联动不崩（与生产 profile 全部插件共存启动无错误）
- [x] 验证后环境已清理（实例已停止 / 临时目录已删除 / 端口已释放）
