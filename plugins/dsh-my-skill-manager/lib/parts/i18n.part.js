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
  projectHint: () =>
    isZh()
      ? '输入项目根路径以查看 / 编辑该项目级启用/禁用配置（写入 <项目根>/.dsh/skills.enabled.json，随仓库版本化）'
      : 'Enter a project root to view/edit its per-project skill config (stored in <projectRoot>/.dsh/skills.enabled.json)',
  loadProject: () => (isZh() ? '加载' : 'Load'),
  refresh: () => (isZh() ? '刷新' : 'Refresh'),
  enabled: () => (isZh() ? '启用' : 'Enabled'),
  disabled: () => (isZh() ? '已禁用' : 'Disabled'),
  loading: () => (isZh() ? '加载中…' : 'Loading…'),
  loadError: () => (isZh() ? '加载失败' : 'Load failed'),
  empty: () => (isZh() ? '暂无 skill' : 'No skills yet'),
  sourceProject: (source) => (isZh() ? `项目（${source}）` : `project (${source})`),
  sourceGlobal: (source) => (isZh() ? `全局（${source}）` : `global (${source})`),
  notCataloged: () => (isZh() ? '未收录' : 'Not cataloged'),
  notCatalogedHint: () =>
    isZh()
      ? '该 skill 存在于目录但未被官方目录收录（不注入会话）；可能是 filesystem 发现未启用或扫描器跳过'
      : 'This skill exists on disk but is not in the official catalog (not injected); filesystem discovery may be disabled or the scanner skipped it',
  disabledHint: () =>
    isZh()
      ? '禁用的 skill 不再注入本项目/全局会话：模型不可见、不可加载（占位覆盖）'
      : 'A disabled skill is no longer injected into this scope: the model cannot see or load it (placeholder override)',
  projectRoot: () => (isZh() ? '项目根：' : 'Project root: '),
  projectConfigNote: () =>
    isZh()
      ? '项目配置随仓库提交，可版本化；全局配置存于 $DSH_HOME'
      : 'Project config travels with the repo; global config lives in $DSH_HOME',
  saved: () => (isZh() ? '已保存' : 'Saved'),
  saveFailed: () => (isZh() ? '保存失败' : 'Save failed'),
  diagnosticsTitle: () => (isZh() ? '扫描诊断' : 'Scan diagnostics'),
  diagnosticsHint: () =>
    isZh()
      ? '以下条目存在于 skill 目录但未被收录（可能被官方扫描器跳过）：'
      : 'These entries exist in a skill directory but were not cataloged (likely skipped by the scanner):',
  diagReason: (reason) =>
    isZh()
      ? ({
          'broken-symlink': '符号链接无法解析（目标不存在）',
          'missing-skills-md': '目录缺少 SKILL.md',
          'missing-frontmatter': '缺少 YAML frontmatter',
          'missing-name-description': 'frontmatter 缺少 name 或 description',
          'invalid-name': 'skill 名称不符合 kebab-case 规范',
          unparseable: 'frontmatter 解析失败或字段异常（官方扫描器未收录）',
        }[reason] ?? reason)
      : reason,
}
