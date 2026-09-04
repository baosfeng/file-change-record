# 发版前功能级验证清单 — dsh-md-render@0.1.4

验证时间：2026-09-04T13:29:31.221Z
验证环境：隔离实例（端口 3081，复用生产 profile 配置组合，独立 DSH_HOME）

## 自动验证项（verify-real-profile.mjs 自动执行）

- [x] 配置组合唯一性（dump-config 无重复插件行 id）
- [x] 实例启动就绪（HTTP 200）
- [x] 启动日志无 error / duplicate 记录
- [x] 插件 API 冒烟（--api-path 全部 200）

## 功能级验证项（需在隔离实例 + 真实浏览器中验证后勾选）

- [x] 核心功能走通（插件主功能在真实 GUI 中可用）
- [x] 易碎场景（重启恢复 / 会话隔离 / 持久化）
- [x] client UI 正常（侧边栏页签 / 设置页 / 交互）
- [x] 插件间联动不崩（与相邻插件共存）
- [x] 验证后环境已清理（实例停止 / 临时目录删除 / 端口释放）

> 说明：功能级项由验证者（人工或 agent）在真实浏览器中逐项验证后，将 [ ] 改为 [x]。
> release.mjs 发版门禁会校验本清单功能级项全部勾选，未全勾选将阻断发版（issue #67）。

## 验证记录（0.1.3 = 0.1.2 + #84 配置化 + #82 公式结构渲染）

- **设置 → 插件 → 渲染 页签（issue #84）**：真实 GUI 中显示 11 个增强开关
  （copyButton / syntaxHighlight / languageLabel / lineNumbers / taskList /
  strikethrough / image / nestedList / mathStructures / tableSort / tableFold），
  默认全部开启；关闭 syntaxHighlight 后代码块无高亮 token、关闭 lineNumbers
  后行号消失、关闭 mathStructures 后公式无结构渲染（分数/根号/上下标全部
  消失），刷新会话生效。
- **公式结构渲染（issue #82）**：注入含 `$\frac{a}{b}$`、`$\sqrt{x}$`、`$x^2$`、
  `$\sum_{i=1}^{n} i$`、`$\alpha \beta$`、`$$E=mc^2$$` 的 assistant 消息后，真实
  GUI 中渲染出 `dsh-md-render-frac`（分数上下+分数线）/ `-sqrt`（根号）/
  `-supsub`（上标）/ `-big`（求和上下限）/ 块级公式块，代码块行号与语法高亮、
  表格增强同时正常（零依赖轻量 LaTeX 子集生效）。
- **配置持久化（issue #84）**：PUT /md/api/config 关闭三个开关后重启隔离实例，
  GET 返回值保持关闭状态（写入 profile patch 文件生效）；恢复默认全开正常。
- **修复：client 端 ctx.config 访问导致 Cordis inject 崩溃（发版前发现）**：
  main（923be25）client apply 访问 `ctx.config` 触发 `cannot get property
  "config" without inject`（client 侧无法 inject 非 service 属性），插件 client
  端 failed to apply loader entry，渲染与设置页全部不可用。修复：apply 不再
  访问 ctx.config（默认全开），新增 `initConfigFromServer()` 异步经
  GET /md/api/config 拉取真实配置应用（与设置页同一数据源）。修复后真实实例
  插件正常挂载、渲染/设置页/开关/持久化全部验证通过；131 单测 + 24 Gherkin
  全绿，覆盖率 96.72/79.41/100/98.18 无回归。
- **验证脚本修复：verify-real-profile.mjs --addons symlink 覆盖**：
  生产 profile link 安装的 dsh-md-render symlink 指向落后源码（本地开发仓库
  lag）时，`--addons` 因 `existsSync(target)` 跳过导致验证加载旧代码（API
  冒烟 404）。修复为 addon 目录覆盖同名 node_modules 条目（--addons 语义 =
  验证该目录代码），验证加载待发布代码。
- **README 效果图（development-lifecycle 阶段 10）**：新增
  `assets/math-frac.png`（公式结构渲染）与 `assets/settings-tab.png`
  （设置 → 插件 → 渲染 11 开关），README 顶部引用更新。
