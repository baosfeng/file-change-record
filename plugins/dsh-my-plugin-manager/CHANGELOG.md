# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-08-27

### 变更

- **包名改名**：`dsh-plugin-manager` → `dsh-my-plugin-manager`（npm 包名被其他开发者同名插件占用，统一 `dsh-my-*` 前缀规避冲突，issue #37）
- feat(plugin-manager): 「已安装」列表只显示用户安装的插件，过滤官方插件（issue #28）

## [0.1.0] - 2026-08-26

### Added

- 公共插件管理面板（issue #2）：
  - 已安装插件清单（官方 pluginInventory + 版本解析，支持 scoped 包）与逐行卸载；
  - 更新检查（`pnpm outdated --json` 解析，展示 `当前 → 最新`）；
  - 市场搜索（npm registry search API）与一键安装（`dsh plugin --profile <p> add`）；
  - 设置页面板：官方 slots 扩展点（设置 → 插件 → 插件管理），纯官方依赖；
  - API 信任围栏（loopback/可信 host）与参数校验。
