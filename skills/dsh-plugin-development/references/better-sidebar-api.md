# ctx.betterSidebar API 参考（dsh-better-sidebar ^0.14+）

> 权威来源：`omdsh-dev/DSH-better-sidebar` 的 `docs/external-plugin-guide.md`。服务只在 **client 端**存在；消费插件用 `inject: ['betterSidebar']` 声明依赖，注册代码包在 `ctx.effect()` 里。

## 服务方法

```js
// 全部注册方法返回 disposer（() => void），必须被 ctx.effect 持有
ctx.betterSidebar.registerTab(descriptor)          // 注册侧边栏页签类型
ctx.betterSidebar.registerFileViewer(descriptor)   // 注册文件预览器
ctx.betterSidebar.getTabs()                        // 已注册 tab 描述符快照
ctx.betterSidebar.getFileViewers()                 // 已注册 viewer 描述符快照
ctx.betterSidebar.getTab(id)                       // 按 id 查 tab 描述符
ctx.betterSidebar.isTabEnabled(id)                 // 设置页是否启用该 tab
ctx.betterSidebar.isViewerEnabled(id)
ctx.betterSidebar.matchFileViewer(path, head?)     // 按 path（+head 字节）匹配 viewer
ctx.betterSidebar.openTab(seed, scope?)            // 打开 tab（外部触发）
ctx.betterSidebar.closeTab(tabId, scope?)
ctx.betterSidebar.activateTab(tabId, scope?)
ctx.betterSidebar.updateTab(tabId, patch)          // { title?, path?, meta? }
ctx.betterSidebar.openFile(scope, path, title?)    // 在侧边栏编辑器打开文件
ctx.betterSidebar.subscribe(listener)              // 注册表变化订阅
ctx.betterSidebar.getSnapshot()                    // 当前快照（激活会话 + 状态 + prefs）
ctx.betterSidebar.subscribeState(listener)         // 快照变化订阅
ctx.betterSidebar.version                          // 如 '0.12.0'
ctx.betterSidebar.features                         // ['badge','tabLifecycle','updateTab','openFile',...]
```

## TabDescriptor（registerTab 入参）

```js
{
  id: 'dsh-xxx:page',          // 必填，全局唯一，内置 id 不可占用
  title: '页面名',              // 字符串或 () => string
  icon: <Icon />,              // ReactNode 或 (size) => ReactNode
  order: 50,                   // + 菜单排序，默认 100；内置 explorer=10 git=20 subagent=30 terminal=40
  hidden: false,               // 从 + 菜单隐藏（editor/diff 用）
  available: (ctx, scope, state) => bool,   // 菜单禁用判定（false = disabled 行）
  single: true,                // 单实例（打开时聚焦既有）
  dedupeKey: (tab) => key,     // 去重键；返回 undefined 不去重
  createTab: (state) => ({ tab, patch }),   // 自定义 tab 铸造（自增 id 等）
  badge: (ctx, scope, state) => 'n',        // tab 角标（保持廉价）
  onOpen / onActivate / onClose: (tab, scope) => void,  // 生命周期
  settings: { toggles?, pluginToggles?, render? },      // 声明式设置
  component: ({ ctx, store, scope, tab, visible }) => <Node />,  // 必填
}
```

内置 tab id（**不可重复注册**）：`editor`(hidden) / `explorer`(10) / `git`(20) / `subagent`(30) / `terminal`(40, createTab) / `browser`(50) / `diff`(hidden)。

## FileViewerDescriptor（registerFileViewer 入参）

```js
{
  id: 'dsh-xxx:csv',          // 必填，唯一
  title: 'CSV',               // 设置页展示名
  exts: ['csv'],              // 小写无点扩展名；[] = catch-all
  priority: 0,                // 高优先先裁决；内置 code=-100 catch-all，binary-download=-50
  detect: (path, head) => bool,     // 内容嗅探（head = Uint8Array 前 4KB）
  fetchStrategy: 'custom',    // 'none'|'fsRead'|'mediaUrl'|'custom'|'binary-download'
  load: async (path, scope, signal) => data,   // fetchStrategy='custom' 时
  settings: {...},            // 同 TabDescriptor.settings
  component: (props) => <Node />,
}
```

组件 props：`{ ctx, store, scope, path, title, viewerId, content?, truncated?, mediaUrl?, customData? }`。

fetchStrategy 对照：

| 策略 | 字节来源 | 组件字段 |
|---|---|---|
| none | 无 | — |
| fsRead | `/sidebar/api/fs.read` | content, truncated |
| mediaUrl | `/sidebar/file` 路由 URL | mediaUrl |
| custom | 你的 load() | customData |
| binary-download | 不预览，下载按钮 | — |

内置 viewer：image(0) / pdf(0) / markdown(0,fsRead) / html(0,fsRead) / code(-100,catch-all,fsRead) / binary-download(-50)。同扩展名 + 更高 priority 即可覆盖内置。

## 数据访问（/sidebar API）

```js
// 读文件
const res = await fetch('/sidebar/api/fs.read', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ sessionId: scope.sessionId, path }),
})
const { value } = await res.json()   // 文本: { kind:'text', content, truncated }；二进制: { kind:'binary', size, truncated, head }

// 媒体 URL（<img src> 直接用）
const url = `/sidebar/file?${new URLSearchParams({ sessionId: scope.sessionId, path })}`
```

常用方法：`session.cwd` / `fs.tree` / `fs.read` / `fs.write` / `git.status` / `git.diff` / `git.log` / `settings.get` / `settings.update`。所有 POST 都带 `sessionId`（+可选 `cwd`）。

## 声明式设置（settings 字段）

```js
settings: {
  // 插件自有设置行（v0.12+，推荐）：持久化在 pluginSettings[id]，无需宿主 schema 字段
  pluginToggles: [
    { key: 'pageSize', title: '每页行数', type: 'number', min: 1, max: 100, unit: '行' },
  ],
  // 或完全自定义面板（给定时代替行列表）
  render: ({ store, service, prefs, pluginSettings, updatePluginSetting, close }) => <Panel />,
}
```

行类型：`'switch' | 'text' | 'number'`（默认 switch）；值必须 JSON 可序列化。`toggles`（宿主 prefs 字段行）仅在需要绑定宿主内置键时使用。

读写闭环：

- `render` 面板内：props 直接给 `pluginSettings`（本 descriptor 的持久化 blob）与 `updatePluginSetting(key, value)`，面板内改动即时持久化。
- 页面组件（tab/viewer 的 component）内读取插件设置：经组件 props 的 `store` 访问（`pluginSettings` 随 store 快照暴露；精确读取路径参考 better-sidebar 内置实现 `src/client/builtins/` 与 `src/client/service.ts`，或把需要的值经 `badge`/`onOpen` 等回调带入组件状态）。

## 版本与能力探测

```js
if (ctx.betterSidebar.features.includes('openFile')) { /* 用 openFile */ }
if (ctx.betterSidebar.version >= '0.12.0') { /* minor 只增，字符串比较即可 */ }
```

## 生命周期要点

- 组件卸载 ≠ tab 关闭（会话切换也会卸载）；释放资源用 `onClose`。
- `visible === false`（面板折叠/非激活 tab）时暂停轮询/订阅。
- 未加载插件时持久化的 tab 渲染为「插件未加载」占位卡，插件加载后自动恢复。

## 调试参考

- 内置实现（吃狗粮）：`src/client/builtins/`（注册代码）、`src/client/service.ts`（服务实现）、`src/client/api.ts`（fetch 封装）、`src/client/Sidebar.tsx`（分发与 + 菜单）。
- 已接入案例：`fuhefei/dsh-sentinel`（可选软依赖 + 本地重述最小契约）、`ChenRuoT/dsh-sidebar-qa`。
