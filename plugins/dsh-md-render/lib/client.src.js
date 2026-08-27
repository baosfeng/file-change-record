/**
 * dsh-md-render — client half (browser).
 *
 * 非思考模式（模型只输出 text 块）下，dsh-think-zh-expand 替换内置
 * assistant-step 渲染器后，text 块走轻量 MarkdownView（`div.tzx-md`
 * 容器）。其 tryTable 检测严格（表头行必须首尾都有 `|`、分隔行必须含
 * `-`），模型输出的不标准表格（无首尾管道符、分隔行变体）检测失败后
 * 回退为纯文本段落（`p.tzx-p`），表格以原始 markdown 语法展示。
 *
 * 本插件在 DOM 层做渲染增强：
 *  - 扫描 `[data-conversation-scroll]` 内的 `div.tzx-md`（think-zh-expand
 *    的 MarkdownView 输出）与 `div.md-table-wide`（内置 MarkdownText 的
 *    宽表格容器）容器；
 *  - 对容器内以纯文本段落形式存在的表格（`p.tzx-p`），用增强检测规则
 *    （支持无首尾管道符、分隔行变体、对齐标记）识别并解析；
 *  - 将段落替换为 `<table>`（表头 thead / 数据 tbody / 对齐 style），
 *    外层 `div.dmr-table-scroll` 提供宽表格横向滚动；
 *  - 已渲染的表格（`table.tzx-table` 等）跳过，不重复处理；
 *  - MutationObserver 跟随流式渲染，流式中的容器等内容稳定后再处理。
 *
 * 样式走 DSH 语义 token（--dsw-alias-* / --dsw-font-*），随 activation
 * 注入、fiber teardown 卸载（HMR/禁用无残留）。
 *
 * BUILD NOTE: 本文件是源码模板（骨架）。scripts/build.mjs 把
 * lib/parts/*.part.js 片段注入到下方 /*__PART_*__* / 占位符处并写出
 * lib/client.js（DSH 实际提供的产物，单一 __ModuleLoader__ bundle，无相对
 * 路径 require）。产物必须提交（CI 只跑 node --check + 测试，不跑构建）；
 * 片段为纯函数声明文本（无 import/export），注入后处于本 factory 作用域。
 */
window.__ModuleLoader__.load({
  id: 'dsh-md-render',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    // ── 表格检测与解析（纯函数，导出供单测）──────────────────────
    /*__PART_DETECT__*/

    // ── 行内渲染：单元格内的 code / strong / em / link ─────────────
    /*__PART_INLINE__*/

    // ── DOM 表格渲染：div.dmr-table-scroll > table.dmr-table ────────
    /*__PART_RENDER__*/

    // ── 扫描器：MutationObserver 跟随流式渲染 ──────────────────────
    /*__PART_SCANNER__*/

    // ── 样式（DSH 语义 token，随 activation 注入）──────────────────
    /*__PART_STYLES__*/

    // ── 插件入口：样式注入 + 扫描器装配 ───────────────────────────
    /*__PART_APPLY__*/

    return module.exports
  },
})
