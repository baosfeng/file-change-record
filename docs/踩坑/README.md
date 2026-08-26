---
title: 踩坑记录
description: 项目已知问题与解决方案总索引
created: 2026-08-22
updated: 2026-08-26
---

# 踩坑记录

> 本目录记录项目踩坑与解决方案，按功能域分组。新增踩坑时在对应功能域下创建条目文件。

## 功能域

- [发布 / Release](github-release版本校验失败.md) — release workflow 版本校验格式不一致导致任何 tag 发布失败（已解决，2026-08-23）
- [客户端 UI / 样式](插件页签样式丢失.md) — 插件页签偶发"纯文字无样式"：样式注入放在服务判空早退之后，HMR 瞬间跳过注入（已解决，2026-08-23，v0.4.2）
- [插件集成 / llm 流](llm-stream-async-handler-yield-star.md) — `llm/stream` handler 误用 async function 导致 waterfall 返回 Promise，vision-toolkit `yield*` 委托流崩溃（已解决，2026-08-26，dsh-task-reliability）

## 维护规则

- 记录门槛：编译错误、API 不兼容、持续失败测试、执行过程踩坑
- 每条记录：标题（≤ 30 字）+ 状态 + 解决参考
- 已解决 & 超过 30 天未复现 → 移入 `归档/`

→ [索引.md](../索引.md)
