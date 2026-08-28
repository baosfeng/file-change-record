/**
 * dsh-ts-example — client half (browser). SOURCE TEMPLATE.
 *
 * BUILD NOTE: 本文件是模板源码，不是 DSH 实际服务的文件。scripts/build.mjs
 * 先运行 `tsc -p tsconfig.client.json` 把 src/client/index.ts 编译成
 * CommonJS 单文件（lib/.client-build/index.js），再注入下方
 * /*__CLIENT_BUNDLE__* / 占位符（函数式 replaceAll，避免 $&/$1 特殊解释），
 * 写出 lib/client.js —— 即 DSH 实际服务的产物（单一 __ModuleLoader__ bundle）。
 * 产物必须提交；CI 只对产物执行 node --check（见 .github/workflows/ci.yml）。
 *
 * 编译产物为 CommonJS 格式：require / exports / module 均为本 factory 作用域
 * 变量（require 由 __ModuleLoader__ 注入，exports/module 为上方局部变量），
 * 因此产物可直接内联。client 端 TS 源码为单文件（无运行时相对 import），
 * 需要多文件/复杂打包时可用 esbuild/tsdown（官方 tsdown.client.ts 协议）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-ts-example',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    // ── TS 编译产物（scripts/build.mjs 注入）────────────────────────
    "use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = void 0;
exports.apply = apply;
/**
 * dsh-ts-example — client 端入口（TypeScript 源码，单文件）。
 *
 * 构建流程：`tsc -p tsconfig.client.json` 把本文件编译为 CommonJS 单文件
 * （lib/.client-build/index.js），scripts/build.mjs 再注入
 * lib/client.src.js 模板的 __CLIENT_BUNDLE__ 占位符，写出
 * lib/client.js（DSH 实际服务的 __ModuleLoader__ bundle）。
 *
 * 约束：client 端 TS 源码为单文件（无运行时相对 import——编译产物内联进
 * factory 作用域后，require 只认识 DSH 运行时注入的模块，如 react）。
 * 类型声明可拆文件（import type 编译期擦除）；需要多文件/复杂打包时可用
 * esbuild/tsdown（官方 tsdown.client.ts 协议）。
 *
 * 演示内容：侧边栏页签「TS 示例」——调 server 端 /ts-example/api/greeting
 * 显示问候语（client TS → server TS 全链路）。
 */
const react_1 = require("react");
// ── 插件体 ─────────────────────────────────────────────────────────────
exports.inject = ['betterSidebar'];
function apply(ctx) {
    const service = ctx.betterSidebar;
    if (service === undefined)
        return;
    ctx.effect(() => service.registerTab({
        id: 'dsh-ts-example:greeting',
        title: () => 'TS 示例',
        order: 90,
        single: true,
        component: (props) => (0, react_1.createElement)(GreetingPanel, props),
    }), 'dsh-ts-example: greeting tab registration');
}
// ── 页面组件 ───────────────────────────────────────────────────────────
function GreetingPanel(props) {
    const [greeting, setGreeting] = (0, react_1.useState)('');
    const [loading, setLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        if (!props.visible)
            return;
        let cancelled = false;
        fetch(`/ts-example/api/greeting?name=${encodeURIComponent(props.scope.sessionId)}`)
            .then((response) => response.json())
            .then((body) => {
            if (!cancelled) {
                setGreeting(body.greeting ?? '');
                setLoading(false);
            }
        })
            .catch(() => {
            if (!cancelled) {
                setGreeting('(请求失败)');
                setLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [props.visible, props.scope.sessionId]);
    return (0, react_1.createElement)('div', { style: { padding: '12px', fontFamily: 'var(--dsw-font-sans)' } }, (0, react_1.createElement)('h3', null, 'TS 示例插件'), (0, react_1.createElement)('p', null, loading ? '加载中…' : greeting), (0, react_1.createElement)('p', { style: { color: 'var(--dsw-alias-text-tertiary)', fontSize: '12px' } }, 'server 端由 TypeScript 编写（tsc 编译），client 端由 TypeScript 编写（构建时编译）。'));
}


    return module.exports
  },
})
