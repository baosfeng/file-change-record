---
title: DSH 运行时 React 版本决定实际渲染
description: 浏览器端实际渲染的 React 版本由 DSH 运行时（dsh-web-frontend 打包的 seed word）决定，与插件自身 node_modules 无关；peer 声明需与运行时匹配
created: 2026-08-28
updated: 2026-08-28
---

# DSH 运行时 React 版本决定实际渲染

## 现象

插件 client 端 `require('react')` 解析到的 React 版本**不是**插件自身 node_modules 里的 react，而是 DSH 运行时（dsh-web-frontend Vite shell）打包的版本——通过 `staticModules` 作为平台 seed word 提供给所有插件 client bundle。

## 根因

- DSH 的 Vite shell（`@deepseek-ai/dsh-web-frontend`）在构建时把 react / react-dom / react-dom/client 等打包进产物，`staticModules` 定义 `{react, "react/jsx-runtime", "react-dom", "react-dom/client", ...}` 作为平台 seed word。
- dsh-client-modules 的 require 解析顺序：**seed word → 已物化模块 → 注册工厂**。插件 `require('react')` 命中 seed word，拿到的是 DSH 打包的版本。
- 实测：DSH 0.1.1-rc.2（npm latest=next）打包 react/react-dom **18.3.1**；dsh-better-sidebar 0.16.1 peer 声明 react ^18.2.0。**DSH 生态当前没有 React 19 运行时**。

## 影响

1. **peer 声明必须与运行时匹配**：插件 peer 声明 `react: ^19.2.0` 而运行时是 18.3.1 时——pnpm（DSH 官方安装方式）仅警告，但 npm 手动安装会 ERESOLVE 报错阻断。
2. **升级 React 大版本不由插件仓库控制**：即使插件代码 100% 兼容 React 19，实际渲染版本仍由 DSH 运行时决定，需等 @deepseek-ai 侧升级。

## 解决方案

- peer 声明用**双范围** `^18.2.0 || ^19.2.0`：与当前运行时（18.3.1）匹配 + 声明 React 19 兼容 + 未来 DSH 升级 19 后自动匹配，两种安装方式均无警告无失败。
- 完整评估见 [docs/开发指南/React19兼容性评估.md](../开发指南/React19兼容性评估.md)（issue #49）。

## 验证方法

```bash
# 查看 DSH 运行时打包的 react 版本（dist 产物中的版本串）
grep -o '18\.3\.1",rendererPackageName:"react' \
  ~/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-*.js
# 查看 npm 上 dsh 最新版（latest=next 同版本说明生态未升级）
npm view @deepseek-ai/dsh dist-tags
```

→ [README.md](README.md)
