---
title: GitHub Release 版本校验失败
description: release.yml 校验步骤 expected 带 v 前缀导致任何 tag 都校验失败；已修复。2026-08-27 补充：tag 指向的 commit 里 package.json 版本与 tag 不匹配（手动 bump 未提交）
status: 已解决
created: 2026-08-23
updated: 2026-08-27
---

# GitHub Release 版本校验失败（release workflow）

## 症状

推送 `<包名>@v<版本>` tag 后，Release workflow 在 `Verify the git tag matches package.json version` 步骤失败，Release 未创建。

## 根因（2026-08-23 实测）

`.github/workflows/release.yml` 的版本校验：

```bash
VERSION="${TAG##*@v}"                    # tag "dsh-file-activity@v0.4.1" → "0.4.1"（不带 v）
expected="v$(node -p "...package.json").version"  # → "v0.4.1"（带 v 前缀）
if [ "$VERSION" != "$expected" ]; then ...  # "0.4.1" != "v0.4.1" → 永远失败
```

`VERSION`（裸版本）与 `expected`（带 v）格式不一致，任何 tag 都会失败。注意 `extract-release-body.mjs` 需要**裸版本**（匹配 CHANGELOG `## [0.4.1]` 标题），所以正确修法是让 `expected` 也不带 v。

## 修复

```bash
expected="$(node -p "require('./plugins/$PLUGIN/package.json').version")"   # 去掉 v 前缀
```

已提交 `e80bedb`。

## 解决参考

- 发布失败先看 Actions 运行日志，定位失败步骤（`https://github.com/<owner>/<repo>/actions`）。
- 修 workflow 后：删除本地+远程 tag（`git tag -d <tag> && git push origin :refs/tags/<tag>`）→ 重新打 tag 推送触发新 run。
- 校验语义：tag 里的版本（`@v` 后部分，裸版本）必须等于 `package.json` 的 `version`（裸版本）。

## 复发（2026-08-27，dsh-md-render@v0.1.1）

### 症状

`dsh-md-render@v0.1.1` tag 推送后 Release workflow 在 `Verify the git tag matches package.json version` 失败（startup_failure 同款），Release 未创建、npm 未发布。

### 根因（与 2026-08-23 不同）

tag 指向的 commit 里 `package.json` 版本是 **0.1.0**（不是 0.1.1）——手动 bump 的 `package.json`/`CHANGELOG.md` 改动**未提交**：

- `release.mjs` 无 `--bump` 时只提交 README/AGENTS 版本同步（`git add README.md AGENTS.md`），**不会提交工作区里手动 bump 的 package.json/CHANGELOG 改动**；
- 于是 tag 指向的 commit 里 package.json 仍是旧版本 → workflow 校验失败。

### 修复

1. 先提交手动 bump 的改动（`git add plugins/<p>/package.json plugins/<p>/CHANGELOG.md && git commit`）；
2. 删除旧 tag（本地+远程）→ 重新打 tag 指向新 commit → push 触发新 run。

### 预防（issue #36）

- `release.mjs --push` 后新增**发版后校验**：轮询 GitHub API 确认 Release 已创建 + `npm view` 确认版本已发布，任一 5 分钟内未完成即 exit 1 并提示；
- `release.yml` 新增失败通知（`if: failure()` 自动创建 `[发版失败]` issue），不再静默失败；
- 手动 bump 后务必先提交再发版（或直接用 `--bump` 让脚本自动 bump + 提交）。
