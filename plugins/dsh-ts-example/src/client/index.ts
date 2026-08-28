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
import { createElement, useEffect, useState, type ReactNode } from 'react'

// ── DSH 运行时类型（client 端最小契约，手写声明）──────────────────────

/** client 端 Context（cordis Context 最小契约 + betterSidebar 服务）。 */
interface ClientContext {
  effect(callback: () => void | (() => void), label?: string): void
  betterSidebar?: BetterSidebarService
}

/** better-sidebar 服务（侧边栏页签注册）。 */
interface BetterSidebarService {
  registerTab(options: {
    id: string
    title: string | (() => string)
    order?: number
    single?: boolean
    component: (props: { scope: { sessionId: string }; visible: boolean }) => unknown
  }): () => void
}

// ── 插件体 ─────────────────────────────────────────────────────────────

export const inject = ['betterSidebar']

export function apply(ctx: ClientContext): void {
  const service = ctx.betterSidebar
  if (service === undefined) return
  ctx.effect(
    () =>
      service.registerTab({
        id: 'dsh-ts-example:greeting',
        title: () => 'TS 示例',
        order: 90,
        single: true,
        component: (props) => createElement(GreetingPanel, props),
      }),
    'dsh-ts-example: greeting tab registration',
  )
}

// ── 页面组件 ───────────────────────────────────────────────────────────

function GreetingPanel(props: { scope: { sessionId: string }; visible: boolean }): ReactNode {
  const [greeting, setGreeting] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!props.visible) return
    let cancelled = false
    fetch(`/ts-example/api/greeting?name=${encodeURIComponent(props.scope.sessionId)}`)
      .then((response) => response.json())
      .then((body: { greeting?: string }) => {
        if (!cancelled) {
          setGreeting(body.greeting ?? '')
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGreeting('(请求失败)')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [props.visible, props.scope.sessionId])

  return createElement(
    'div',
    { style: { padding: '12px', fontFamily: 'var(--dsw-font-sans)' } },
    createElement('h3', null, 'TS 示例插件'),
    createElement('p', null, loading ? '加载中…' : greeting),
    createElement(
      'p',
      { style: { color: 'var(--dsw-alias-text-tertiary)', fontSize: '12px' } },
      'server 端由 TypeScript 编写（tsc 编译），client 端由 TypeScript 编写（构建时编译）。',
    ),
  )
}
