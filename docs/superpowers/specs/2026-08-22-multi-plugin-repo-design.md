# my-dsh-plugins：多插件仓库改造设计

> 日期：2026-08-22
> 状态：已批准（用户确认结构、tag 规则、本地改名方案）

## 背景与目标

当前仓库 `file-change-record` 是单一插件 `dsh-file-activity` 的根目录布局。用户希望将仓库定位为**个人 DSH 插件集合仓库**，后续会新增多个插件与其他变动。

目标：

- 仓库改名 `my-dsh-plugins`（GitHub 保留重定向），本地目录同步改名。
- 轻量多插件目录结构，每个插件自包含、可独立发布/拆仓。
- 发布规则支持多插件共存（tag 带插件前缀），CI 自动遍历全部插件。
- 现有插件 `dsh-file-activity` 与既有 GitHub Release v0.1.0 完整保留。

## 目录结构

```
my-dsh-plugins/
├── README.md                  # 总览：插件索引（替换现有插件 README 的根位置）
├── docs/                      # 通用文档（预留：开发指南、规范）
├── plugins/
│   └── dsh-file-activity/     # 现有插件整体迁入（git mv 保留历史）
│       ├── lib/               # 插件代码（index.js / client.js）
│       ├── test/              # 测试（CI 只跑 host-smoke.mjs）
│       ├── assets/            # 截图等
│       ├── package.json       # name 保持 dsh-file-activity
│       ├── cordis.patch.yml
│       ├── README.md          # 插件自身说明（安装路径改为新结构）
│       ├── LICENSE            # MIT
│       └── CHANGELOG.md
└── .github/workflows/         # ci.yml / release.yml（保留在根）
```

要点：

- 每个插件子目录自包含 `package.json` + `cordis.patch.yml` + README + LICENSE + CHANGELOG。
- 根目录不设 workspace，不引入 pnpm monorepo 依赖管理。
- `.github/scripts/extract-release-body.mjs` 保留在根目录，改为接受 CHANGELOG 路径参数。

## 发布规则（tag 格式变更）

多插件共存后，`v<version>` 格式 tag 会互相冲突，改用：

```
<插件目录名>@v<版本>
```

示例：`dsh-file-activity@v0.1.0`。

release.yml 逻辑：

1. 从 `GITHUB_REF_NAME` 解析插件目录名与版本（`<name>@v<version>`）。
2. 校验 `plugins/<name>/package.json` 的 version 与 tag 一致。
3. 在插件目录内跑 `npm test`（host-smoke）。
4. `npm pack` 在插件目录打包 tarball 到 `dist/`。
5. 用 `extract-release-body.mjs` 从该插件的 CHANGELOG.md 提取 release notes。
6. 创建 GitHub Release（附件为该插件的 tarball，名称用 tag 名）。

ci.yml 逻辑（push main/master + PR）：

- 遍历 `plugins/*/`，对每个含 package.json 的插件执行语法检查（`node --check lib/*.js`）+ `npm test`。

## 仓库改名与本地同步

- GitHub API：`PATCH /repos/baosfeng/file-change-record` → `name: my-dsh-plugins`（自动重定向旧链接）。
- 本地目录：`file-change-record` → `my-dsh-plugins`；`git remote set-url origin git@github.com:baosfeng/my-dsh-plugins.git`。
- 用户 DSH profile 更新：`~/.dsh/profiles/web/package.json` 中 `dsh-file-activity` 的 `link:` 路径改为 `<新路径>/plugins/dsh-file-activity`；profile 的 `cordis.patch.yml` 挂载行（id: file-activity）不变。
- 根 README 的安装示例同步改为新路径。

## 资产保留

- GitHub Release v0.1.0（旧 tag）保留，后续版本用新 tag 规则。
- 插件名 / 包名 `dsh-file-activity` 不变。
- Git 历史通过 `git mv` 保留。

## 实施范围（本阶段）

1. GitHub 改名 + 本地目录改名 + remote 更新。
2. `git mv` 现有文件到 `plugins/dsh-file-activity/`。
3. 重写根 README 为插件索引（中文）；插件 README 内安装路径更新。
4. 更新 ci.yml（遍历插件）与 release.yml（tag 解析）；extract-release-body.mjs 支持 CHANGELOG 路径参数。
5. 新建 `docs/` 预留目录。
6. 提交推送，验证 CI 通过。
7. 更新用户 DSH profile 的 link 路径（需用户确认执行）。
