import { defineConfig } from 'vitest/config'
import root from '../../vitest.config.mjs'

// client-only 插件：lib/index.js 为空壳（无 server 逻辑），覆盖率门禁豁免；
// 实际行为由 client-render 断言 + Gherkin 场景 + 真实环境验证覆盖（见差距分析文档）
export default defineConfig({
  ...root,
  test: {
    ...root.test,
    include: ['test/*.mjs'],
    coverage: {
      ...root.test.coverage,
      include: ['lib/index.js'],
      thresholds: {},
    },
  },
})
