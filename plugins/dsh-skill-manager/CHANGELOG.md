# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-08-27

### 变更

- feat(skill-manager): 项目视图只显示项目 skill，支持刷新与扫描诊断（issue #29）

## [0.1.0] - 2026-08-26

### Added

- Skill 管理插件（issue #23）：
  - 分「全局 / 项目」查看 skill 列表（名称 / 描述 / 来源 / 状态）；
  - 按项目启用/禁用：全局配置 `$DSH_HOME/skills.enabled.json`，项目配置 `<项目根>/.dsh/skills.enabled.json`（随仓库版本化）；
  - 禁用机制：rank-0 占位 provider 覆盖被禁用 skill（模型不可见、不可加载），按会话 cwd 解析项目配置实现项目覆盖全局；
  - 设置页面板：官方 slots 扩展点（设置 → 插件 → Skill 管理），纯官方依赖；
  - 配置保存后 catalog 自动失效重算，即时生效。
