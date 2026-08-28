/**
 * dsh-think-zh-expand — client half (browser).
 *
 * 功能 2：思考（reasoning）内容默认展开显示。
 *
 * 内置的 assistant-step 渲染器把 reasoning 块折叠成单行（ReasoningRow，
 * `useState(false)`，只显示第一行摘要）。本插件替换 `conversation.chat.node`
 * 的 `assistant-step` 渲染器：
 *  - reasoning 块 → 默认展开的「思考」块（完整内容直接显示，点击标题行可
 *    收起，流式生成中强制保持展开）；
 *  - text 块 → 复用 dsh-md-render 的统一 MarkdownView 渲染（issue #31
 *    渲染职责迁移：表格 / 公式 / 代码块容器由 dsh-md-render 提供，本插件
 *    经 `dsh.client.external` 跨插件 require 其 MarkdownView 组件）；
 *  - image 块 → 复用 owner 的 renderMessageImages（内置图片渲染）；
 *  - tool-call 块与内置一致跳过（tool-call 有独立节点渲染）。
 *
 * 功能 3：界面标签中文化。
 *
 * 官方 UI（dsh-client-ui-conversation / dsh-client-ui-trajectory）的 zh 字典
 * 本身未翻译完（如 `toolbar.duration: "Duration"`），且存在硬编码英文
 * （"Thinking"、"Tool Call"、"ASSISTANT" 等）；`locale.register` 对已注册的
 * 同 ns+locale 字典重复注册会抛错，无法经 locale 服务补译。因此本插件在
 * DOM 层做精准文本替换：只匹配「完全等于」词表的叶子文本节点（排除
 * pre/code/输入区，避免误伤代码块与消息正文），MutationObserver 跟随
 * React 重渲染持续生效。
 *
 * 样式走 DSH 语义 token（--dsw-alias-* / --dsw-font-*），随 activation 注入、
 * fiber teardown 卸载（HMR/禁用无残留）。图标走共享图标系统（issue #54
 * 阶段 0：plugins/dsh-shared/client-parts/icons.part.js，构建时拼接）。
 * MarkdownView 的渲染样式（.tzx-md 系列）随 dsh-md-render 注入（issue #31
 * 迁移）。
 *
 * BUILD NOTE: 本文件是源码模板（骨架）。scripts/build.mjs 把
 * lib/parts/*.part.js 片段注入到下方 /*__PART_*__* / 占位符处并写出
 * lib/client.js（DSH 实际提供的产物，单一 __ModuleLoader__ bundle，无相对
 * 路径 require）。产物必须提交（CI 只跑 node --check + 测试，不跑构建）；
 * 片段为纯函数声明文本（无 import/export），注入后处于本 factory 作用域。
 */
window.__ModuleLoader__.load({
  id: 'dsh-think-zh-expand',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    // useState 由 assistant.part.js 片段（ThinkBlock）使用；模板静态分析
    // 看不到片段内容（根 eslint 配置对 src+parts 已关闭 no-unused-vars）。
    const { createElement, useState } = require('react')
    // 统一 MarkdownView 由 dsh-md-render 提供（issue #31 渲染职责迁移；
    // 依赖声明见 package.json 的 dsh.client.external）。
    const MarkdownView = require('dsh-md-render').MarkdownView

    // ── 共享图标（issue #54 阶段 0：dsh-shared/client-parts）──────────
    /*__PART_ICONS__*/

    // ── 视图：思考块 + assistant-step 渲染器 ────────────────────────
    /*__PART_ASSISTANT__*/

    // ── 界面中文化：词表（纯数据）───────────────────────────────────
    /*__PART_ZH_TABLES__*/

    // ── 界面中文化：DOM 精准替换逻辑 + 纯函数导出 ──────────────────
    /*__PART_ZH_LOCALIZE__*/

    // ── 插件入口：样式注入 + 渲染器替换 + UI 中文化 ────────────────
    /*__PART_APPLY__*/

    return module.exports
  },
})
