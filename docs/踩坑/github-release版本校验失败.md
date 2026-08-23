---
title: GitHub Release 版本校验失败
description: release.yml 校验步骤 expected 带 v 前缀导致任何 tag 都校验失败；已修复
status: 已解决
created: 2026-08-23
updated: 2026-08-23
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
