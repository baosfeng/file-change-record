# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
