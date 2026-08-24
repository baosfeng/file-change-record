/** dependency-cruiser 配置：质量门禁第 6 项（依赖结构分析）。 */
export default {
  forbidden: [
    {
      name: 'no-circular',
      comment: '禁止循环依赖（A→B→A）',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-lib-cross-import',
      comment: 'lib 内部 server/client 不互相依赖（index.js 与 client.js 独立打包）',
      severity: 'error',
      from: { path: 'plugins/[^/]+/lib/index\\.js$' },
      to: { path: 'plugins/[^/]+/lib/client' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    includeOnly: '^plugins/',
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'default'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/[^/]+' },
    },
  },
}
