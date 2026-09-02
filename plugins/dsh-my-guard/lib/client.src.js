/**
 * dsh-my-guard — client half (browser). SOURCE TEMPLATE.
 *
 * 提供侧边栏页签「安全护栏」（dsh-my-guard:guard）：
 *  - 告警列表：破坏性命令 / 投毒扫描 / 提示注入三类告警（类型徽标 +
 *    严重度 + 时间 + 消息 + 详情），每条可「确认」（用户确认机制）；
 *  - 投毒扫描工具：输入包名/本地路径 → 扫描 → 显示发现项；
 *  - 提示注入检测工具：输入文本 → 检测 → 显示命中规则。
 *
 * 面板可见（visible）时轮询（GUARD_POLL_MS），隐藏时暂停（省请求）。
 * 样式走 DSH 语义 token（--dsw-alias-* / --dsw-font-*），随 activation
 * 注入、fiber teardown 卸载（HMR/禁用无残留）。
 *
 * BUILD NOTE: 本文件是模板源码，不是 DSH 实际服务的文件。scripts/build.mjs
 * 将片段文件（lib/parts/i18n.js / panel.js / styles.js + 共享
 * dsh-shared/client-parts/icons.part.js，均为无 import/export 的纯函数声明
 * 文本）经下方 __PART_*__ 占位符（函数式 replaceAll，避免 $&/$1 特殊解释）
 * 拼接进 factory 作用域，写出 lib/client.js —— 即 DSH 实际服务的产物。
 * 产物必须提交；CI 只对产物执行 node --check（见 .github/workflows/ci.yml）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-my-guard',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useEffect, useState } = require('react')

    // ── parts（scripts/build.mjs 拼接；顺序固定）───────────────────────
    /*__PART_I18N__*/
    /*__PART_ICONS__*/
    /*__PART_PANEL__*/
    /*__PART_STATES__*/
    /*__PART_RULES__*/
    /*__PART_STYLES__*/

    // ── 插件体：样式注入 + 页签注册 ─────────────────────────────────────
    exports.inject = ['betterSidebar']

    exports.apply = function apply(ctx) {
      ctx.effect(() => injectStyles(), 'dsh-my-guard: styles')
      const service = ctx.betterSidebar
      if (service === undefined) return
      ctx.effect(
        () =>
          service.registerTab({
            id: 'dsh-my-guard:guard',
            title: () => strings.tabTitle(),
            order: 42,
            single: true,
            component: (props) => createElement(GuardPanel, props),
          }),
        'dsh-my-guard: guard tab registration',
      )
    }

    return module.exports
  },
})
