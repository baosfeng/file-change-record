# Changelog

本文件记录 dsh-md-render 的所有版本变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-27

### 新增

- **非思考模式 markdown 表格渲染增强**：扫描 `div.tzx-md`（dsh-think-zh-expand 的 MarkdownView 输出）与 `div.md-table-wide`（内置 MarkdownText 宽表格容器）内的表格文本段落，识别并渲染为真正的 `<table>`（表头 thead / 数据 tbody / 逐列对齐）。
- **增强表格检测**：表头/数据行只需含 `|` 且 ≥2 列（允许无首尾管道符）；分隔行支持 `--- | ---`、`-|-|-`、`---` 等变体；对齐标记 `:---` 左、`:---:` 中、`---:` 右。
- **宽表格横向滚动**：表格外层 `div.dmr-table-scroll` 容器 `overflow-x: auto`，宽表格不撑破消息气泡。
- **表格样式**：表头底色 + 加粗、行分隔线，走 DSH 语义 token，深浅主题自适应；样式随 activation 注入、fiber teardown 卸载。
- **兼容 dsh-think-zh-expand**：已渲染的表格（`table.tzx-table`）不重复处理；思考模式（reasoning 块）表格渲染不受影响。
- **流式兼容**：MutationObserver 跟随流式渲染，流式中的容器（`[data-streaming]` 祖先）等内容稳定后再处理。
- **零依赖**：表格检测与渲染全部自实现，无第三方库、无 CDN。
