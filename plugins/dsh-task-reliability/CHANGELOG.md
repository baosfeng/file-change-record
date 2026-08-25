# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-24

### Added

- 任务可靠性保障首个版本：
  - 任务注册表（持久化 `$DSH_HOME/task-reliability.json`，原子写 + 防抖）
  - 模型超时/请求失败自动重试（`agent/request-error` 接管，退避 + 上限）
  - 任务未完成自动继续（`agent/turn-stopping` + steer，含防死循环护栏）
  - 完成度校验 agent（会话结束后独立 agent 判断完成度，未完成唤醒继续）
  - 思考重复检测与干预（`llm/stream` reasoning 相似度检测 + 打断指令 + 参数调整）
  - 休眠/重启后任务恢复（启动扫描 + `agents.resume` + 继续指令，幂等）
  - 自主决策模式（出行模式）：ask 拦截自动决策 + 待确认问题收集 + 自动批准
  - 远程触发接口（`POST /task-reliability/api/trigger`，loopback + token）
  - 侧边栏页签 UI（模式开关 / 任务列表 / 待确认问题）
