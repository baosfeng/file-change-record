---
title: lint配置建议
description: 本仓库 lint 工具配置建议 — 当前无 lint 配置，建议补充 ESLint + Prettier 及可选提交规范工具
created: 2026-08-22
updated: 2026-08-22
---

# Lint 工具配置建议

> 本文档由 scan-to-docs 自动生成，基于项目类型和现有配置检测。
> 建议按优先级逐步配置缺失的 lint 工具，提升代码质量。

## 当前状态

| 维度 | 状态 |
|------|------|
| 项目类型 | library（DSH 插件集合仓库） |
| 语言 | JavaScript（Node.js ≥ 20，ESM） |
| 已配置的 Lint 工具 | 无（仅 CI 中 `node --check` 语法检查 + 冒烟测试） |
| 缺失的必备工具 | ESLint、Prettier |
| 可考虑的可选工具 | Husky + lint-staged、commitlint、Markdownlint、.editorconfig |

> 说明：本仓库为多插件目录结构，各插件目录（`plugins/<name>/`）各自带 `package.json`。建议在仓库根目录建立统一的 lint 配置，或在每个插件目录内独立配置。CI（`.github/workflows/ci.yml`）目前仅做 `node --check` 语法检查与冒烟测试，lint 不会阻塞发布。

---

## 缺失必备工具

> 以下工具是 JS 项目建议必须配置的 lint 工具，有助于在开发阶段捕获潜在问题、统一代码风格。

### ESLint

**作用：** JS 代码静态分析，捕获潜在 bug 和代码风格问题。

**官方文档：** https://eslint.org/docs/latest/use/getting-started

**安装方式：**

```bash
npm install -D eslint@9 @eslint/js globals
```

**基本配置（ESLint 9+ Flat Config，`eslint.config.js`）：**

```js
import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['node_modules/', 'dist/'] },
  js.configs.recommended,
  {
    files: ['plugins/**/lib/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
]
```

**CI/CD 集成建议：**

```yaml
# 在 ci.yml 的 build job 中追加
- name: Lint
  run: npx eslint . --max-warnings=0
```

### Prettier

**作用：** 统一的代码格式化工具。

**官方文档：** https://prettier.io/docs/en/install.html

**安装方式：**

```bash
npm install -D prettier eslint-config-prettier
```

**基本配置（`.prettierrc.json`）：**

```json
{
  "singleQuote": true,
  "semi": false,
  "trailingComma": "es5",
  "printWidth": 120
}
```

**CI/CD 集成建议：**

```yaml
- name: Format check
  run: npx prettier --check "plugins/**/*.js"
```

> ⚠️ ESLint 与 Prettier 同时使用时，用 `eslint-config-prettier` 关闭 ESLint 中与 Prettier 冲突的规则（ESLint 9 Flat Config 中通过 `prettier` 配置合并）。

---

## 可选增强工具

> 以下工具非必须，但可以进一步提升代码质量或开发效率，建议在项目稳定后按需添加。

| 工具 | 作用 | 安装命令 | 配置方式 |
|------|------|---------|---------|
| Husky + lint-staged | Git hooks 管理，提交前自动运行 linter | `npm install -D husky lint-staged && npx husky init` | `.husky/pre-commit` 中写 `npx lint-staged` |
| commitlint | 检查 Git 提交信息符合约定式提交规范 | `npm install -D @commitlint/cli @commitlint/config-conventional` | `commitlint.config.js`：`extends: ['@commitlint/config-conventional']` |
| Markdownlint | Markdown 文档规范检查（本仓库文档较多） | `npm install -D markdownlint-cli2` | `.markdownlint-cli2.jsonc` |
| .editorconfig | 跨编辑器代码风格统一 | 新建 `.editorconfig` 文件 | `root = true`；`[*.{js,mjs}]`：`indent_style = space`、`indent_size = 2` |

---

## 配置优先级建议

### 第一阶段：必备（立即配置）

1. **ESLint** — JS 代码静态分析，捕获潜在 bug 和代码风格问题
2. **Prettier** — 统一代码格式化

### 第二阶段：推荐（尽快配置）

- 完善 ESLint 规则集（如 `eslint-plugin-n` 检查 Node 侧代码）
- 配置 CI/CD 流程中的 lint 检查自动化（见上）
- 添加 .editorconfig 统一编辑器风格

### 第三阶段：可选（按需配置）

- 添加 Husky + lint-staged 与 commitlint 强化提交规范
- 添加 Markdownlint 检查文档质量

---

## 常见注意点

### 工具冲突

- **ESLint 与 Prettier：** 同时使用时，建议用 `eslint-config-prettier` 关闭 ESLint 中与 Prettier 冲突的规则。

### 版本兼容

- **ESLint 9+** 默认使用 Flat Config（`eslint.config.js`），旧版 `.eslintrc.*` 格式已弃用。
- **插件源码特殊性：** `lib/client.js` 是浏览器模块加载器格式（`window.__ModuleLoader__.load`），非标准 Node ESM；lint 时需注意 parser 配置（可在该文件上关闭 `no-undef` 等规则或用注释豁免），而 `lib/index.js` 是标准 Node ESM。

### CI/CD 集成

建议在 CI/CD 流程中集成 lint 检查，确保持续合规：

```yaml
# GitHub Actions 示例 - Lint 检查
name: Lint Check
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Lint
        run: npx eslint . --max-warnings=0
```

---

> **注意：** 本文档仅提供配置建议，不自动修改项目配置。请开发者根据项目实际情况选择是否采纳。
