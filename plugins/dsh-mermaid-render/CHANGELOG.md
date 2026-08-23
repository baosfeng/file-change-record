# Changelog

本文件记录 dsh-mermaid-render 的所有版本变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-23

### 新增

- **对话 Mermaid 图表渲染**：`mermaid` / `mmd` 代码块自动渲染为图表卡片（预览 / 代码切换），MutationObserver 跟随流式渲染。
- **mermaid 引擎内联打包**：`vendor/mermaid.min.js`（自包含 UMD）构建时 base64 注入 client bundle，**零 CDN 依赖、完全离线可用**（规避 jsdelivr 等 CDN 在部分网络环境不可达导致图表空白的问题）。
- **失败兜底**：渲染失败保留原始代码块 + 卡片内错误横幅。
- **兼容 dsh-think-zh-expand**：识别其产出的 `div.md-code-block` + `code.language-mermaid` 结构。
- 样式走 DSH 语义 token，随 activation 注入、fiber teardown 卸载。
