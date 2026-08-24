// 根级 Vitest 配置（质量门禁）：所有插件测试 + 覆盖率阈值
// 各插件 npm test 通过插件目录内 vitest.config.mjs（继承本配置）运行
// 覆盖率只统计 server 端 lib/index.js：client 端（__ModuleLoader__ 格式）经 eval
// 加载，v8 coverage 无法统计（由 client-render 断言 + Gherkin + 真实环境验证覆盖）
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/*.mjs'],
    exclude: ['**/e2e-cdp.mjs', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/index.js'],
      thresholds: {
        lines: 85,
        branches: 75,
        functions: 80,
      },
    },
  },
})
