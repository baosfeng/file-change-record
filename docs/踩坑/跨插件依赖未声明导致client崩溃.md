---
title: 跨插件依赖未声明导致 client 崩溃
description: client 端 require('dsh-*') 未声明 peerDependencies 导致插件加载崩溃（issue #39 实例）
created: 2026-08-28
status: 已解决
---

# 跨插件依赖未声明导致 client 崩溃

## 现象

用户环境报错：`dsh-think-zh-expand` v0.4.3 的 client 端 `require('dsh-md-render')` 失败，插件加载崩溃。

## 根因

1. **跨插件依赖未声明**：client 端 `require('dsh-md-render').MarkdownView`，但 package.json `peerDependencies` 没有声明 `dsh-md-render`（只有 `dsh.client.external` 构建配置，没有 npm 分发层面的依赖声明）；
2. **依赖包从未发布**：`dsh-md-render` v0.1.1 当时既无 GitHub Release 也不在 npm 上；
3. **发版流程未校验跨插件依赖**：`release.mjs` 校验了 CHANGELOG/测试/截图/版本，但没有校验 client 端 require 的包是否已声明、已发布；
4. **发版前未强制真实环境验证**：`verifying-dsh-plugins` 流程没有强制执行，发版前未发现崩溃。

## 解决方案（issue #39）

1. **修复声明**：`dsh-think-zh-expand/package.json` 的 `peerDependencies` 补声明 `"dsh-md-render": "^0.1.1"`；
2. **发版流程强制校验**（`scripts/release.mjs` 步骤 1c，纯函数在 `scripts/lib/release-checks.mjs`）：
   - 扫描 client 端源码 `require('dsh-*')` / `import` 的包 → 必须在 `peerDependencies` 声明；
   - 声明的仓库内 dsh-* 依赖必须已发布（`npm view`）且已打 tag（`<目录>@v<版本>`）——**依赖先发版、依赖方后发版**；
3. **真实环境验证强制**（`scripts/release.mjs` 步骤 3c）：发版前自动跑 `verify-real-profile.mjs --addons plugins/<名>`，失败即阻断；CI 无生产 profile 自动跳过，本地 `--skip-real-verify` 显式跳过。

## 防复发

- 发版校验单测：`npm run test:scripts`（`scripts/test/release-checks.test.mjs`，CI quality job 强制）；
- 任何新增 `require('dsh-*')` 的插件，发版时会被步骤 1c 拦截（未声明即失败）。

## 配套修复（发版强制真实环境验证暴露）

`release.mjs` 强制真实环境验证后，`verify-real-profile.mjs` 对**已安装插件**跑 `--addons` 暴露两个既有问题（均已修复）：

1. **addons 软链 EEXIST**：生产 profile 已 `link:` 安装的插件在 node_modules 已有同名条目，addons 软链冲突 → 已存在则复用（指向真实源码，效果相同）；
2. **模拟安装制造重复 id**：已手动安装的插件（cordis.patch.yml 有手动行）被再次写入 bundles → bundle 自动插行 + patch 手动行叠加产生 `duplicate loader entry id` → 模拟安装前检查插件是否已在生产配置（bundles 或 patch 行），已存在则不重复写入。

→ [踩坑记录](README.md)
