// 根级质量门禁 ESLint 配置（flat config）
// 门禁：圈复杂度 ≤ 10；单文件 ≤ 300 行；单函数 ≤ 40 行（仅针对 lib/ 业务代码）
// 说明：lib/client*.js 为浏览器模块加载器格式（window.__ModuleLoader__.load），
//       非标准 Node ESM，单独配置 globals 与 sourceType。
import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    // 构建产物与工具临时产物不 lint：client.js 由 client.src.js 模板生成
    // （mermaid 产物内嵌 8.9MB base64，ESLint 正则规则会崩溃）；
    // **/coverage 为 vitest 覆盖率产物、**/.stryker-tmp 为变异测试 sandbox、
    // **/reports 为 Stryker 报告产物（各插件目录下）
    ignores: [
      '**/dist/',
      '**/coverage/',
      '**/node_modules/',
      '**/.stryker-tmp/',
      '**/reports/',
      // client.js 构建产物（由 client.src.js 模板 + lib/parts/ 片段经
      // scripts/build.mjs 拼接生成）：产物行数 = 源码总和，尺寸规则只查源；
      // mermaid 产物内嵌 8.9MB base64，ESLint 正则规则会崩溃
      'plugins/dsh-mermaid-render/lib/client.js',
      'plugins/dsh-file-activity/lib/client.js',
      'plugins/dsh-my-notify/lib/client.js',
      'plugins/dsh-think-zh-expand/lib/client.js',
      'plugins/dsh-my-guardian/lib/client.js',
      'plugins/dsh-my-skill-manager/lib/client.js',
      'plugins/dsh-my-memory/lib/client.js',
      'plugins/dsh-my-observability/lib/client.js',
      'plugins/dsh-my-guard/lib/client.js',
      'plugins/dsh-my-context/lib/client.js',
    ],
  },
  {
    // server 端业务代码：lib/ 下除 client 外的所有文件（P2 拆分后 index.js
    // 拆分为 state/fence/events/mount/api 等子模块，尺寸规则一并覆盖）
    files: ['plugins/**/lib/*.js'],
    ignores: ['plugins/**/lib/client.js', 'plugins/**/lib/client.src.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      complexity: ['error', 10],
      'max-lines': ['error', 300],
      'max-lines-per-function': ['error', 40],
    },
  },
  {
    // 浏览器端源码（模块加载器格式，非标准 ESM）：client.src.js 模板与
    // lib/parts/ 片段（方案 B 子文件拼接，拼接进 factory 作用域后互相引用，
    // no-undef/no-unused-vars 关闭）。构建产物 client.js 已在 ignores 排除。
    // 尺寸规则（复杂度/行数）照常强制。
    files: ['plugins/**/lib/client.src.js', 'plugins/**/lib/parts/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, __ModuleLoader__: 'readonly' },
    },
    rules: {
      ...js.configs.recommended.rules,
      complexity: ['error', 10],
      'max-lines': ['error', 300],
      'max-lines-per-function': ['error', 40],
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    // 测试文件：Node 环境，不套用行数/复杂度门禁（测试可长，保持可读）；
    // 下划线前缀参数（mock 接口占位）与 catch 绑定（`catch (err) {}`）豁免
    files: ['plugins/**/test/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
]
