---
title: npm 发布补发与 latest 覆盖
description: tag 已存在时重推不触发 npm 发布；发布顺序颠倒导致 dist-tags.latest 指向旧版
created: 2026-09-01
updated: 2026-09-01
---

# npm 发布补发与 latest 覆盖

## 现象 1：tag 已存在，重推 tag 不触发 Release workflow 的 npm 发布

`release.yml` 的 npm 发布步骤（`npm publish --access public`）只在 **tag 首次推送**时随 workflow 执行。若某次发版时 npm 发布缺失（如当时 `NPM_TOKEN` 未配置、或发布失败被 warning 吞掉），**重推同名 tag 不会重新触发 npm 发布**——GitHub 对已存在的 tag 拒绝重复推送（`git push origin <tag>` 报 already exists），且即使删除重推，`npm publish` 也会因版本已存在而失败（E403: You cannot publish over the previously published versions）。

**案例**：dsh-shared@v0.1.0（2026-08-28 发版时 npm 未发布，404；2026-09-01 补发时发现 tag 已存在）。

**解决**：删除远程 tag + 本地 tag → 重新打 tag 指向最新 main → 推送触发 workflow → npm 发布成功（版本不存在时）。注意：删除 tag 是破坏性操作，需确认。

## 现象 2：dist-tags.latest 被后发布的旧版本覆盖

npm 的 `latest` dist-tag 指向**最后发布**的版本，而非版本号最大的版本。若两个版本发布顺序颠倒（如 0.4.5 先发布、0.4.4 后发布），`latest` 会指向 0.4.4，用户 `npm install <pkg>` 装到旧版。

**案例**：dsh-think-zh-expand 0.4.5（08-31 14:46 发布）→ 0.4.4（08-31 14:53 发布），latest 指向 0.4.4；且 npm 0.4.5 是旧代码（不含后续合并的 #73 修复）。

**解决**：发版一个**新版本**（bump patch，如 0.4.6），npm 发布后 latest 自动更新为新版本。不要试图重推旧版本（E403）。

## 检查方法（定期巡检）

```bash
# 对比每个插件的 npm latest 与最新 git tag
for p in <插件名列表>; do
  latest=$(curl -s https://registry.npmjs.org/$p | python3 -c "import json,sys; print(json.load(sys.stdin).get('dist-tags',{}).get('latest','?'))")
  tagver=$(git tag --list "$p@v*" --sort=-v:refname | head -1 | sed 's/.*@v//')
  echo "$p: latest=$latest tag=$tagver"
done
```

不一致即需处理（发新版或补发）。

## 相关

- `release.yml` 的 npm 发布步骤：`if [ -z "$NPM_TOKEN" ]` 跳过；发布失败仅 warning 不阻塞（GitHub Release 始终是主交付物）
- 仓库 `NPM_TOKEN` secret 已配置（2026-09-01 确认，dsh-my-notify@0.3.5 通过此通道发布成功）
