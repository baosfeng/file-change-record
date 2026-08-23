# my-dsh-plugins

[![插件生态](https://img.shields.io/badge/插件生态-topic%20dsh--better--sidebar-4d6bfe)](https://github.com/topics/dsh-better-sidebar)

**个人 DSH（DeepSeek Harness）插件集合仓库**：轻量多插件目录，每个插件位于 `plugins/<name>/`，自包含、可独立安装与发布。

## 插件列表

| 插件 | 版本 | 简介 |
|---|---|---|
| [dsh-file-activity](plugins/dsh-file-activity/README.md) | 0.4.3 | 侧边栏文件活动页签：记录文件读取 / 新增 / 修改历史与统计，按文件夹树形展示，点击文件即浮窗预览（复用侧边栏内置渲染）；按会话隔离、重启后恢复 |
| [dsh-think-zh-expand](plugins/dsh-think-zh-expand/README.md) | 0.3.0 | 思考增强：通过 system-prompt 注入让思考与回复强制使用中文；对话中思考内容默认展开显示（替代内置单行折叠），可点击收起、流式中保持展开；文本块与**思考块**都支持 Markdown 渲染（含表格 / Mermaid 图表）；界面英文标签中文化 |
| [dsh-mermaid-render](plugins/dsh-mermaid-render/README.md) | 0.1.1 | 对话 mermaid/mmd 代码块自动渲染为图表卡片（预览/代码切换），mermaid 引擎内联打包、零 CDN 依赖、完全离线可用；流式渲染稳健（等流式结束渲染，避免残缺态） |

## 目录结构

```
├── plugins/          # 所有插件（每目录一个自包含插件）
│   ├── dsh-file-activity/
│   ├── dsh-think-zh-expand/
│   └── dsh-mermaid-render/
├── skills/           # 本仓库的开发技能（SKILL.md 格式，可安装到 ~/.dsh/skills/）
│   └── dsh-plugin-development/
├── docs/             # 通用文档与设计文档
└── .github/workflows/  # CI（遍历插件测试）与 Release（tag 触发）
```

## 开发新插件

仓库内自带插件开发技能（[skills/dsh-plugin-development/SKILL.md](skills/dsh-plugin-development/SKILL.md)）：

```sh
# 将技能安装到个人技能目录（可选，便于 DSH 会话自动加载）
cp -r skills/dsh-plugin-development ~/.dsh/skills/
```

新插件骨架：

1. 按技能指引在 `plugins/<新插件名>/` 下创建自包含插件包（package.json + cordis.patch.yml + lib/ + README + CHANGELOG + LICENSE）。
2. 本地安装验证：`dsh plugin --profile web add link:<绝对路径>/plugins/<新插件名>`。
3. 更新本 README 插件列表与 `plugins/<新插件名>/README.md`（中文 + 截图 + 生态 badge）。
4. 发版：更新版本号与 CHANGELOG → 推送 tag `<包名>@v<版本>` → GitHub Actions 自动创建 Release。

## 发布约定

- 只发布 **GitHub Release**（不发布 npm）。
- tag 格式：`<包名>@v<版本>`（如 `dsh-file-activity@v0.1.0`），由 [release.yml](.github/workflows/release.yml) 自动打包并创建 Release。
- 每个插件独立版本号（semver）、独立 CHANGELOG（Keep a Changelog 格式）。

## 许可

每个插件各自携带 MIT LICENSE；仓库级文档默认 MIT。
