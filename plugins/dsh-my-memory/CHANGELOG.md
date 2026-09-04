# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `memory_save` 工具（issue #107）：agent 主动保存记忆（`scope`/`desc` 必填、`cwd` 可选），每次调用经 `tools/pre-execute` 确认门触发 DSH 原生审批（`{ kind: 'ask' }`），用户确认后才写入——记忆绝不静默变更；保存后 `memory_query` 立即可查、后续会话注入生效；`proactivePropose` 配置预留（默认关，#78 阶段）。
- 测试：工具注册（schema 硬规则）/ 确认门（ask gate + 透传）/ 写入生效（save → query 联动）/ saveToolDescription 开关；Gherkin 场景 6-8。

### Changed

- **项目记忆集中存储（issue #108）**：项目记忆从 `<项目根>/.dsh/memory.json` 迁移到 `$DSH_HOME/memory/projects/<项目 id>.json`（项目 id = 项目根路径 sha256 前 12 位），项目目录不再产生 `.dsh/`、数据统一备份/迁移；既有旧位置数据在首次访问该项目时自动迁移到新位置（复制 → 清理旧文件与空 `.dsh` 目录），记忆不丢失。
- 测试：迁移逻辑单测（复制/清理/跳过）+ 首次访问自动迁移集成断言 + 真实性路径保存断言改写。

## [0.1.2] - 2026-09-01

### 变更

- fix(ui): 9 个插件未定义 token danger-primary 改用 error-primary（DSH 主题仅定义 business/error/success/warn）

## [0.1.1] - 2026-08-28

### 变更

- feat(ui): dsh-my-memory 设置页翻新——图标/前缀/状态/交互（issue #54）
- refactor(shared): 抽取 dsh-shared 共享工具包，10 个插件迁移消除重复实现（issue #45）
- chore(deps): 升级 react 19 兼容性——13 个插件 peer 声明 ^18.2.0 || ^19.2.0（issue #49）
- style(format): 全仓 prettier 格式化（issue #44）
- fix(lint): 修复 dsh-my-memory 测试文件未使用变量（saveEditBtn / Given，CI lint 失败）

## [0.1.0] - 2026-09-03

### Added

- 记忆插件（issue #38）：
  - 全局/项目两级记忆：全局 `$DSH_HOME/memory.json` + 项目 `<项目根>/.dsh/memory.json`（按 cwd 向上找 `.git` 定位项目根），原子写（tmp+rename）+ 防抖（300ms 合并写盘）+ 启动恢复；
  - 系统提示词注入：`dsh-my-memory` section（order -95，persona 之前），每次组装系统提示词时注入全局记忆（`maxItems` 条数上限 + `maxDescLength` 长度上限，空记忆零成本）；
  - 设置页面板：官方 slots 扩展点（设置 → 插件 → 记忆），全局/项目分区显示（项目蓝色 accent + 项目根徽标），支持新增/修改/删除；
  - 写操作需用户确认：自定义确认 UI（基于 ask 改造，不用原生 confirm）——删除红色醒目 + 二次确认、保存/新增绿色确认；服务端强制 `confirmed: true` 标记，缺失即 400；
  - `memory_query` 只读工具：全局/项目过滤 + 关键词过滤，项目 cwd 取会话工作目录；
  - 纯官方依赖（不依赖 dsh-better-sidebar）。
