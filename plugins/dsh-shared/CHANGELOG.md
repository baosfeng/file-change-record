# Changelog

本文件记录 dsh-shared 的所有版本变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-28

### 新增

- 首个版本：从各插件 `lib/fence.js` / `lib/http.js` / `lib/config-store.js` 等抽取合并（issue #45）
  - `isTrustedApiRequest` / `header` — Host-header 信任围栏（loopback / trustedHosts / 同源）
  - `readJsonBody` / `writeJson` / `writeError` — HTTP JSON 读写工具
  - `currentProfile` / `profileDirOf` / `patchFileOf` / `extractConfig` / `writePatchConfig` — 配置持久化（cordis.patch.yml YAML 子集读写）
  - `findProjectRoot` — 项目根解析（最近 `.git` 祖先）
  - `withTimeout` / `userMessage` — 超时包装 / user 消息构造
  - `atomicWriteJson` — 原子写 JSON 快照（tmp+rename，自动建目录）
