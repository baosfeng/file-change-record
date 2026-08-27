# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-08-27

### 变更

- **npm 包名改为 `dsh-my-guardian`**：`bsfeng-dsh-guardian` → `dsh-my-guardian`，与 `dsh-my-*` 系列（dsh-my-skill-manager / dsh-my-plugin-manager / dsh-my-memory）统一，目录名 = 包名 = tag 名，避免与 npm 上他人同名包（`dsh-guardian`，lss1213）混淆。安装命令变为 `dsh plugin --profile web add dsh-my-guardian`。API 路径（`/guardian/api/*`）、状态文件路径（`$DSH_HOME/guardian/state.json`）、插件行 id（`guardian`）保持兼容。

## [0.3.0] - 2026-08-26

### 变更

- refactor(guardian): 移除 dsh-better-sidebar 第三方依赖（#22）
- docs+test: 全面审查修复——文档同步补全 + mermaid 测试增强

## [0.2.1] - 2026-08-25

### 变更

- **npm 页面元数据优化**：description 改为中英双语（中文在前）；README 效果截图引用改为绝对 URL（unpkg），npm 包页面可直接显示图片。

## [0.2.0] - 2026-08-25

### 变更

- **npm 包名改为 `bsfeng-dsh-guardian`**：npm 上 `dsh-guardian` 已被他人占用（lss1213 的插件），按用户确认改为 bsfeng 前缀。安装命令变为 `dsh plugin --profile web add link:<仓库路径>/plugins/dsh-guardian`（link 安装 key 同步）。API 路径（`/guardian/api/*`）与状态文件路径（`$DSH_HOME/guardian/state.json`）保持兼容。
- **Server 端按 P2 模块拆分**：`lib/index.js`（636 行）拆分为 state/fence/events/mount/api 子模块；**Client 端方案 B 拆分**（src 模板 + 5 片段 + build 拼接）。
- **README 补充真实 DSH 实例效果截图**（assets/panel-main.png + panel-error-detail.png，隔离实例实测）。
- 行为不变（重构 + 改名）。

## [0.1.0] - 2026-08-23

### Added

- 插件治理（dsh-guardian）首个版本：
  - **两段式加载**：新插件写入候选区 `cordis.staged.json`（与 `cordis.patch.yml` 同目录），DSH 启动完成后由守护插件逐个热挂载，不阻塞启动。
  - **失败隔离**：候选插件挂载失败自动记录（尝试次数 + 错误），连续失败 3 次冻结，不再自动重试。
  - **成功转正**：挂载成功的插件自动进入守护插件的持久化清单（`$DSH_HOME/guardian/state.json`），后续每次启动自动恢复。
  - **安全模式**：一键跳过所有候选/已转正插件的加载，快速恢复被插件搞坏的环境。
  - **诊断面板**：dsh-better-sidebar 侧边栏页签（状态列表 / 重试 / 移除 / 错误详情 / 安全模式开关）。
  - **事件监控**：`hmr/config-update-failed`、`loader/entry-init`、`loader/partial-dispose` 诊断事件记录。
  - HTTP API `/guardian/api/*`（loopback 信任围栏）。
