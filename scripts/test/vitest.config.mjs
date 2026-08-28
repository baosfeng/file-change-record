// scripts 测试专用 Vitest 配置：覆盖率只统计 scripts/lib/release-checks.mjs
// （发版校验纯函数，issue #39），阈值与根配置一致（行 85 / 分支 75 / 函数 80）。
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['scripts/test/*.test.mjs'],
    coverage: {
      provider: 'v8',
      include: ['scripts/lib/release-checks.mjs'],
      thresholds: {
        lines: 85,
        branches: 75,
        functions: 80,
      },
    },
  },
})
