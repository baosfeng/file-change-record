// Stryker 变异测试配置（质量门禁第 7 项）
// 运行：npx stryker run（在插件目录内）
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.mjs' },
  mutate: ['lib/index.js'],
  reporters: ['clear-text', 'progress'],
  thresholds: { high: 80, low: 60, break: 70 },
  concurrency: 4,
  timeoutMs: 30000,
}
