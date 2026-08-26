# my-dsh-plugins — 个人 DSH（DeepSeek Harness）插件集合仓库

> ⚠️ **修改代码前必须按顺序执行：定位→读取→理解→编码**
>
> 1. **定位** — 在下方「操作前必读规范」表中找到需求对应的文档
> 2. **读取** — `read_file` 读取对应模块文档或规范文档
> 3. **理解** — 确认核心文件路径和关键流程后再编码
>
> ❌ **代码查询一律走知识图谱（禁 explore/grep）：** 项目 `Users-bsfeng-IdeaProjects-my-dsh-plugins` 已索引。查符号/调用链/影响/架构用 `search_graph`/`trace_path`/`query_graph` 等 `mcp__codebase-memory__*` 工具；先 `list_projects`/`index_status` 确认索引，未索引先 `index_repository`，图外事实才 grep/read。细节见 skill `codebase-memory`。

> ⚠️ **副作用操作必须先 ask 用户：** git 提交/推送、删除文件/目录、覆盖已有内容，都须用 `ask` 确认后执行。同一会话内同类操作首次确认后自动授权（提交豁免≠删除豁免）。

## 📁 文档体系

```
docs/
├── 索引.md                   ← 完整文档导航（所有文档的入口）
├── 概览/                     ← 项目全景（项目简介/架构总览/快速上手）
├── 文件活动追踪/             ← dsh-file-activity 插件模块文档（源码: plugins/dsh-file-activity/）
├── 思考增强/                 ← dsh-think-zh-expand 插件模块文档（源码: plugins/dsh-think-zh-expand/）
├── mermaid渲染/              ← dsh-mermaid-render 插件模块文档（源码: plugins/dsh-mermaid-render/）
├── 通知提醒/                 ← dsh-notify 插件模块文档（源码: plugins/dsh-notify/）
├── 插件治理/                 ← dsh-guardian 插件模块文档（源码: plugins/dsh-guardian/）
├── 任务可靠性/               ← dsh-task-reliability 插件模块文档（源码: plugins/dsh-task-reliability/）
├── Skill管理/                ← dsh-skill-manager 插件模块文档（源码: plugins/dsh-skill-manager/）
├── 插件开发技能/             ← 插件开发技能说明（源码: skills/dsh-plugin-development/）
├── 插件开发模式/             ← dsh-plugin-dev-mode agent preset 说明（源码: plugins/dsh-plugin-dev-mode/）
├── 快速集成/                 ← 插件安装与快速开始
├── 开发指南/                 ← 文档规范/构建与测试/lint 配置建议
└── 踩坑/                     ← 已知问题与解决方案
```

> 本项目所有文档位于 `docs/`。首次接触请先读 [索引.md](docs/索引.md)。
> 文档↔源码映射: `docs/文件活动追踪/` → `plugins/dsh-file-activity/`、`docs/思考增强/` → `plugins/dsh-think-zh-expand/`、`docs/mermaid渲染/` → `plugins/dsh-mermaid-render/`、`docs/通知提醒/` → `plugins/dsh-notify/`、`docs/插件治理/` → `plugins/dsh-guardian/`、`docs/任务可靠性/` → `plugins/dsh-task-reliability/`、`docs/Skill管理/` → `plugins/dsh-skill-manager/`，各核心文件的精确路径见对应模块文档。

> 📌 **文档定位原则：** 能被自动化流程加载的内容（skill、脚本、工具）**不写进 docs/ 文档**——流程/方法优先沉淀为 skill 或脚本（如 `development-lifecycle` skill、`scripts/release.mjs`），文档不重复。docs/ 只记录**必须依靠外部才能实现、真的会踩坑**的内容（如 GitHub Release 校验 bug、CDN 不可达等踩坑与外部依赖说明）。新增文档前先问：这个能被 skill/脚本自动化吗？能 → 沉淀为 skill/脚本；不能且会踩坑 → 才写文档。

## 项目简介
- **版本:** 各插件独立 semver（当前主插件 dsh-file-activity v0.4.7；dsh-think-zh-expand v0.4.2；dsh-mermaid-render v0.1.3；dsh-notify v0.2.1；dsh-guardian v0.2.1；dsh-task-reliability v0.1.2；dsh-skill-manager v0.1.0；dsh-plugin-dev-mode v0.1.0） **语言:** JavaScript (Node ≥ 20, ESM) **类型:** 基础服务（DSH 插件集合） **技术栈:** Node.js + Cordis 4 + React 18 + dsh-better-sidebar

> 🧪 测试命令: `cd plugins/<插件名> && npm test`（CI 遍历 `plugins/*/` 执行 `node --check` + 冒烟测试） — 提交前必跑全部测试并修复失败
- [项目简介](docs/概览/项目简介.md) | [架构总览](docs/概览/架构总览.md) | [快速上手](docs/概览/快速上手.md)

> ⚠️ **操作前必读规范（按场景查找）：**
>
> | 当你需要... | 先读此文档 |
> |------------|-----------|
> | **开发/发版插件（完整流程）** | → **[开发生命周期（全局 skill）](~/.dsh/skills/development-lifecycle/SKILL.md)** — 需求→确认→梳理→开发→验证→再验证→确认→发版→文档→release 全流程；发版用 `node scripts/release.mjs <插件名> [--push]` |
> | 修改/理解插件代码（server/client 任一端） | → **[文件活动追踪](docs/文件活动追踪/概述.md)** 或对应模块文档 |
> | **开发/修改插件功能（含新功能）** | → **[需求清单 + 回归检查](docs/开发指南/构建与测试.md#需求回归强制要求)** — 先读插件需求清单，开发后对照既有功能逐条回归；重启恢复/会话隔离/持久化等易碎需求必须有测试断言 |
> | **开发任何功能/修复 BUG/提交前** | → **[质量门禁（强制）](.reasonix/skills/quality-gates/SKILL.md)** — 10 项门禁：TDD 单元测试、Gherkin 验收、QA 流程、圈复杂度 ≤10、函数 ≤40 行/文件 ≤300 行、依赖无环、变异 ≥70%、覆盖率 85/75、bug 复现测试防复发、真实环境验证 |
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
| 插件开发模式 | 插件开发模式、Cordis 工具集、agent preset、plugin-dev | 唯一启用 Cordis 工具集的 Agent 预设：精简工具组合 + 随包技能 + 一键安装（需求见 [docs/插件开发模式/概述.md](docs/插件开发模式/概述.md)） | `plugins/dsh-plugin-dev-mode/agent.cordis.yml`（preset）`plugins/dsh-plugin-dev-mode/scripts/install.mjs`（安装） |
| 通知提醒 | 会话结束提醒、询问提醒、ask 提醒、审批提醒、浏览器通知、提示音、远程 hook | 会话（本轮）结束 / agent 询问 / 等待批准时弹浏览器通知 + 滴声，点击跳转会话；`POST /notify/api/trigger` 远程触发接口（loopback 围栏 + 可选 token）；SSE 实时通道（需求清单见 [docs/通知提醒/需求清单.md](docs/通知提醒/需求清单.md)） | `plugins/dsh-notify/lib/index.js`（server）`plugins/dsh-notify/lib/client.js`（client） |
| 插件治理 | 插件隔离、两段式加载、失败自动禁用、安全模式、候选区、冻结、诊断面板 | 新装/更新插件先进候选区（cordis.staged.json），启动完成后由守护插件逐个热挂载：成功自动转正，失败自动禁用+记录+通知，连续失败冻结，可一键安全模式（需求清单见 [docs/插件治理/需求清单.md](docs/插件治理/需求清单.md)） | `plugins/dsh-guardian/lib/index.js`（server）`plugins/dsh-guardian/lib/client.js`（client） |
| 任务可靠性 | 任务可靠性、超时重试、自动继续、校验 agent、思考重复、重启恢复、自主决策、出行模式、远程触发 | 任务保障：模型超时/请求失败自动重试、任务未完成自动继续（turn-stopping 注入）、独立完成度校验 agent（会话结束后判断，未完成唤醒继续）、思考重复检测与打断、休眠/重启后任务自动恢复、自主决策模式（出行防 ask 中断，问题收集待确认）、远程触发接口（需求清单见 [docs/任务可靠性/需求清单.md](docs/任务可靠性/需求清单.md)） | `plugins/dsh-task-reliability/lib/index.js`（server）`plugins/dsh-task-reliability/lib/client.js`（client） |
| Skill 管理 | skill 管理、全局/项目、启用/禁用、禁用注入、settings 页签、slots | 分「全局 / 项目」查看 skill 列表，按项目启用/禁用：禁用的 skill 被 rank-0 占位 provider 覆盖（模型不可见、不可加载）；全局配置 `$DSH_HOME`、项目配置随仓库版本化；设置页面板走官方 slots 扩展点（需求清单见 [docs/Skill管理/需求清单.md](docs/Skill管理/需求清单.md)） | `plugins/dsh-skill-manager/lib/index.js`（server）`plugins/dsh-skill-manager/lib/client.js`（client） |

## 共享语言
- [术语表](docs/术语表.md) — 项目领域术语权威定义，沟通业务概念前先查阅，避免黑话歧义

## 开发指南
- [代码规范](.reasonix/skills/coding-standards/SKILL.md) · [文档规范](docs/开发指南/文档规范.md) · [提交规范](.reasonix/skills/commit-standards/SKILL.md)
- [构建与测试](docs/开发指南/构建与测试.md) · [测试规范](.reasonix/skills/testing-standards/SKILL.md) · [工程规范](.reasonix/skills/engineering-standards/SKILL.md) · [lint 配置建议](docs/开发指南/lint配置建议.md)
- [质量门禁差距分析](docs/开发指南/质量门禁差距分析.md) · **[P2 模块拆分交接](docs/开发指南/P2模块拆分交接.md)** — 接手剩余工作（G9-G12 拆分 / G3 尺寸门禁）必读

## 踩坑记录 → [踩坑记录](docs/踩坑/README.md)
