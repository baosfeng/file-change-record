# Changelog

本文件记录 dsh-think-zh-expand 的所有版本变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-23

### 新增

- **思考强制中文（Server 端）**：通过 `systemPrompt.section` 注入固定中文指令（`name: dsh-think-zh`、`order: -90`），思考与回复始终使用中文。
- **思考默认展开（Client 端）**：替换 `assistant-step` 节点渲染器——reasoning 块默认展开完整内容（可点击收起、流式中保持展开），文本块轻量 Markdown 渲染，图片复用内置渲染。
