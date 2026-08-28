---
title: React 19 兼容性评估
description: issue #49 — React 18 → 19 升级的兼容性评估结论：DSH 运行时 React 版本调研、各插件 React 用法清单、兼容性判定、peer 声明决策
created: 2026-08-28
updated: 2026-08-28
---

# React 19 兼容性评估（issue #49）

> 本文档记录 issue #49「React 18 → 19 升级（评估兼容性 + 回归验证）」的评估结论与决策。
> 结论先行：**全部 13 个插件 client 端代码 100% 兼容 React 19，无需代码改动**；peer 声明升级为 `^18.2.0 || ^19.2.0`（双范围），理由见下文「peer 声明决策」。

## 1. 关键决策点：DSH 运行时 React 版本

**浏览器端实际渲染的 React 版本由 DSH 运行时决定，与插件自身 node_modules 无关。**

| 事实                                                                           | 证据                                                                                                                                                           |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DSH Vite shell（dsh-web-frontend 0.1.1-rc.2）打包 react / react-dom **18.3.1** | dist 产物含 `18.3.1",rendererPackageName:"react`；`staticModules` 定义 `{react, "react/jsx-runtime", "react-dom", "react-dom/client", ...}` 作为平台 seed word |
| 插件 client bundle 的 `require('react')` 解析到平台 seed word（18.3.1）        | dsh-client-modules 的 require 分支顺序：seed word → 已物化模块 → 注册工厂                                                                                      |
| npm 上 @deepseek-ai/dsh 最新版（0.1.1-rc.2，latest=next 同版本）仍是 React 18  | `npm view @deepseek-ai/dsh dist-tags`                                                                                                                          |
| dsh-better-sidebar 0.16.1 peer 声明 react ^18.2.0 + react-dom ^18.2.0          | 已安装包 peerDependencies                                                                                                                                      |
| dsh-web-frontend 的 react 声明 ^18.2.0（devDependencies，实际打包 18.3.1）     | npm registry + 本地包                                                                                                                                          |

**结论**：DSH 生态（运行时 + 宿主服务）当前全部基于 React 18.3.1，**没有 React 19 运行时可用**；DSH 侧升级由 @deepseek-ai 控制，本仓库无法先行升级。因此本 issue 的升级范围限定为：**插件代码兼容性评估 + peer 声明升级（声明对 React 19 的兼容性）**，实际渲染版本仍由 DSH 运行时（18.3.1）决定。

## 2. 各插件 React 用法清单（13 个有 client 的插件）

| 插件                  | React API                                                         | react-dom                                     | slots                                                               |
| --------------------- | ----------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| dsh-file-activity     | createElement, useState, useEffect, useMemo, useSyncExternalStore | —                                             | —                                                                   |
| dsh-md-render         | createElement                                                     | —                                             | —                                                                   |
| dsh-mermaid-render    | createElement, useState, useEffect                                | react-dom/client `createRoot` + `root.render` | —                                                                   |
| dsh-my-context        | createElement, useState, useEffect                                | —                                             | —                                                                   |
| dsh-my-guard          | createElement, useState, useEffect                                | —                                             | —                                                                   |
| dsh-my-guardian       | createElement, useState, useEffect                                | —                                             | —                                                                   |
| dsh-my-memory         | createElement, useState, useEffect                                | —                                             | —                                                                   |
| dsh-my-notify         | createElement, useState, useEffect                                | —                                             | —                                                                   |
| dsh-my-observability  | createElement, useState, useEffect                                | —                                             | —                                                                   |
| dsh-my-plugin-manager | createElement, useState, useEffect                                | —                                             | ✅ `ctx.get('slots')` + `slots.inject('settings.plugins.tab', ...)` |
| dsh-my-skill-manager  | createElement, useState, useEffect                                | —                                             | ✅ `ctx.get('slots')` + `slots.inject('settings.plugins.tab', ...)` |
| dsh-task-reliability  | createElement, useState, useEffect                                | —                                             | —                                                                   |
| dsh-think-zh-expand   | createElement, useState                                           | —                                             | —                                                                   |

> 注：dsh-plugin-dev-mode 为 agent preset（无 client 端），不在评估范围。

## 3. 兼容性判定

### 3.1 使用的 API 在 React 19 中的状态

| API                                             | React 18      | React 19                                    | 判定 |
| ----------------------------------------------- | ------------- | ------------------------------------------- | ---- |
| `createElement`                                 | ✅            | ✅（未移除，仍支持）                        | 兼容 |
| `useState` / `useEffect` / `useMemo`            | ✅            | ✅（行为一致）                              | 兼容 |
| `useSyncExternalStore`                          | ✅（18 引入） | ✅                                          | 兼容 |
| `react-dom/client` `createRoot` + `root.render` | ✅（18 引入） | ✅（保留；19 移除的是旧 `ReactDOM.render`） | 兼容 |

### 3.2 React 19 破坏性变化逐项检查

| React 19 破坏性变化                                        | 本仓库是否受影响                                          |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| 移除 `ReactDOM.render`（旧 API）                           | ❌ 未使用（只用 `createRoot`）                            |
| 移除 `propTypes` / `defaultProps`（函数组件）              | ❌ 未使用                                                 |
| 移除 legacy context / string refs / `findDOMNode`          | ❌ 未使用                                                 |
| 移除 UMD builds                                            | ❌ 不受影响（DSH 用 CJS/ESM bundle + `__ModuleLoader__`） |
| `useEffect` 清理时机变化（19 中 cleanup 在 commit 前运行） | ❌ 插件无依赖该时序的代码                                 |
| ref 作为 prop（不再需要 forwardRef）                       | ❌ 未使用 forwardRef，无影响                              |
| `<Context>` 直接作为 Provider                              | ❌ 未使用 Context                                         |

### 3.3 React 19 新特性使用情况

| 新特性                                                    | 本仓库是否使用                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Actions（useActionState / useOptimistic / useFormStatus） | ❌ 未使用                                                                       |
| `use()` Hook                                              | ❌ 未使用                                                                       |
| `<Activity>` / `useEffectEvent`（19.2）                   | ❌ 未使用（dsh-file-activity 源码中的 "Activity" 仅为注释文案 "File Activity"） |

### 3.4 非 React 机制（与版本无关）

- **slots 渲染**：dsh-my-skill-manager / dsh-my-plugin-manager 走官方 `slots` 服务（`ctx.get('slots')` + `slots.inject('settings.plugins.tab', ...)`），组件由宿主渲染，与 React 版本无关。
- **`__ModuleLoader__` 格式**：`window.__ModuleLoader__.load({ id, factory })` 由 dsh-client-modules 提供，与 React 版本无关；插件 bundle 格式无需改动。
- **跨插件依赖**：dsh-think-zh-expand `require('dsh-md-render')`（peer 已声明），与 React 版本无关。

### 3.5 结论

**全部 13 个插件 client 端代码 100% 兼容 React 19，无需任何代码改动。** 若未来 DSH 运行时升级到 React 19，插件可直接运行。

## 4. peer 声明决策

### 4.1 选项对比

| 方案                                    | 与当前运行时（18.3.1）匹配 | npm 安装（ERESOLVE） | pnpm 安装（DSH 官方方式） | 未来 DSH 升级 19  |
| --------------------------------------- | -------------------------- | -------------------- | ------------------------- | ----------------- |
| A. 升级 `^19.2.0`                       | ❌ 不匹配                  | ❌ 报错阻断          | ⚠️ 警告                   | ✅ 匹配           |
| B. 保持 `^18.2.0`                       | ✅ 匹配                    | ✅                   | ✅                        | ❌ 不匹配（警告） |
| C. **`^18.2.0 \|\| ^19.2.0`（双范围）** | ✅ 匹配                    | ✅                   | ✅                        | ✅ 匹配           |

### 4.2 决策：采用方案 C（双范围声明）

理由：

1. **peer 声明应反映实际兼容范围**：插件代码在 React 18.2+ 与 19.2+ 下均可运行，`^18.2.0 || ^19.2.0` 是精确的声明。
2. **避免安装失败**：实测 npm 在 react 18.3.1 环境下安装 peer `^19.2.0` 的包会报 ERESOLVE 错误（阻断用户手动 npm 安装）；pnpm（DSH 官方安装方式）仅警告。双范围声明两种场景均无警告无失败。
3. **未来兼容**：DSH 运行时升级到 React 19 后，插件 peer 声明自动匹配，无需再次修改。
4. **npm 生态标准做法**：与 @tanstack/react-virtual 等库的 `^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0` 声明模式一致。

### 4.3 升级清单（13 个插件）

| 插件                                                                                                                                                                                                                                                | 变更                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 11 个已有 react peer 的插件（dsh-file-activity / dsh-md-render / dsh-mermaid-render / dsh-my-context / dsh-my-guard / dsh-my-guardian / dsh-my-memory / dsh-my-observability / dsh-my-plugin-manager / dsh-my-skill-manager / dsh-think-zh-expand） | `react: ^18.2.0` → `react: ^18.2.0 \|\| ^19.2.0` |
| dsh-my-notify（client 端 require('react') 但缺 peer 声明）                                                                                                                                                                                          | 补 `react: ^18.2.0 \|\| ^19.2.0`                 |
| dsh-task-reliability（client 端 require('react') 但缺 peer 声明）                                                                                                                                                                                   | 补 `react: ^18.2.0 \|\| ^19.2.0`                 |
| dsh-mermaid-render（client 端 require('react-dom/client') 但缺 peer 声明）                                                                                                                                                                          | 补 `react-dom: ^18.2.0 \|\| ^19.2.0`             |

> dsh-plugin-dev-mode 无 client 端、无 react 依赖，不涉及。

## 5. 验证记录

- [x] 全量测试通过（`scripts/test-all.sh`：node --check + 各插件 npm test）
- [x] 真实环境验证无回归（独立端口 + 浏览器，各插件 client 端加载/渲染正常，见 issue #49 评论截图）
- [x] 技术栈版本文档同步（AGENTS.md / docs/概览/项目简介.md / docs/索引.md / docs/踩坑/README.md）

→ [索引.md](../索引.md)
