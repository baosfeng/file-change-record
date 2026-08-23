# my-dsh-plugins — 个人 DSH（DeepSeek Harness）插件集合仓库

> ⚠️ **修改代码前必须按顺序执行：定位→读取→理解→编码**
>
> 1. **定位** — 在下方「操作前必读规范」表中找到需求对应的文档
> 2. **读取** — `read_file` 读取对应模块文档或规范文档
> 3. **理解** — 确认核心文件路径和关键流程后再编码
>
> ❌ 禁止跳过阅读直接 `explore`。如安装了知识图谱工具，**禁止使用 explore**，按序使用：
> ① `list_projects`/`index_status` 确认项目名与索引状态 → ② 未索引先建索引、有变更先增量更新 →
> ③ `search_graph`（语义/符号搜索）、`trace_path`（调用链）、`query_graph`（Cypher 复杂分析）、`search_code`（grep 式）→
> ④ 搜不到才降级：换关键词 → 查文档 → 最后 `explore`/`grep`。

> ⚠️ **副作用操作必须先 ask 用户：** git 提交/推送、删除文件/目录、覆盖已有内容，都须用 `ask` 确认后执行。同一会话内同类操作首次确认后自动授权（提交豁免≠删除豁免）。

## 📁 文档体系

```
docs/
├── 索引.md                   ← 完整文档导航（所有文档的入口）
├── 概览/                     ← 项目全景（项目简介/架构总览/快速上手）
├── 文件活动追踪/             ← dsh-file-activity 插件模块文档（源码: plugins/dsh-file-activity/）
├── 思考增强/                 ← dsh-think-zh-expand 插件模块文档（源码: plugins/dsh-think-zh-expand/）
├── mermaid渲染/              ← dsh-mermaid-render 插件模块文档（源码: plugins/dsh-mermaid-render/）
├── 插件开发技能/             ← 插件开发技能说明（源码: skills/dsh-plugin-development/）
├── 快速集成/                 ← 插件安装与快速开始
├── 开发指南/                 ← 文档规范/构建与测试/lint 配置建议
└── 踩坑/                     ← 已知问题与解决方案
```

> 本项目所有文档位于 `docs/`。首次接触请先读 [索引.md](docs/索引.md)。
> 文档↔源码映射: `docs/文件活动追踪/` → `plugins/dsh-file-activity/`、`docs/思考增强/` → `plugins/dsh-think-zh-expand/`、`docs/mermaid渲染/` → `plugins/dsh-mermaid-render/`，各核心文件的精确路径见对应模块文档。

> 📌 **文档定位原则：** 能被自动化流程加载的内容（skill、脚本、工具）**不写进 docs/ 文档**——流程/方法优先沉淀为 skill 或脚本（如 `development-lifecycle` skill、`scripts/release.mjs`），文档不重复。docs/ 只记录**必须依靠外部才能实现、真的会踩坑**的内容（如 GitHub Release 校验 bug、CDN 不可达等踩坑与外部依赖说明）。新增文档前先问：这个能被 skill/脚本自动化吗？能 → 沉淀为 skill/脚本；不能且会踩坑 → 才写文档。

## 项目简介
- **版本:** 各插件独立 semver（当前主插件 dsh-file-activity v0.4.4；dsh-think-zh-expand v0.3.0；dsh-mermaid-render v0.1.1） **语言:** JavaScript (Node ≥ 20, ESM) **类型:** 基础服务（DSH 插件集合） **技术栈:** Node.js + Cordis 4 + React 18 + dsh-better-sidebar

> 🧪 测试命令: `cd plugins/<插件名> && npm test`（CI 遍历 `plugins/*/` 执行 `node --check` + 冒烟测试） — 提交前必跑全部测试并修复失败
- [项目简介](docs/概览/项目简介.md) | [架构总览](docs/概览/架构总览.md) | [快速上手](docs/概览/快速上手.md)

> ⚠️ **操作前必读规范（按场景查找）：**
>
> | 当你需要... | 先读此文档 |
> |------------|-----------|
> | **开发/发版插件（完整流程）** | → **[开发生命周期（全局 skill）](~/.dsh/skills/development-lifecycle/SKILL.md)** — 需求→确认→梳理→开发→验证→再验证→确认→发版→文档→release 全流程；发版用 `node scripts/release.mjs <插件名> [--push]` |
> | 修改/理解插件代码（server/client 任一端） | → **[文件活动追踪](docs/文件活动追踪/概述.md)** 或对应模块文档 |
> | **开发/修改插件功能（含新功能）** | → **[需求清单 + 回归检查](docs/开发指南/构建与测试.md#需求回归强制要求)** — 先读插件需求清单，开发后对照既有功能逐条回归；重启恢复/会话隔离/持久化等易碎需求必须有测试断言 |
> | **验证/调试插件后** | → **[清理验证环境（强制）](docs/开发指南/构建与测试.md#需求回归强制要求)** — 停后台实例、删 `/tmp/dsh-<port>` 临时目录、关验证浏览器、释放端口；多插件并行开发时残留会互相干扰 |
> | 新建/修改/调试/发布插件 | → **[插件开发技能](skills/dsh-plugin-development/SKILL.md)** — 插件形态、目录结构、发布流程 |
> | 修改/新增代码文件 | → **[代码规范](.reasonix/skills/coding-standards/SKILL.md)** — 编码风格、命名约定 |
> | 创建/修改/删除文档 | → **[文档规范](docs/开发指南/文档规范.md)** — 文档结构、命名规则 |
> | 提交代码到 Git | → **[提交规范](.reasonix/skills/commit-standards/SKILL.md)** — 提交信息格式 |
> | 构建项目或运行测试 | → **[构建与测试](docs/开发指南/构建与测试.md)** — 构建/测试命令 |
> | 安装插件到 DSH | → **[安装与导入](docs/快速集成/安装与导入.md)** — 安装方式 |
> | 了解插件提供的功能 | → **[快速开始](docs/快速集成/快速开始.md)** — 功能一览 |
> | 配置 lint 工具 | → **[lint 配置建议](docs/开发指南/lint配置建议.md)** — lint 工具建议 |
> | 排查已知问题 | → **[踩坑记录](docs/踩坑/README.md)** — 已知问题与解决方案 |
> | 沟通业务概念/术语含义 | → **[术语表](docs/术语表.md)** — 项目共享语言（词汇权威定义） |

## 功能模块

| 模块 | 业务关键词 | 说明 | 源码位置 |
|------|-----------|------|---------|
| 文件活动追踪 | 文件活动、最近访问、文件统计、访问历史、浮窗预览、LRU、会话隔离、重启恢复 | DSH 侧边栏文件活动页签：记录 agent 工具与侧边栏的文件读取/新增/修改事件，按会话隔离、重启后恢复（需求清单见 [docs/文件活动追踪/需求清单.md](docs/文件活动追踪/需求清单.md)） | `plugins/dsh-file-activity/lib/index.js`（server）`plugins/dsh-file-activity/lib/client.js`（client） |
| 思考增强 | 思考中文、中文提示、思考展开、Think 展开、思考折叠 | 思考与回复强制中文（system-prompt 注入）；对话思考内容默认展开显示、可交互折叠（需求清单见 [docs/思考增强/需求清单.md](docs/思考增强/需求清单.md)） | `plugins/dsh-think-zh-expand/lib/index.js`（server）`plugins/dsh-think-zh-expand/lib/client.js`（client） |
| Mermaid 渲染 | mermaid、图表、流程图、时序图、mmd、离线渲染 | 对话 mermaid/mmd 代码块自动渲染为图表卡片（预览/代码切换），引擎内联离线可用（需求清单见 [docs/mermaid渲染/需求清单.md](docs/mermaid渲染/需求清单.md)） | `plugins/dsh-mermaid-render/lib/client.src.js`（client 源码）`plugins/dsh-mermaid-render/lib/client.js`（构建产物） |
| 插件开发技能 | 插件开发、新建插件、发布插件、注册冲突、HMR、Release | 仓库内置插件开发规范：插件形态、目录结构、开发流程、发布流程 | `skills/dsh-plugin-development/SKILL.md` |

## 共享语言
- [术语表](docs/术语表.md) — 项目领域术语权威定义，沟通业务概念前先查阅，避免黑话歧义

## 开发指南
- [代码规范](.reasonix/skills/coding-standards/SKILL.md) · [文档规范](docs/开发指南/文档规范.md) · [提交规范](.reasonix/skills/commit-standards/SKILL.md)
- [构建与测试](docs/开发指南/构建与测试.md) · [测试规范](.reasonix/skills/testing-standards/SKILL.md) · [工程规范](.reasonix/skills/engineering-standards/SKILL.md) · [lint 配置建议](docs/开发指南/lint配置建议.md)

## 踩坑记录 → [踩坑记录](docs/踩坑/README.md)
