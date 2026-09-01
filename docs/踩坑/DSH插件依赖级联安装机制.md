---
title: DSH 插件依赖级联安装机制
description: dependencies 中声明 dsh.bundle 的包会被 dsh plugin add 自动加入 profile bundles
created: 2026-09-01
updated: 2026-09-01
---

# DSH 插件依赖级联安装机制

## 结论（2026-09-01 从 DSH CLI 源码确认）

`dsh plugin --profile <p> add <pkg>` 的依赖处理逻辑（`@deepseek-ai/dsh/lib/plugin-*.js` 的 `reconcilePlugins`）：

1. pnpm 安装 `<pkg>` 到 profile 的 `dependencies`（**npm 依赖自动级联安装**：`<pkg>` 的 `dependencies` 中的包会被 pnpm 一并安装）；
2. 安装后 reconcile：遍历 `dependencies`，**解析为声明了 `dsh.bundle.patch` 的包自动加入 `dsh.profile.bundles` 层栈**（按依赖顺序追加）；
3. 未声明 `dsh.bundle` 的依赖（纯 library）仅警告"installed as a plain dependency, not a profile layer"，不加入 bundles（无害）。

**含义**：插件 A 依赖插件 B（B 是 DSH 插件、声明了 `dsh.bundle`）时，把 B 声明在 A 的 **`dependencies`**（而非 `peerDependencies`），用户 `dsh plugin add A` 即可**级联安装并自动加载 B**，无需手动单独安装。

## 案例

- **dsh-file-activity → dsh-better-sidebar**（issue #72 补充，2026-09-01）：`dsh-better-sidebar` 从 `peerDependencies` 移到 `dependencies`（`>=0.14.0 <0.18.0`），用户 `dsh plugin add dsh-file-activity` 自动安装并加载宿主，client 端 `inject: ['betterSidebar']` 不再缺失。
- **4 插件 → dsh-shared**（issue #72，PR #96）：`dsh-shared`（library，无 `dsh.bundle`）从 `peerDependencies` 移到 `dependencies`，npm 自动安装（server 端 `import 'dsh-shared'` 可用）；reconcile 会警告"plain dependency"但无害。

## 注意事项

- **knip 误报**：client 端运行时宿主依赖（如 dsh-better-sidebar，通过 `inject` 使用而非 import）会被 knip 报 "Unused dependencies"——需在 `knip.json` 的 `ignoreDependencies` 显式忽略。
- **版本范围**：`dependencies` 的 semver 范围要覆盖实际兼容版本（如 `>=0.14.0 <0.18.0`），`^0.14.0` 只匹配 0.14.x。
- **peerDependencies 保留**：宿主运行时（cordis/react 等）仍用 `peerDependencies`（由 DSH 运行时提供）。

## 相关

- `@deepseek-ai/dsh/lib/plugin-*.js`（`reconcilePlugins` / `exportsPatch`）
- issue #72（依赖未随安装自动安装）
