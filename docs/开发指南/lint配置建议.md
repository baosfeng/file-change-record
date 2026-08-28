---
title: lint配置建议
description: 本仓库 lint 工具配置现状与建议 — ESLint 已配置（复杂度/行数/import 解析/no-undef），Prettier 等可选工具待补充
created: 2026-08-22
updated: 2026-08-28
---

# Lint 工具配置建议

> 本文档由 scan-to-docs 自动生成，基于项目类型和现有配置检测，后续人工维护。
> 记录本仓库 lint 工具配置现状与建议，按优先级逐步补齐缺失工具。

## 当前状态

| 维度               | 状态                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 项目类型           | library（DSH 插件集合仓库）                                                                                                                                                                       |
| 语言               | JavaScript（Node.js ≥ 20，ESM）                                                                                                                                                                   |
| 已配置的 Lint 工具 | **ESLint 9+ Flat Config**（根 `eslint.config.js`）                                                                                                                                                |
| 已配置的 Lint 工具 | **ESLint 9+ Flat Config**（根 `eslint.config.js`）、**Prettier**（根 `.prettierrc.json`，issue #44）、**Knip**（根 `knip.json`，issue #45）、**jscpd**（根 `.jscpd.json`，issue #45）             |
| 已启用规则         | 圈复杂度 ≤ 10、单文件 ≤ 400 行、单函数 ≤ 70 行、`import/no-unresolved`（issue #48）、server 端 `no-undef`；knip 死代码检测（未使用文件/依赖/导出）、jscpd 重复代码检测（min-tokens 100，阈值 5%） |
| 已配置的提交拦截   | Husky + lint-staged（pre-commit：eslint --fix + prettier --write）、commitlint（commit-msg，Conventional Commits）、.editorconfig（issue #44）                                                    |
| 可考虑的可选工具   | Markdownlint                                                                                                                                                                                      |

> 说明：本仓库为多插件目录结构，各插件目录（`plugins/<name>/`）各自带 `package.json`。lint 配置统一在仓库根 `eslint.config.js`（flat config），CI（`.github/workflows/ci.yml` 的 quality job）执行 `npx eslint plugins/` 强制门禁。

---

## 已配置：ESLint（根 eslint.config.js）

**作用：** JS 代码静态分析，捕获潜在 bug 和代码质量/尺寸问题。

**运行方式：**

```bash
npm run lint          # eslint plugins/（质量规则 + 尺寸门禁）
npm run lint:size     # 仅尺寸门禁（复杂度/行数）
```

**配置结构（flat config，按文件类型分块）：**

| 配置块    | 匹配文件                                                                                     | 关键规则                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| server 端 | `plugins/**/lib/*.js`（排除 client 产物/模板）                                               | `js.configs.recommended` + 复杂度 ≤10 / 行数 ≤400 / 函数 ≤70 + `import/no-unresolved` + `no-undef`（recommended 自带） |
| client 端 | `plugins/**/lib/client.src.js` + `plugins/**/lib/parts/*.js`                                 | 同上尺寸规则 + `import/no-unresolved`；`no-undef`/`no-unused-vars` 关闭（`__ModuleLoader__` 格式）                     |
| 测试文件  | `plugins/**/test/**/*.mjs`                                                                   | `js.configs.recommended` + `import/no-unresolved`；`no-unused-vars` 豁免下划线参数                                     |
| ignores   | 构建产物 `lib/client.js`、`coverage/`、`.stryker-tmp/`、`reports/`、`dist/`、`node_modules/` | —                                                                                                                      |

### import/no-unresolved（issue #48，2026-08-28 新增）

**作用：** 检查 `import` / `require` 的模块真实存在，直接拦截「require 拼错模块名」类低级错误（如 #39 的 `require('dsh-md-render')` 拼写错误）。

**配置要点：**

- 依赖 `eslint-plugin-import`（根 devDependency，`^2.32.0`；注意其 peer 声明为 eslint ≤9，安装需 `--legacy-peer-deps`，实测 eslint 10 下规则正常工作）。
- 规则选项 `{ commonjs: true }`：**必须显式开启**，否则 `require()` 调用默认不被检查（eslint-module-utils 的 moduleVisitor 对 commonjs 默认 false）。
- resolver 设置 `import/resolver.node.moduleDirectory: ['node_modules', 'plugins']`：使 client 端 `require('dsh-md-render')` 等跨插件模块映射到仓库内 `plugins/<name>/` 真实检查（DSH 运行时按插件名提供模块，仓库内即 `plugins/<name>/`）。
- client 端额外 `ignore: ['^react$', '^react-dom(/.*)?$']`：`react` / `react-dom` 由 DSH 运行时注入浏览器（node_modules 无对应包），豁免；**其余 require 全部真实检查**（不存在的 `dsh-*` 包 → lint 报错）。

**回归测试：** `scripts/test/lint-rules.test.mjs`（`npm run test:scripts` 自动包含）用 ESLint Node API 断言规则行为：server 端 require/import 不存在模块报错、client 端 dsh-* 解析与 react 豁免、server 端 no-undef 生效。

### server 端 no-undef（issue #48）

`js.configs.recommended.rules` 自带 `no-undef: 'error'`，server 端（标准 Node ESM）未定义变量直接报错。client 端因 `__ModuleLoader__` 拼接格式（片段互相引用、运行时注入全局）保持关闭。

### 插件源码特殊性（client 端）

`lib/client.js` 是浏览器模块加载器格式（`window.__ModuleLoader__.load`），非标准 Node ESM；`lib/client.src.js` 模板 + `lib/parts/*.part.js` 片段经 `scripts/build.mjs` 拼接生成产物。lint 时：

- 构建产物 `lib/client.js` 在 ignores 排除（mermaid 产物内嵌 8.9MB base64，ESLint 正则规则会崩溃）；
- `client.src.js` / `parts/*.js` 单独配置 `sourceType: 'script'` + 浏览器 globals，关闭 `no-undef`/`no-unused-vars`（片段注入 factory 作用域后互相引用），尺寸规则照常强制。

---

## 缺失必备工具

### Prettier

**作用：** 统一的代码格式化工具。

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

| 工具                | 作用                                    | 安装命令                                                         | 配置方式                                                                 |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Husky + lint-staged | Git hooks 管理，提交前自动运行 linter   | `npm install -D husky lint-staged && npx husky init`             | `.husky/pre-commit` 中写 `npx lint-staged`                               |
| commitlint          | 检查 Git 提交信息符合约定式提交规范     | `npm install -D @commitlint/cli @commitlint/config-conventional` | `commitlint.config.js`：`extends: ['@commitlint/config-conventional']`   |
| Markdownlint        | Markdown 文档规范检查（本仓库文档较多） | `npm install -D markdownlint-cli2`                               | `.markdownlint-cli2.jsonc`                                               |
| .editorconfig       | 跨编辑器代码风格统一                    | 新建 `.editorconfig` 文件                                        | `root = true`；`[*.{js,mjs}]`：`indent_style = space`、`indent_size = 2` |

---

## 配置优先级建议

### 第一阶段：必备（已配置）

1. **ESLint** — JS 代码静态分析（质量规则 + 尺寸门禁 + import 解析 + no-undef）✅
2. **Prettier** — 统一代码格式化（待补充）

### 第二阶段：推荐（尽快配置）

- 完善 ESLint 规则集（如 `eslint-plugin-n` 检查 Node 侧代码）
- 配置 CI/CD 流程中的 lint 检查自动化（已配置：CI quality job 跑 `npx eslint plugins/`）
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
- **eslint-plugin-import 与 eslint 10：** 插件 peer 声明仅到 eslint 9，安装需 `--legacy-peer-deps`；实测 eslint 10.9 下 `import/no-unresolved` 正常工作（见 `scripts/test/lint-rules.test.mjs` 回归测试）。
- **插件源码特殊性：** `lib/client.js` 是浏览器模块加载器格式（`window.__ModuleLoader__.load`），非标准 Node ESM；lint 时需注意 parser 配置（可在该文件上关闭 `no-undef` 等规则或用注释豁免），而 `lib/index.js` 是标准 Node ESM。

### CI/CD 集成

lint 检查已集成在 CI（`.github/workflows/ci.yml` 的 quality job）：

```yaml
- name: Lint (quality rules + size gates)
  run: npx eslint plugins/
```

新增规则（如 `import/no-unresolved`）自动随 `eslint plugins/` 生效，无需额外改动 CI。

---

> **注意：** 本文档记录配置现状与建议，不自动修改项目配置。请开发者根据项目实际情况选择是否采纳。
