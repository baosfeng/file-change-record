---
name: dsh-plugin-development
description: 在本仓库（my-dsh-plugins）中新建、修改、调试或发布 DSH 插件时使用。也适用于处理注册冲突（already registered）、挂载不生效、HMR 不热更新、profile 双挂载、GitHub Release 发版与 tag 规则等错误场景。仓库内插件均为 plugins/<name> 自包含 bundle，接入 dsh-better-sidebar 服务。
---

# 本仓库 DSH 插件开发

## 概览

本仓库是个人 DSH 插件集合（轻量多插件目录，非 workspace monorepo）。每个插件是 `plugins/<name>/` 下的**自包含 Cordis bundle**：拥有自己的 `package.json`、`cordis.patch.yml`、README、LICENSE、CHANGELOG，可独立安装、独立发布、独立拆仓。

一个插件通常由两端组成：

- **Server 端**（`lib/index.js`）：运行在 DSH Node 进程，提供事件监听、HTTP 路由、持久化。
- **Client 端**（`lib/client.js`）：运行在浏览器，通过 `ctx.betterSidebar` 注册侧边栏页签（tab）与文件预览器（viewer）。

安装方式：`dsh plugin --profile web add link:<插件目录绝对路径>`（或从 GitHub Release 下载 tarball 安装）。

## 何时使用

- 在仓库里**新建**一个插件（先读「插件形态」再动手）
- **修改**现有插件（server / client 任一端）
- **调试**：注册冲突、挂载不生效、页面不刷新不生效、重复挂载
- **发布**：版本号、CHANGELOG、tag、GitHub Release

## 插件形态（先决策）

| 形态 | 面向 | 关键 API |
|---|---|---|
| **侧边栏页签 / 预览器**（消费 better-sidebar） | 在侧边栏提供新页面或文件预览 | client 端 `ctx.betterSidebar.registerTab` / `registerFileViewer` |
| **纯 server 插件** | 事件监听 / 工具注册 / HTTP 路由 | `apply(ctx)` + `ctx.on` / `defineTool` |
| **两者混合**（最常见） | 页面 + 后端逻辑 | 两端都写，client 通过 HTTP 路由或事件上报 server |

> `ctx.betterSidebar` **只存在于 client 端**。server 端需要侧边栏数据时走 `/sidebar/api/*` HTTP 路由，不要假设服务存在。

## 目录结构规范

```
plugins/<name>/                  # 插件目录（小写连字符命名，如 dsh-file-activity）
├── lib/
│   ├── index.js                 # server 端入口（export { name, inject, apply }）
│   └── client.js                # client 端入口
├── test/                        # 测试（CI 只跑 node test/host-smoke.mjs）
├── assets/                      # README 截图等
├── package.json
├── cordis.patch.yml             # bundle 挂载补丁
├── README.md                    # 中文说明（截图 + 功能 + 安装 + 配置）
├── LICENSE                      # MIT
└── CHANGELOG.md                 # Keep a Changelog 格式
```

命名：包名 `dsh-<功能>`（如 `dsh-file-activity`），无 scope；目录名 = 包名；插件行 id 用短横线小写（如 `file-activity`），**client 注册的 tab/viewer id 用 `包名:xxx` 前缀**（如 `dsh-file-activity:recent`）。

## 开发流程

1. **搭骨架**：按上面目录结构创建 `plugins/<name>/`，复制现有插件（如 `plugins/dsh-file-activity/`）的 `cordis.patch.yml`、LICENSE、.gitignore 约定。
2. **写 package.json**（见下方字段说明）。
3. **写 server 端** `lib/index.js`：`export const name / inject / apply(ctx)`。用 `ctx.on(...)` 监听事件、`ctx.effect(() => ...)` 注册副作用（返回 disposer），可注入 `webServer`（HTTP 路由）、`sessions` 等服务（用 `ctx.get('服务名')` 读可选服务并处理 undefined）。
4. **写 client 端** `lib/client.js`：注入 `betterSidebar` 服务，用 `ctx.effect(() => ctx.betterSidebar.registerTab(...))` 注册页签（disposer 必须被 fiber 持有，否则 HMR/禁用后残留注册、下次激活报 `"already registered"`）。
5. **写测试**：`test/` 下放纯 Node 冒烟测试（mock ctx / mock betterSidebar），CI 只跑 `npm test`（即 `node test/host-smoke.mjs`）；依赖浏览器/真实 GUI 的测试留在本机手动跑。
6. **本地验证**：`dsh plugin --profile web add link:<路径>` → 浏览器硬刷新（Cmd/Ctrl+Shift+R）。client 改动热加载无需重启；**server 端改动需重启 `dsh web`**。
7. **发布**：更新版本号 + CHANGELOG → 推 tag `<包名>@v<版本>`（如 `dsh-server-status@v0.1.0`）→ 根目录 `.github/workflows/release.yml` 自动打包 + 创建 GitHub Release。

## package.json 关键字段

```jsonc
{
  "name": "dsh-<功能>",
  "version": "0.1.0",
  "type": "module",
  "main": "lib/index.js",
  "exports": { ".": { "default": "./lib/index.js" }, "./client": { "default": "./lib/client.js" }, "./package.json": "./package.json" },
  "files": ["lib", "cordis.patch.yml", "README.md", "CHANGELOG.md", "LICENSE"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" }, "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-runtime"] } },
  "peerDependencies": { "dsh-better-sidebar": "^0.14.0", "cordis": "^4.0.0-rc.8", "react": "^18.2.0" },
  "peerDependenciesMeta": { "dsh-better-sidebar": { "optional": true } },
  "scripts": { "test": "node test/host-smoke.mjs" }
}
```

要点：

- `dsh.bundle.patch` 指向的 `cordis.patch.yml` 会被 `dsh plugin add` 自动应用，**不要在 profile 里手动重复 insert 同一行**（会报 duplicate loader entry）。
- `dsh-better-sidebar` 必须是 **peerDependency**（避免双实例），且 `optional: true`（未安装时插件照常加载、注册代码因 `ctx.betterSidebar` 为 undefined 安全跳过）。

## cordis.patch.yml

```yaml
- insert:
    - id: <插件短名>
      name: '<包名>'
```

`id` 在 profile 内全局唯一。挂载行只负责装载：不要在这里写配置，配置经 `config` 字段且由插件自行校验。

## Client 端接入 better-sidebar

完整 API 与字段见 `references/better-sidebar-api.md`。速查：

```js
// lib/client.js
export const inject = ['betterSidebar']

export function apply(ctx) {
  // 注册页签：disposer 必须包在 effect 里
  ctx.effect(() =>
    ctx.betterSidebar.registerTab({
      id: 'dsh-xxx:page', title: '页面名', order: 50, single: true,
      component: ({ scope }) => createElement(Page, { sessionId: scope.sessionId }),
    })
  )
  // 注册文件预览器
  ctx.effect(() =>
    ctx.betterSidebar.registerFileViewer({
      id: 'dsh-xxx:csv', exts: ['csv'], fetchStrategy: 'custom',
      load: async (path, scope) => { /* POST /sidebar/api/fs.read */ },
      component: ({ customData }) => createElement(CsvGrid, { rows: customData }),
    })
  )
}
```

- **必须** `inject: ['betterSidebar']`，Cordis 保证服务就绪后才激活插件。
- 读文件数据走 `/sidebar/api/fs.read`（POST，body 带 `{ sessionId, path }`），媒体走 `/sidebar/file?sessionId=&path=`；**不要** value-import better-sidebar 内部模块。
- 声明式设置：`settings.pluginToggles`（插件自有行）或 `settings.render`（自定义面板），持久化在 `pluginSettings[id]`，不需要宿主 schema 字段。
- 生命周期：`onOpen/onClose` 在真正打开/关闭 tab 时触发（组件卸载 ≠ tab 关闭）；`visible === false` 时暂停轮询。

## 发布流程（GitHub Release only）

仓库只发 GitHub Release，**不发布 npm**。

1. `plugins/<name>/package.json` 里 `version` 递增（semver：patch/minor/major）。
2. 在 `plugins/<name>/CHANGELOG.md` 顶部加对应 `## [x.y.z]` 段落。
3. 打 tag 并推送：`git tag <包名>@v<版本> && git push origin <包名>@v<版本>`（如 `dsh-server-status@v0.1.0`）。
4. 根 `.github/workflows/release.yml` 自动：在该插件目录跑测试 → 校验 tag 与 package.json 版本一致 → `npm pack` 打 tarball → 提取 CHANGELOG 段落 → 创建 GitHub Release（附件 tarball）。
5. 在仓库 README 插件列表更新新插件条目与版本。

## 常见错误

| 症状 | 根因 | 解决 |
|---|---|---|
| `"tab type ... already registered"` | 重复注册：HMR 残留或 id 冲突 | 注册必须包 `ctx.effect`；id 全局唯一（内置 explorer/git/terminal 等不可占用） |
| 页面没效果 | 只改了 server 端没重启；或没硬刷新 | server 改动重启 `dsh web`；client 改动 Cmd/Ctrl+Shift+R |
| `duplicate loader entry id` | profile 里手动 insert + bundle patch 自动插入重复 | 删掉手动行，只用 `dsh plugin` 安装 |
| `ctx.betterSidebar` undefined | 没声明 `inject` 或服务未加载 | `inject: ['betterSidebar']`；未安装 better 时用 `ctx.get('betterSidebar')` 判空降级 |
| 双 Cordis / 类型分裂 | 同时引用 unscoped 与 scoped cordis | 全链统一一个 cordis（本仓库用 `cordis` peer + link 安装） |
| HMR 后状态错乱 | disposer 没被 fiber 持有 | `ctx.effect(() => register(...))`，绝不裸调 |

## 需要避免的坑

- **不要**在 `apply` 里裸调 `registerTab`（不包 effect）——HMR/禁用后残留，下次激活报 already registered。
- **不要**在 client value-import better-sidebar 内部模块（如 `src/client/api.ts`）——构建纯度门会挡；用 fetch 模式自己请求。
- **不要**在 README/文档里写 "Host 半"——本项目统一叫 **Server 端 / Client 端**。
- **不要**把 `.dsh-vision-toolkit/`、`node_modules/` 等提交进 git。
- 新插件 README 必须中文，顶部放插件生态 badge 与截图。
