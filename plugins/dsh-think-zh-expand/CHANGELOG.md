# Changelog

本文件记录 dsh-think-zh-expand 的所有版本变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.1] - 2026-08-23

### 修复

- **文本块 Markdown 渲染补全表格支持**：轻量渲染器此前只支持代码块/标题/列表/引用/行内样式，表格（`| a | b |` + 分隔行）会被当作普通段落显示为纯文本。现支持标准 GFM 表格：表头 + 分隔行（含 `:---:` 居中 / `---:` 右对齐）+ 数据行，单元格内粗体/斜体/行内代码/链接正常渲染；无分隔行的管道行仍按段落回退。新增 `test/client-render.mjs` 渲染测试覆盖。

## [0.2.0] - 2026-08-23

### 新增

- **界面标签中文化（Client 端）**：官方 UI 的 zh 字典未翻译完且存在硬编码英文（轨迹视图的 Thinking / Tool Call / Tools / ASSISTANT / Duration / Turns 等，对话视图的 Tool call / System prompt / Messages 等），`locale.register` 无法覆盖已注册字典——通过 DOM 层精准文本替换补齐：完全匹配词表的叶子文本节点替换为中文，排除代码块 / 输入区避免误伤消息正文，MutationObserver 跟随 React 重渲染持续生效。

## [0.1.0] - 2026-08-23

### 新增

- **思考强制中文（Server 端）**：通过 `systemPrompt.section` 注入固定中文指令（`name: dsh-think-zh`、`order: -90`），思考与回复始终使用中文。
- **思考默认展开（Client 端）**：替换 `assistant-step` 节点渲染器——reasoning 块默认展开完整内容（可点击收起、流式中保持展开），文本块轻量 Markdown 渲染，图片复用内置渲染。
