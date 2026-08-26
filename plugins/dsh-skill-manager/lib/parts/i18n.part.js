    // ── i18n ──────────────────────────────────────────────────────────────
    function isZh() {
      try {
        const lang = (navigator.language || 'en').toLowerCase()
        return lang.startsWith('zh')
      } catch {
        return false
      }
    }

    const strings = {
      title: () => (isZh() ? 'Skill 管理' : 'Skill Manager'),
      globalSection: () => (isZh() ? '全局' : 'Global'),
      projectSection: () => (isZh() ? '项目' : 'Project'),
      projectHint: () => (isZh()
        ? '输入项目根路径以查看 / 编辑该项目级启用/禁用配置（写入 <项目根>/.dsh/skills.enabled.json，随仓库版本化）'
        : 'Enter a project root to view/edit its per-project skill config (stored in <projectRoot>/.dsh/skills.enabled.json)'),
      loadProject: () => (isZh() ? '加载' : 'Load'),
      enabled: () => (isZh() ? '启用' : 'Enabled'),
      disabled: () => (isZh() ? '已禁用' : 'Disabled'),
      loading: () => (isZh() ? '加载中…' : 'Loading…'),
      loadError: () => (isZh() ? '加载失败' : 'Load failed'),
      empty: () => (isZh() ? '暂无 skill' : 'No skills yet'),
      sourceProject: (source) => (isZh() ? `项目（${source}）` : `project (${source})`),
      sourceGlobal: (source) => (isZh() ? `全局（${source}）` : `global (${source})`),
      disabledHint: () => (isZh()
        ? '禁用的 skill 不再注入本项目/全局会话：模型不可见、不可加载（占位覆盖）'
        : 'A disabled skill is no longer injected into this scope: the model cannot see or load it (placeholder override)'),
      projectRoot: () => (isZh() ? '项目根：' : 'Project root: '),
      projectConfigNote: () => (isZh()
        ? '项目配置随仓库提交，可版本化；全局配置存于 $DSH_HOME'
        : 'Project config travels with the repo; global config lives in $DSH_HOME'),
      saved: () => (isZh() ? '已保存' : 'Saved'),
      saveFailed: () => (isZh() ? '保存失败' : 'Save failed'),
    }
