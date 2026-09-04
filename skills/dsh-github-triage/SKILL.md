---
name: dsh-github-triage
description: 使用当 需要检查或处理当前项目 GitHub 仓库的健康问题——打开的 issue、安全漏洞告警（Dependabot/Code Scanning/Secret Scanning）、GitHub Actions 失败、未合并/冲突/CI 失败的 open PR、CICD workflow 维护——并把每个问题分派给子 agent 分析/修复时。典型触发："看看仓库有什么问题""处理一下 CI 失败""跟进依赖告警""看看这些 PR 怎么回事""优化一下 workflow"
---

# GitHub 问题分诊与派发

## 概览

扫描当前项目 GitHub 仓库的 issue / 安全漏洞 / Actions 失败 / open PR / CICD workflow，逐个派发给子 agent 分析处理，最后汇总结果。流程三步：**收集 → 派发（含验收） → 汇总**，问题多时子 agent 并行执行，**每个子任务验收达标后独立提交，互不等待**。子任务隔离用 **git worktree 池**：一个基准 clone + 每任务一个独立 worktree，工作区与分支完全隔离，互不干扰。

## 何时使用

- 用户想检查仓库有哪些待办问题（open issue、依赖漏洞、CI 失败、open PR 健康）
- 用户想"处理一下"某类问题（Action 失败、安全告警、冲突 PR、workflow 优化）
- 定期巡检仓库健康状态

**不使用：** 只是把新需求登记为 issue（用 `dsh-issue-request`）；只是开发本地功能（用 `development-lifecycle`）。

## 总原则（先读）

**本 skill 不包含任何 GitHub 访问实现：不调用 API、不读取 token/凭据、不碰认证细节。** 所有 GitHub 操作——查询、创建/评论 issue、建 PR、合并 PR、发 release——一律使用 `github-ops` 的统一入口 **`ghops`** 命令完成（首次 `ghops setup` 按提示配置一次，之后凭据由其封装，Agent 不接触）。主 agent 与子 agent 均遵守，不得绕过。

本地 git 操作（worktree add/remove、commit、pull、rebase）用原生 `git` 命令；**推送用 `ghops push`**（凭据封装，`--dir` 指向 worktree 目录）。

## 第一步：收集问题

按 `github-ops` 用 `ghops` 命令查询以下内容，返回精简清单（编号/标题/链接/摘要）：

- `ghops issue list baosfeng/my-dsh-plugins --state open` — open issues
- `ghops alerts baosfeng/my-dsh-plugins --state open` — 安全告警（依赖/代码扫描/密钥泄露）
- `ghops actions list baosfeng/my-dsh-plugins --limit 20` — 最近运行，筛出失败的（默认分支优先）
- `ghops pr list baosfeng/my-dsh-plugins --state open` — open PR 健康检查（冲突/CI 红/无 review/超时未合并）
- `ghops actions workflows baosfeng/my-dsh-plugins` — workflow 清单（按需：定时任务缺失、废弃语法、失败率高的 workflow 纳入维护）

具体参数见 `ghops <命令> --help`；命令不存在时用 `python3 <github-ops 技能目录>/scripts/ghops.py` 代替。

## 第二步：派发子 agent

按问题逐个派 `subagent`（默认 `run_in_background: true` 并行）。**每个 prompt 必须自包含**（子 agent 看不到当前对话），包含：仓库、问题完整内容、任务、约束、验收、期望输出：

```
- 背景：仓库 baosfeng/my-dsh-plugins；问题类型+编号+链接；问题标题与正文/告警摘要
- 任务：定位根因（可读本地代码）→ 修复；能改就改，不能改给出根因与建议
- 约束：不 push 主分支；**只在分配给你的 worktree 工作**（/tmp/gh-wt-<编号>，目录已就位，不要 cd 到其他目录）；一任务只一个分支一个 PR，PR 标题带问题编号；任何 GitHub 操作使用 `github-ops` 的 ghops 命令（首次 ghops setup），不得调用 API/读取凭据
- 验收：修复代码 + 本地测试通过（npm test）+ PR 已创建；见「验收标准」逐项自查
- 输出：根因一句话 + 修复方案/变更文件 + PR 链接（如适用）
```

### worktree 池（隔离方案，必须遵守）

主 agent 在工作开始时准备基准 clone 与 worktree，子 agent **只在自己被分配的 worktree 内工作**：

```
ghops clone baosfeng/my-dsh-plugins /tmp/gh-base                    # 主 agent 建基准库（重复使用）
git -C /tmp/gh-base pull                                            # 每次任务前更新到最新 main
git -C /tmp/gh-base worktree add /tmp/gh-wt-<编号> -b fix/<编号>   # 每子任务一个工作树（分支已建好）
```

规则：

- **每个修复类子任务拥有且仅拥有一个 worktree**（`/tmp/gh-wt-<编号>`）；基准库 `/tmp/gh-base` 只供主 agent 更新/添加/清理，子 agent 不得在其中操作
- 子 agent 工作流：worktree 内修改 → `git commit`（worktree 自带独立 index 与分支）→ `ghops push --dir /tmp/gh-wt-<编号> --branch fix/<编号>` → `ghops pr create`
- worktree 共享对象库（省空间、创建秒级），但工作区、index、HEAD、分支**完全隔离**——切分支互相看不见，未提交改动不会交叉混入
- 两个子任务改动同一文件：后完成者先 `git -C /tmp/gh-wt-<编号> pull --rebase origin main` 解决冲突后 push
- 汇总后主 agent 统一清理：`git -C /tmp/gh-base worktree remove --force /tmp/gh-wt-<编号>`；已 push 的分支 refs 保留在基准库，PR 合并后远程分支删除
- worktree 数量 = 问题数量，**完成后必须清理**，避免 /tmp 堆积
- **分析类子任务（只读、不改码）无需 worktree**，可在本地 workspace 只读操作（git log/config 等）
- **信息严重不足的 BUG issue**（无复现步骤/无报错信息）：不派修复类，直接按分析类派发——先评论索要补充信息；调研中确认根因不在本仓库的同样转分析类，不硬修

### 子任务独立提交

- 每个子 agent **验收达标后立即单独提交**（无需等其他子任务）：在分配的 worktree 修改 + `git commit` → `ghops push --dir <worktree> --branch` → `ghops pr create`（标题/正文按下方规范）
- 各子任务分支互不依赖；**一个子任务 = 一个分支 = 一个 PR**，绝不合流到其他人提交
- 无法修复的子任务：把根因与建议作为 `ghops issue comment` 发表到对应 issue（PR 问题则 `ghops pr comment`），不建空 PR
- 创建 PR 即算"独立提交"完成；**是否合并由汇总阶段统一决策**，子 agent 不自行合并

## 验收标准

### 按问题类型判定"已完成"

| 问题类型           | 达标条件                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| issue（BUG/需求）  | 根因确认 + 修复代码 + 本地测试通过 + 已建 PR；一个 PR 只覆盖这一个 issue                                                                                 |
| 安全告警           | 依赖/代码已修复，升级前查 CHANGELOG/breaking changes 确认兼容；测试通过；已建 PR；无修复版本时给出原因与建议并评论到 issue                               |
| Actions 失败       | 先 `ghops actions logs baosfeng/my-dsh-plugins <run-id>` 取日志 → 定位失败步骤与根因 → 修复 + 已建 PR；CI 重跑通过（重跑仍失败则继续排查，不得标记完成） |
| PR 健康检查        | 确认问题（冲突/CI 红/无 review/超时）→ rebase 最新 main 解冲突或修复 CI → CI 重跑绿 → 更新 PR 描述/评论说明；无法处理给建议评论到 PR                     |
| CICD workflow 维护 | 修改目标明确（新增/优化/修复 workflow 文件）→ 本地语法校验（YAML 解析）→ 改动 + 已建 PR → 触发相关 action 重跑通过                                       |
| 分析类（不改代码） | 给出明确结论（无需修复 / 等上游 / 建议方案）并发布到对应 issue/PR                                                                                        |

### 通用要求（所有子任务）

- PR 描述含：**根因、修复内容、验证结果**（测试命令 + 关键输出）；标题遵循仓库提交规范（Conventional Commits，见 .reasonix/skills/commit-standards），格式 `fix(scope): #<编号> 简述`
- 改动聚焦本问题，**不顺手重构无关代码**；遵循仓库质量门禁（.reasonix/skills/quality-gates、coding-standards；测试用 `npm test`，插件改动同步 `docs/<模块>/需求清单.md`）
- **PR 创建后确认 CI 已跑绿**：`ghops actions watch baosfeng/my-dsh-plugins <run-id>` 或 `ghops actions logs` 查结果；红则继续修，不得宣称完成
- 验收未达标的子任务**不得提交 PR**——继续修或转为分析类输出，绝不带着失败提交

## 注意事项

- **[需求]/feature 类 issue 不派子 agent 修复**：改为转 `development-lifecycle` 按需求流程走（确认→开发→验证→发版），本 skill 只处理 BUG / 安全告警 / CI 失败 / PR 健康 / workflow 维护
- 动手前确保代码基于最新 main（`git -C /tmp/gh-base pull` 后 `worktree add`），避免旧分支起手
- 依赖升级先查上游 CHANGELOG、breaking changes，避免大版本跳跃引发连锁失败
- 两个子任务改动同一文件时，后完成者先 rebase 最新 main 再 push，解决冲突后提交
- **不主动关闭 issue**：修复完成后在 issue 评论附 PR 链接，是否关闭等汇总阶段询问用户
- 子 agent 只做自己的提交，**不得合并任何 PR、不得发布 release**——这些留给主 agent 汇总后按用户决策执行
- worktree 用完即清（汇总后 `worktree remove --force`），不得堆积；发现子 agent 跑到 worktree/基准库之外操作立即纠正

## 第三步：汇总

收集所有子 agent 结果，给用户一张汇总表（含验收结论）：

| 问题           | 验收                 | 状态          | 链接        |
| -------------- | -------------------- | ------------- | ----------- |
| issue #12 xxx  | 通过                 | 已提交 PR #18 | https://... |
| dependabot xxx | 未通过（无修复版本） | 已评论建议    | —           |

汇总后需要用户决策的单独列出：**是否合并各 PR、是否关闭对应 issue、是否有破坏性/公开 API 变更**；**验收未通过/卡住的子任务单列并说明原因与下一步**。用户确认后由主 agent 统一执行（`ghops pr merge` / `ghops issue close`）。

## 常见错误

| 错误                                     | 解法                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 子 agent prompt 信息不全                 | 必须自包含：仓库+问题全文+任务+约束+验收+输出格式                                                                                                |
| 一个子 agent 处理所有问题                | 每次只处理一个问题，并行派多个                                                                                                                   |
| 多个子 agent 共用同一 git 仓库           | 各用独立 worktree `/tmp/gh-wt-<编号>`；共享基准库/工作区会互相污染                                                                               |
| worktree 不清理                          | 汇总后 `worktree remove --force`；数量=问题数，用完即清                                                                                          |
| 子 agent 在基准库/他人 worktree 操作     | 只允许操作自己被分配的 worktree 目录                                                                                                             |
| 把 [需求] issue 当 BUG 派子 agent 修     | 需求转 development-lifecycle，本 skill 只处理 BUG/告警/CI/PR/workflow                                                                            |
| 等所有子任务完成才统一提交               | 验收达标即独立提交（分支+PR），各自独立                                                                                                          |
| 一个 PR 混多个问题                       | 一子任务一分支一 PR，标题带编号                                                                                                                  |
| 验收不达标就提交                         | 按验收标准逐项自查：根因/修复/测试/PR 缺一不可                                                                                                   |
| PR 后不管 CI 结果                        | `ghops actions watch/logs` 确认绿，红了继续修                                                                                                    |
| 子 agent 自行合并 PR / 发布 release      | 禁止；合并与发布只在汇总阶段按用户决策执行                                                                                                       |
| 自己写 curl/gh/API 访问 GitHub           | 一律用 github-ops 的 ghops 命令                                                                                                                  |
| 读取/打印 token 或 secrets               | 禁止；凭据由 ghops setup 封装，本 skill 不接触                                                                                                   |
| 只看 issue 漏掉告警/CI/PR                | 四类查询一次跑全（issue/alerts/actions/pr）                                                                                                      |
| 子 agent push 主分支                     | 约束建分支+PR                                                                                                                                    |
| 重复处理已交付的工作                     | 接手前先盘点：`ghops pr list --state all` + main 历史核对每个 issue 是否已合并（closed PR ≠ 未合并，看 merged_at）；已合并的只关 issue，不再派工 |
| 遇到其他代理留下的半成品                 | 先验证（`git status`/`git diff` + `npm test`）再决定接手：代码完整则 rebase 最新 main → push → PR；不完整才重派子 agent                          |
| `ghops pr create` 报 nil is not a string | 需显式加 `--base main`（base 缺省解析失败）                                                                                                      |
| `ghops push` 偶发超时                    | 先 `git ls-remote origin refs/heads/<分支>` 确认是否已推；未推则后台重试，勿重复推                                                               |
