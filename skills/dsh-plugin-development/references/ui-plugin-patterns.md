# dsh UI 插件实现思路调研（2026-08）

> 调研样本：zhu1090093659/dsh-web-ui（5500★，UI 插件全家桶 monorepo，18+ 插件包）、omdsh-dev/DSH-better-sidebar（右侧面板服务）、nexu-io/open-design（dsh-runtime 设计引擎）、amruthpillai/reactive-resume（dsh-plugin 简历应用）、官方 dsh-io/dsh-plugin-skill。

## 一、项目形态：monorepo 全家桶 vs 单包

| 形态 | 代表 | 特点 |
|------|------|------|
| **monorepo 全家桶** | dsh-web-ui（`packages/dsh-*` 18+ 包） | 每个 UI 功能独立成包、独立 npm 发布（`@linxin666/dsh-*`）；提供**聚合包**（dsh-web-ui-all）：dependencies 收集全部子插件 + `cordis.patch.yml` 汇总所有 insert 行，一次安装全部到位 |
| **单包** | better-sidebar、reactive-resume/dsh-plugin | 一个包一个插件，src + cordis.patch.yml + tsdown |
| **聚合注意事项** | dsh-web-ui-all | 聚合行 id 统一加命名空间前缀（`web-ui-`）避免与独立包冲突；host 半区只注册一次（第二个来源空操作）；子插件随包激活，只想要一部分就装子包 |

## 二、包内结构（通用骨架）

```
my-plugin/
├── src/
│   ├── index.ts            # host 端入口（export name/inject/apply）
│   ├── client/             # 浏览器端（React 组件、api 层、locales）
│   ├── host/               # Node 端（服务、路由、loopback 围栏）
│   └── core/               # 两端共享类型/工具（如 types.ts）
├── tests/                  # vitest 测试（含 .tsx 组件测试）
├── cordis.patch.yml        # insert 行
├── package.json            # dsh 字段（bundle.patch + client.platform/inject）
├── tsconfig.client.json    # 浏览器端编译配置（分端编译）
├── tsconfig.host.json      # Node 端编译配置
├── tsdown.config.ts        # 打包（tsdown，TS 项目）
└── mount-once.ts           # 防重复挂载包装（HMR/重载安全）
```

- **双 tsconfig**：client / host 分端编译，是 TS 插件标配。
- **mount-once**：`apply = mountOnce(id, applyImpl)` 防止重复挂载导致二次注册。

## 三、Client 端 UI 注册方式（重点）

| 方式 | 机制 | 代表 |
|------|------|------|
| **官方 Slot 系统**（推荐） | `declare module '@deepseek-ai/dsh-client-ui-slots'` 扩展 `SlotMap` 声明槽位 + `inject: ['slots', ...]` 后向槽位注册组件；`context`（如 `conversation.input.selector.context` 分支选择器座） | dsh-web-ui/dsh-git-graph |
| **设置面板 slot** | `@deepseek-ai/dsh-settings`：`installSettingsSection` / `settingsNamespace`，注册 `settings.section` 一级分区（通用设置 / 模式 / 插件 / Agent 预设同级） | dsh-web-ui/dsh-pet、community-plugins、skin-center |
| **全局悬浮（不走 slot）** | 全局 UI（宠物等）直接 `createRoot(document.body)` 挂独立 React root——新会话页无 session，会话级 slot 会消失 | dsh-web-ui/dsh-pet |
| **消费方 API** | `ctx.betterSidebar.registerTab` / `registerFileViewer`（better-sidebar 注册表） | 本仓库 dsh-file-activity |

> **i18n 是标配**：`declare module ... LocaleNamespaceMap` 注入语言包；官方有 `@deepseek-ai/dsh-client-locale`。
> **SDK 依赖**：`@deepseek-ai/dsh-client-runtime`、`dsh-client-ui-slots`、`dsh-client-locale`、`dsh-client-ui-conversation`、`dsh-settings` 等（type-only import 触发类型合并）。

## 四、Host 端（Node 侧）模式

- `inject` 官方服务：`webServer`、`sessions`、`subprocess`、`workspaceRegistry`（如 dsh-git-graph 注入 subprocess 执行 git）。
- **安全边界两层**：
  - loopback 信任围栏（本仓库 dsh-file-activity 的 `fence()` 同款）
  - **workspace 门**：`workspaceGate(path)` 校验请求路径必须是已注册的 workspace 根，浏览器只能对 workspace 操作，不能操作任意主机目录（dsh-git-graph 的 `WorkspaceGate`）。
- HTTP 路由 + **SSE 实时推送**（git 图变更流 `sse-leader.ts`）；或 client 轮询（dsh-pet 2s 轮询快照）。
- `ctx.effect(() => registerRoutes(...), '描述')`——路由注册带可读描述，disposer 生命周期。

## 五、Client 端组件设计

- 纯 props 组件 + **注入业务面接口**（`GitGraphInjected`）：组件不直接 fetch，业务动词经 inject 注入。
- 错误边界：渲染失败显示错误条（`RenderBoundary`），不白屏。
- CSS Modules（如 `pet.module.css`）+ 主题。
- 皮肤/主题类 UI：`skin.json` 清单 + 资产目录，由**皮肤中心**唯一加载器动态加载（插件负责逻辑、皮肤负责外观）。

## 六、对本仓库的启示（对比）

| 维度 | 本仓库 dsh-file-activity | 生态成熟做法 |
|------|--------------------------|-------------|
| 注册方式 | better-sidebar registerTab | 官方 Slot 系统 / settings.section 优先级更高，不依赖 better-sidebar 也能挂 UI |
| 通信 | fetch 轮询 stats | 轮询 + SSE 流；UI 事件用同源 JSON 路由 |
| 安全 | loopback 围栏 ✅ | + workspace 门（路径必须属于注册 workspace） |
| 持久化 | $DSH_HOME 防抖原子写 ✅ | 一致 |
| 生命周期 | ctx.effect ✅ | 一致；另有 mount-once 防重复挂载 |
| 构建 | 纯 JS ESM | TS 双端编译 + tsdown |

> 生态验证：官方 Slot 系统是 UI 插件的正路（settings 分区、会话槽位、全局挂载各有适用场景）；消费 better-sidebar 只是其中一种 UI 载体。
