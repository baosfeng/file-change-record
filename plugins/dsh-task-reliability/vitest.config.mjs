// 质量门禁：vitest 覆盖率（行 ≥85 / 分支 ≥75 / 函数 ≥80），只统计 server 端 lib/index.js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/*.mjs'],
    exclude: ['**/e2e-cdp.mjs', '**/node_modules/**'],
    // 测试通过 process.env.DSH_HOME 指向各用例的临时目录；文件并行会互相污染该
    // 全局环境变量，必须顺序执行测试文件。
    fileParallelism: false,
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
