import { defineConfig } from 'vitest/config'
import root from '../../vitest.config.mjs'

// TS 示例插件：server 端为 tsc 编译产物（lib/index.js + lib/greeting.js），
// 覆盖率统计两个产物文件；client 端（__ModuleLoader__ 格式）经 eval 加载，
// v8 coverage 无法统计（由构建冒烟 + 真实环境验证覆盖）
export default defineConfig({
  ...root,
  test: {
    ...root.test,
    include: ['test/*.mjs'],
    coverage: {
      ...root.test.coverage,
      include: ['lib/index.js', 'lib/greeting.js'],
    },
  },
})
