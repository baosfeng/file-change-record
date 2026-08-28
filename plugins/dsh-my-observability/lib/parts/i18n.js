    // ── i18n（浏览器语言判定）──────────────────────────────────────────
    function isZh() {
      try {
        const lang = (navigator.language || 'en').toLowerCase()
        return lang.startsWith('zh')
      } catch {
        return false
      }
    }

    const strings = {
      replayTitle: () => (isZh() ? '轨迹回放' : 'Trajectory'),
      gitTitle: () => (isZh() ? 'Git 工具' : 'Git Tools'),
      allSessions: () => (isZh() ? '全部会话' : 'All sessions'),
      filterAll: () => (isZh() ? '全部' : 'All'),
      filterStatus: () => (isZh() ? '状态' : 'Status'),
      filterLlm: () => (isZh() ? '模型流' : 'LLM'),
      filterTools: () => (isZh() ? '工具' : 'Tools'),
      emptyEvents: () => (isZh() ? '暂无审计事件——开始一段对话后，agent 的行为会出现在这里' : 'No audit events yet — agent activity will appear here after a conversation'),
      loadError: () => (isZh() ? '加载失败' : 'Load failed'),
      typeAgentStatus: () => (isZh() ? 'agent 状态' : 'agent status'),
      typeLlmStream: () => (isZh() ? '模型流' : 'LLM stream'),
      typeToolCall: () => (isZh() ? '工具调用' : 'tool call'),
      typeToolResult: () => (isZh() ? '工具结果' : 'tool result'),
      phaseStart: () => (isZh() ? '开始' : 'start'),
      phaseEnd: () => (isZh() ? '结束' : 'end'),
      phaseError: () => (isZh() ? '错误' : 'error'),
      agentTop: () => (isZh() ? '顶层' : 'top'),
      agentSub: () => (isZh() ? '子代理' : 'subagent'),
      agentUnknown: () => (isZh() ? '未知' : 'unknown'),
      toolOk: () => (isZh() ? '成功' : 'ok'),
      toolFail: () => (isZh() ? '失败' : 'failed'),
      // Git 面板
      repoLabel: () => (isZh() ? '仓库路径' : 'Repo path'),
      repoPlaceholder: () => (isZh() ? '如 /path/to/project' : 'e.g. /path/to/project'),
      loadRepo: () => (isZh() ? '加载' : 'Load'),
      branch: () => (isZh() ? '分支' : 'Branch'),
      staged: () => (isZh() ? '已暂存' : 'staged'),
      unstaged: () => (isZh() ? '未暂存' : 'unstaged'),
      clean: () => (isZh() ? '工作区干净' : 'Working tree clean'),
      diffTitle: () => (isZh() ? '差异' : 'Diff'),
      showDiff: () => (isZh() ? '查看差异' : 'Show diff'),
      showStagedDiff: () => (isZh() ? '查看暂存差异' : 'Staged diff'),
      noChanges: () => (isZh() ? '没有变更' : 'No changes'),
      review: () => (isZh() ? '提交前审查' : 'Review'),
      reviewAi: () => (isZh() ? 'AI 审查' : 'AI review'),
      reviewResult: () => (isZh() ? '审查结果' : 'Review result'),
      reviewPass: () => (isZh() ? '未发现问题' : 'No issues found'),
      issues: (count) => (isZh() ? `${count} 个问题` : `${count} issue(s)`),
      commitTitle: () => (isZh() ? '类型化提交' : 'Typed commit'),
      commitType: () => (isZh() ? '类型' : 'Type'),
      commitScope: () => (isZh() ? '范围（可选）' : 'Scope (optional)'),
      commitDesc: () => (isZh() ? '描述' : 'Description'),
      commitBody: () => (isZh() ? '正文（可选）' : 'Body (optional)'),
      commit: () => (isZh() ? '提交' : 'Commit'),
      committed: () => (isZh() ? '已提交' : 'Committed'),
      commitError: () => (isZh() ? '提交失败' : 'Commit failed'),
      severityError: () => (isZh() ? '错误' : 'Error'),
      severityWarning: () => (isZh() ? '警告' : 'Warning'),
      severityInfo: () => (isZh() ? '提示' : 'Info'),
      aiVerdictApprove: () => (isZh() ? 'AI 结论：可以提交' : 'AI verdict: approve'),
      aiVerdictChanges: () => (isZh() ? 'AI 结论：建议修改' : 'AI verdict: changes'),
      aiFailed: () => (isZh() ? 'AI 审查不可用' : 'AI review unavailable'),
      loading: () => (isZh() ? '加载中…' : 'Loading…'),
      emptyDiff: () => (isZh() ? '（空）' : '(empty)'),
      noRepo: () => (isZh() ? '请输入仓库路径' : 'Enter a repo path'),
    }
