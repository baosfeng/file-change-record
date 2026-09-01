# Changelog

本文件记录 dsh-my-guard 的所有版本变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.2] - 2026-09-01

### 变更

- fix(ui): 9 个插件未定义 token danger-primary 改用 error-primary（DSH 主题仅定义 business/error/success/warn）

## [0.1.1] - 2026-08-28

### 变更

- feat(ui): dsh-my-guard 安全护栏面板翻新——图标/前缀/状态/交互（issue #54）
- fix(security): 修复 CodeQL 告警——正则 ReDoS/随机数/命令注入（issue #5/#6/#7/#9/#10）
- refactor(shared): 抽取 dsh-shared 共享工具包，10 个插件迁移消除重复实现（issue #45）
- chore(deps): 升级 react 19 兼容性——13 个插件 peer 声明 ^18.2.0 || ^19.2.0（issue #49）
- style(format): 全仓 prettier 格式化（issue #44）

## [0.1.0] - 2026-08-28

### 新增

- **执行前护栏（issue #52）**：监听 `tools/pre-execute`（waterfall），bash 命令匹配破坏性模式（rm -rf /、mkfs、dd 写设备、fork 炸弹、chmod 777 /、chown -R、关机/重启、写块设备、curl|sh 下载执行）→ 记录 high 告警；三种模式：`observe`（默认，只读观察透传 next()，不改变工具/审批流程）/ `ask`（返回 `{ kind: 'ask' }` 触发 DSH 原生审批确认）/ `deny`（直接拦截）。
- **安装前投毒扫描**：检测 `dsh plugin add <pkg>` 命令自动扫描包内容（异步不阻塞）：link:/本地路径直接扫目录，包名经 npm registry 下载 tarball 扫描（绝不执行包内代码）；检测项：package.json scripts 可疑命令（下载执行/eval/base64/chmod +x/curl POST/node -e/python -c/git clone/再装依赖/写 /etc/crontab/.ssh）、密钥模式（私钥/AWS/GitHub PAT/OpenAI/Slack/Google/硬编码凭据）、已知被投毒/恶意依赖名、可疑文件扩展名；`POST /guard/api/scan` 手动扫描。
- **提示注入检测**：规则 + 启发式（忽略先前指令/系统提示词覆盖/越狱 DAN/角色越权/敏感信息外传/编码混淆/禁用安全机制，中英文）；监听 `session/event` 的 `user/message`（过滤插件注入消息）自动检测；`POST /guard/api/scan-prompt` 手动检测。
- **告警存储 + 用户确认机制**：三类告警统一记录，持久化 `$DSH_HOME/guard/alerts.json`（防抖 + 原子写 + 重启恢复），上限 500 条 FIFO；`GET /guard/api/alerts` 查询（类型/会话过滤 + limit）、`POST /guard/api/alerts/confirm` 标记已确认；`GET /guard/api/status` 状态 + 配置；全部经 loopback 信任围栏。
- **侧边栏安全护栏面板**：页签 `dsh-my-guard:guard`——告警列表（类型徽标 + 严重度 + 时间 + 确认按钮）+ 投毒扫描工具 + 提示注入检测工具；可见时 5s 轮询、隐藏暂停。
- **测试**：`test/host-guard.mjs`（破坏性检测/三种模式/联动扫描）、`test/host-poison.mjs`（扫描引擎各检测项/tarball/目标解析）、`test/host-injection.mjs`（规则引擎/监听器/插件消息过滤）、`test/host-store.mjs`（持久化/重启恢复/缓冲/上限/确认）、`test/host-mutation.mjs`（变异补充）；Gherkin 验收（guard/poison/injection 3 个 feature 18 场景）；覆盖率 行 95% / 分支 88%；变异测试 ≥70%。

**真实环境验证**（独立端口 3081 隔离实例）：

- 侧边栏「安全护栏」页签出现，告警列表/扫描工具/注入检测工具可用；
- 破坏性命令、投毒扫描、提示注入三类告警真实产生并可确认；
- 重启验证实例后告警恢复。
