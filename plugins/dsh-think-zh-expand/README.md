# dsh-think-zh-expand

[![插件生态](https://img.shields.io/badge/插件生态-topic%20dsh-4d6bfe)](https://github.com/topics/dsh)

**DSH 思考增强插件**：让 agent 的思考（reasoning）与回复强制使用中文，并把对话里的思考内容**默认展开显示**（替代内置的单行折叠）。

## 功能

### 1. 思考强制中文（Server 端）

通过 `systemPrompt.section` 注入一条固定系统提示（`order: -90`，persona 之前最先读到）：

> 当你进行思考（reasoning/thinking）时，必须使用中文；给用户的回复也始终使用中文，无论用户使用什么语言。

无论用户用什么语言提问，模型的思考过程与回答都使用中文。

### 2. 思考默认展开（Client 端）

内置的思考块（`ReasoningRow`）默认折叠成单行摘要，只显示第一行；本插件替换 `conversation.chat.node` 的 `assistant-step` 渲染器：

- **思考块默认展开**：完整思考内容直接显示，点击标题行可收起（流式生成中强制保持展开）；
- **文本块轻量 Markdown 渲染**：代码块 / 标题 / 列表 / 引用 / 粗体 / 行内代码 / 链接；
- **图片块**复用内置 `renderMessageImages` 渲染；
- **tool-call 块**与内置行为一致（由独立节点渲染）。

样式全部走 DSH 语义 token（`--dsw-alias-*` / `--dsw-font-*`），随激活注入、随 fiber 卸载，HMR/禁用无残留。

## 工作原理

- **Server 端**（`lib/index.js`）：`inject: ['systemPrompt']`，`apply` 里调用 `ctx.systemPrompt.section({ name: 'dsh-think-zh', order: -90, text })`。section 名避开 `@max-null/dsh-chinese-thinking` 已占用的 `chinese-thinking`（同一层重复 name 会抛错）。
- **Client 端**（`lib/client.js`）：`inject: ['slots']`，用 `ctx.slots.inject('conversation.chat.node', ...)` + `ctx.slots.register({ key: 'assistant-step', priority: -1, registrant: 'dsh-think-zh-expand' }, ...)` 以更低优先级覆盖内置渲染器（与 dsh-better-sidebar 覆盖内置席位的方式一致）。

## 安装

```bash
dsh plugin --profile web add link:/Users/bsfeng/IdeaProjects/my-dsh-plugins/plugins/dsh-think-zh-expand
```

- server 端改动需重启 `dsh web`；
- client 端改动浏览器硬刷新（Cmd/Ctrl+Shift+R）即可。

## 配置

无配置项。插件激活即生效。

## 依赖

| 依赖 | 用途 | 可选 |
|---|---|---|
| `@deepseek-ai/dsh-system-prompt` | host 端 systemPrompt 服务 | 是（缺省时 server 端不注入） |
| `react` | client 端组件 | — |

## 与 @max-null/dsh-chinese-thinking 的关系

如果同时安装了 `@max-null/dsh-chinese-thinking`，两插件会各自注入一条中文提示（内容相近但不冲突，section 名不同）。若只想要本插件的提示，可卸载前者：

```bash
dsh plugin --profile web remove @max-null/dsh-chinese-thinking
```
