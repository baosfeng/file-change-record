# Changelog

本文件记录 dsh-md-render 的所有版本变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- **统一 MarkdownView（issue #31 渲染职责迁移）**：承接 dsh-think-zh-expand 迁出的渲染职责——`lib/parts/markdown.part.js` 提供统一 MarkdownView 组件（`mdInline` + 块级 `tryXxx` 管线），输出结构保持迁移前约定（`div.tzx-md` / `p.tzx-p` / `table.tzx-table` / `div.md-code-block`）；`exports.MarkdownView` 供 think-zh-expand 跨插件 require（其 `dsh.client.external` 声明依赖本插件）。
- **公式渲染（自实现零依赖）**：行内 `$...$` 渲染为 `span.dmr-math`（货币 `$5` / 变量 `a$b` / 块级 `$$` 保护），块级 `$$...$$`（单行/多行）渲染为 `div.dmr-math-block`。
- **公式错误提示（issue #32）**：公式内容异常（行内未闭合 `$`、内容以空白开头/空公式、跨行、块级未闭合/空）渲染为 `span.dmr-math-error` / `div.dmr-math-error`——显示原文 + 错误样式（DSH 语义 token `--dsw-alias-state-error-primary`，参考内置 `katex-error` 语义），不破坏整体布局；货币/变量/块级保护不误报。
- **md-code-block 容器归属**：代码块容器 `div.md-code-block`（含 `pre.tzx-pre` > `code.language-*`）由本插件 MarkdownView 产出，dsh-mermaid-render 无需改动即可扫描。
- **测试**：新增 `test/markdown-view.mjs`（表格/公式/代码块容器/回退/多反引号断言）；Gherkin 新增统一渲染器场景（标准表格/代码块容器/公式/公式错误提示）。

## [0.1.0] - 2026-08-27

### 新增

- **非思考模式 markdown 表格渲染增强**：扫描 `div.tzx-md`（dsh-think-zh-expand 的 MarkdownView 输出）与 `div.md-table-wide`（内置 MarkdownText 宽表格容器）内的表格文本段落，识别并渲染为真正的 `<table>`（表头 thead / 数据 tbody / 逐列对齐）。
- **增强表格检测**：表头/数据行只需含 `|` 且 ≥2 列（允许无首尾管道符）；分隔行支持 `--- | ---`、`-|-|-`、`---` 等变体；对齐标记 `:---` 左、`:---:` 中、`---:` 右。
- **宽表格横向滚动**：表格外层 `div.dmr-table-scroll` 容器 `overflow-x: auto`，宽表格不撑破消息气泡。
- **表格样式**：表头底色 + 加粗、行分隔线，走 DSH 语义 token，深浅主题自适应；样式随 activation 注入、fiber teardown 卸载。
- **兼容 dsh-think-zh-expand**：已渲染的表格（`table.tzx-table`）不重复处理；思考模式（reasoning 块）表格渲染不受影响。
- **流式兼容**：MutationObserver 跟随流式渲染，流式中的容器（`[data-streaming]` 祖先）等内容稳定后再处理。
- **零依赖**：表格检测与渲染全部自实现，无第三方库、无 CDN。
