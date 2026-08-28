---
title: ADR-0001：插件统一 dsh-my-* 前缀命名（目录名 = 包名）
description: 记录 dsh-my-* 改名决策——bsfeng- 前缀历史、npm 包名冲突、目录名≠包名误解的来龙去脉
status: accepted
date: 2026-08-27
---

# ADR-0001：插件统一 dsh-my-* 前缀命名（目录名 = 包名）

## 状态

`accepted`（2026-08-27 决策并落地，本 ADR 为事后补记）

## 背景

本仓库为个人 DSH 插件集合（`plugins/<name>/` 多插件结构，2026-08-22 由单插件仓库重组而来，提交 `91d0e18`）。插件发布到 npm 时多次遭遇**包名被其他开发者占用**，被迫改名，且改名过程暴露了「目录名 ≠ 包名」的认知陷阱：

1. **首次撞名（2026-08-25，提交 `b695d24`）**：`dsh-notify`、`dsh-guardian` 的 npm 包名已被其他开发者的同名插件占用（maintainers：pasumao / lss1213，均为 DSH 生态独立项目）。用户 `dsh plugin add dsh-notify` 会装到别人的包，功能完全不同。被迫改名为 `bsfeng-dsh-notify` / `bsfeng-dsh-guardian`（`bsfeng-` 前缀取自作者 GitHub 账号）。**但目录名未同步**：`plugins/dsh-notify/` 目录内包名是 `bsfeng-dsh-notify`，`plugins/dsh-guardian/` 目录内包名是 `bsfeng-dsh-guardian`。

2. **二次撞名（2026-08-27，issue #37）**：`dsh-skill-manager`（gohana）、`dsh-plugin-manager`（ruihuahe）的 npm 包名同样被占用。issue #37 调研时，外部观察者（包括 agent）看到目录名 `dsh-notify` / `dsh-guardian` 就去 npm 查同名包，发现是别人的包，**误判 4 个包全部冲突**——实际只有 `dsh-skill-manager` / `dsh-plugin-manager` 两个真正冲突。误判根源正是「目录名 ≠ 包名」（issue #37 补充评论，2026-08-27）。

3. **决策落地（2026-08-27）**：分两次提交完成统一改名——
   - `21221d4`：`dsh-skill-manager` / `dsh-plugin-manager` → `dsh-my-skill-manager` / `dsh-my-plugin-manager`（目录同步改名）
   - `8682b39`：`bsfeng-dsh-notify` / `bsfeng-dsh-guardian` → `dsh-my-notify` / `dsh-my-guardian`（目录同步改名，`bsfeng-` 前缀废弃）

## 决策

1. **所有插件统一使用 `dsh-my-*` 前缀命名**（`dsh-my-<功能名>`），废弃 `bsfeng-` 前缀。
2. **目录名必须 = 包名**：`plugins/<name>/` 目录名与 `package.json` 的 `name` 字段保持一致，禁止出现「目录名 ≠ 包名」。
3. 改名时**全链路同步**：package.json name / server export name / client id / bundle patch name / 文档引用，一处不漏。
4. 命名阶段先检索 npm 包名（`npm view <候选包名>`），被占用则换名或加 `dsh-my-*` 前缀（已沉淀至 `skills/dsh-plugin-development/SKILL.md`，issue #37）。

## 后果

### 正面

- **消除「目录名 ≠ 包名」误解**：外部观察者（含 agent）看到目录名即可确定包名，不再误判冲突（issue #37 补充评论的「4 个包冲突」误判不会重演）。
- **命名体系统一**：`dsh-my-*` 系列与 DSH 官方 `dsh-*` 生态命名风格一致，`my` 标识个人系列，品牌可识别。
- **npm 包名唯一**：改名后包名均经检索确认未被占用，`dsh plugin add dsh-my-*` 安装行为可预期。

### 负面

- **改名成本高**：涉及 package.json name / server export name / client id / bundle patch name / localStorage 配置 key / API 路径 / 文档全链路修改（`b695d24`、`8682b39` 均为此付出大量 diff）。
- **既有用户迁移**：已安装旧包名（`bsfeng-dsh-*`）的用户需重新安装；localStorage 配置 key 与 API 路径保持旧前缀以兼容既有用户配置（`b695d24` 说明）。
- **历史包袱**：`bsfeng-` 前缀虽废弃，但旧包名在 npm 上仍存在（不冲突，仅不再更新）。

### 教训

- **命名阶段必须检索 npm 包名**：撞名应在开发之初规避，而不是发布时才发现、再被迫改名（issue #37 已沉淀为 skill 规范）。
- **目录名与包名必须一致**：不一致是认知陷阱，外部观察者（含 agent）会按目录名推断包名。
- **关键决策应记录 ADR**：本次改名决策当时未记录，导致后续（如 #42 可维护性盲区调研）无法追溯「为什么叫 dsh-my-*」「bsfeng- 前缀为何废弃」——本 ADR 即为此补记。

## 备选方案

- **方案 A：`bsfeng-` 前缀（曾采用，已废弃）**：前缀取自作者 GitHub 账号，个人标识明确；但目录名未同步改名，造成「目录名 ≠ 包名」误解，且与 DSH 生态 `dsh-*` 命名风格割裂。
- **方案 B：`dsh-my-*` 前缀（采纳）**：与 DSH 生态命名风格一致，`my` 标识个人系列；目录名同步改名，彻底消除误解。
- **方案 C：保持裸名（`dsh-notify` 等，未采用）**：与 npm 同名包冲突，`dsh plugin add` 会装到别人的包，不可行。
