/**
 * PART: 已迁移（issue #31 渲染职责迁移）。
 *
 * 本文件的 MarkdownView 渲染逻辑（mdInline / tryFence / tryHeading /
 * tryBullet / tryNumList / tryQuote / tryTable / tryParagraph /
 * MarkdownView）已整体迁至 dsh-md-render 的
 * `plugins/dsh-md-render/lib/parts/markdown.part.js`（统一 MarkdownView：
 * 表格 + 公式 + 代码块容器），本插件不再承担渲染职责。
 *
 * - scripts/build.mjs 的 PARTS 已移除本文件引用；
 * - lib/client.src.js 已移除 /*__PART_MARKDOWN__*\/ 占位符；
 * - assistant-step 渲染器经 `require('dsh-md-render')` 跨插件调用其
 *   MarkdownView 组件（依赖声明见 package.json 的 dsh.client.external）。
 *
 * 本文件保留仅为遵守仓库「删除文件须 ask 确认」规范；如需物理删除请
 * 经 ask 确认后移除。
 */
