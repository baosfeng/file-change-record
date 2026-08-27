# language: zh-CN
# 需求来源：GitHub issue #24 —— 文件活动列表按文件类型显示专属彩色图标
# 验收基准：test/icons-ext.mjs（fileIconByExt 分派单测）+ test/client-render.mjs（渲染断言）

功能: 文件统计图标按文件类型分派
  作为使用侧边栏文件活动页签的用户
  我想要文件统计行按扩展名显示专属彩色图标
  以便一眼分辨不同文件类型

  场景大纲: 常见文件类型显示专属彩色徽章
    假如 客户端已加载文件活动页签
    当 统计视图加载了文件 "<文件>"
    并且 渲染统计视图
    那么 "<文件>" 行显示 "<徽章>" 徽章

    例子:
      | 文件                    | 徽章       |
      | /work/app.js            | JS         |
      | /work/README.md         | Markdown   |
      | /work/data.json         | JSON       |
      | /work/script.py         | Python     |
      | /work/index.html        | HTML       |
      | /work/style.css         | CSS        |
      | /work/Button.tsx        | TSX        |
      | /work/run.sh            | Shell      |
      | /work/config.yml        | YAML       |
      | /work/Main.java         | Java       |
      | /work/main.c            | C          |
      | /work/main.cpp          | C++        |
      | /work/Program.cs        | C#         |
      | /work/main.go           | Go         |
      | /work/main.rs           | Rust       |
      | /work/app.rb            | Ruby       |
      | /work/index.php         | PHP        |
      | /work/query.sql         | SQL        |
      | /work/App.swift         | Swift      |
      | /work/Main.kt           | Kotlin     |
      | /work/main.dart         | Dart       |
      | /work/Main.scala        | Scala      |
      | /work/main.lua          | Lua        |
      | /work/App.vue           | Vue        |
      | /work/config.xml        | XML        |
      | /work/data.csv          | CSV        |
      | /work/app.db            | DB         |
      | /work/manual.pdf        | PDF        |
      | /work/notes.txt         | TXT        |
      | /work/settings.toml     | TOML       |
      | /work/settings.ini      | CFG        |
      | /work/bundle.zip        | ZIP        |
      | /work/installer.exe     | EXE        |
      | /work/photo.png         | IMG        |
      | /work/app.dockerfile    | Docker     |
      | /work/build.gradle      | Gradle     |
      | /work/notebook.ipynb    | Jupyter    |
      | /work/deploy.ps1        | PowerShell |
      | /work/start.bat         | CMD        |

  场景: 未知扩展名回退为普通文件图标
    假如 客户端已加载文件活动页签
    当 统计视图加载了文件 "/work/notes.xyz"
    并且 渲染统计视图
    那么 "/work/notes.xyz" 行显示普通文件图标

  场景: 无扩展名文件回退为普通文件图标
    假如 客户端已加载文件活动页签
    当 统计视图加载了文件 "/work/LICENSE"
    并且 渲染统计视图
    那么 "/work/LICENSE" 行显示普通文件图标

  场景大纲: 点文件与无扩展名构建文件显示专属徽章
    假如 客户端已加载文件活动页签
    当 统计视图加载了文件 "<文件>"
    并且 渲染统计视图
    那么 "<文件>" 行显示 "<徽章>" 徽章

    例子:
      | 文件                    | 徽章 |
      | /work/.gitignore        | GIT  |
      | /work/.env              | ENV  |
      | /work/Makefile          | MAKE |
      | /work/Dockerfile        | DOCK |
      | /work/CMakeLists.txt    | CMAKE |
