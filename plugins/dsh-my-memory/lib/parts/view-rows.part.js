// ── view-rows: row/entry widgets for the Memory tab ─────────────────────
// 拆分自 view.part.js（issue #110 视觉重设计）：条目卡片、空状态、排序开关、
// 新增栏与确认面板。纯渲染组件，共用 view 工厂作用域内的 strings/icon/utils。
/** 排序开关：按更新时间切换最新/最旧优先（每分区独立）。 */
function SortToggle({ scope, order, onSort }) {
  return createElement(
    'button',
    {
      className: 'dsh-my-memory-sort',
      'aria-label': `${strings.sortLabel()} ${scope}`,
      onClick: () => onSort(scope),
    },
    icon.clock(12),
    order === 'desc' ? strings.sortNewest() : strings.sortOldest(),
  )
}

/** 空状态：无条目时的引导（hint 优先，如无会话项目提示输入项目根路径）。 */
function EmptyState({ hint }) {
  return createElement(
    'div',
    { className: 'dsh-my-memory-empty' },
    createElement('span', { className: 'dsh-my-memory-empty-icon' }, icon.file(16)),
    createElement(
      'div',
      { className: 'dsh-my-memory-empty-body' },
      createElement('span', { className: 'dsh-my-memory-empty-main' }, strings.empty()),
      createElement('span', { className: 'dsh-my-memory-empty-hint' }, hint ?? strings.emptyHint()),
    ),
  )
}

/** 新增条目的输入 + 保存按钮；超长时给出精简提示（issue #105）。 */
function AddBar({ scope, value, onChange, onAdd, entryLimit }) {
  return createElement(
    'div',
    { className: 'dsh-my-memory-addbar-wrap' },
    createElement(
      'div',
      { className: 'dsh-my-memory-addbar' },
      createElement('input', {
        className: 'dsh-my-memory-add-input',
        placeholder: strings.addPlaceholder(),
        value,
        onChange: (event) => onChange(event.target.value),
      }),
      createElement(
        'button',
        {
          className: 'dsh-my-memory-btn-save',
          'aria-label': `${strings.add()} ${scope}`,
          onClick: onAdd,
        },
        icon.plus(14),
        strings.add(),
      ),
    ),
    isOverEntryLimit(value, entryLimit)
      ? createElement(
          'div',
          { className: 'dsh-my-memory-entry-hint' },
          strings.entryTooLongHint(value.length, entryLimit),
        )
      : null,
  )
}

function buildRows(items, scope, editing, onEdit, onEditDesc, onCancelEdit, onConfirm, expanded, onToggle) {
  return items.map((item) => {
    const isEditing = editing !== null && editing.scope === scope && editing.id === item.id
    const key = `${scope}/${item.id}`
    return createElement(MemoryRow, {
      key,
      item,
      isEditing,
      isExpanded: expanded.has(key),
      editingDesc: isEditing ? editing.desc : '',
      onEdit: () => onEdit(scope, item.id, item.desc),
      onEditDesc,
      onCancelEdit,
      onSaveEdit: () => onConfirm({ kind: 'update', scope, id: item.id, desc: editing.desc }),
      onDelete: () => onConfirm({ kind: 'delete', scope, id: item.id, desc: item.desc }),
      onToggle: () => onToggle(key),
    })
  })
}

function IconButton({ className, label, onClick, children }) {
  return createElement('button', { className, 'aria-label': label, onClick }, children)
}

/** 编辑态：输入 + 保存/取消，保留卡片底与操作/内容分离。 */
function MemoryRowEdit({ editingDesc, onEditDesc, onSaveEdit, onCancelEdit }) {
  return createElement(
    'div',
    { className: 'dsh-my-memory-row dsh-my-memory-row-editing' },
    createElement('input', {
      className: 'dsh-my-memory-add-input',
      value: editingDesc,
      onChange: (event) => onEditDesc(event.target.value),
    }),
    createElement(
      'div',
      { className: 'dsh-my-memory-actions' },
      createElement(
        'button',
        { className: 'dsh-my-memory-btn-save', onClick: onSaveEdit },
        icon.check(14),
        strings.save(),
      ),
      createElement(
        'button',
        { className: 'dsh-my-memory-btn', onClick: onCancelEdit },
        icon.close(14),
        strings.cancel(),
      ),
    ),
  )
}

/** 一条记忆卡片：描述（+截断/展开）+ 操作图标组 + 元数据（分类/置信度/
 *  冲突/演进历史，issue #78）+ 更新时间。 */
function MemoryRow({
  item,
  isEditing,
  isExpanded,
  editingDesc,
  onEdit,
  onEditDesc,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggle,
}) {
  if (isEditing) return createElement(MemoryRowEdit, { editingDesc, onEditDesc, onSaveEdit, onCancelEdit })
  const cut = truncateText(item.desc)
  const shown = isExpanded ? item.desc : cut.text
  return createElement(
    'div',
    { className: 'dsh-my-memory-row' },
    createElement(
      'div',
      { className: 'dsh-my-memory-row-head' },
      createElement(
        'div',
        { className: 'dsh-my-memory-row-desc-wrap' },
        createElement('span', { className: 'dsh-my-memory-desc' }, shown),
        cut.truncated
          ? createElement(
              'button',
              {
                className: `dsh-my-memory-expand${isExpanded ? ' dsh-my-memory-expand-open' : ''}`,
                'aria-label': isExpanded ? strings.collapse() : strings.expand(),
                onClick: onToggle,
              },
              icon.chevronDown(14),
              isExpanded ? strings.collapse() : strings.expand(),
            )
          : null,
      ),
      createElement(
        'div',
        { className: 'dsh-my-memory-actions' },
        createElement(
          IconButton,
          { className: 'dsh-my-memory-iconbtn', label: `${strings.edit()} ${item.id}`, onClick: onEdit },
          icon.pencil(14),
        ),
        createElement(
          IconButton,
          {
            className: 'dsh-my-memory-iconbtn dsh-my-memory-iconbtn-danger',
            label: `${strings.delete()} ${item.id}`,
            onClick: onDelete,
          },
          icon.trash(14),
        ),
      ),
    ),
    createElement(MetadataRow, { item, isExpanded, onToggle }),
  )
}

/** 概要预览行（issue #105）：add/update 内容超长时提示「完整内容保存 + 显示概要」。 */
function SummaryPreview({ desc }) {
  const summary = truncateText(desc, TRUNCATE_LEN)
  return createElement(
    'div',
    { className: 'dsh-my-memory-confirm-summary' },
    createElement('span', { className: 'dsh-my-memory-confirm-summary-label' }, strings.summaryPreview()),
    createElement('span', { className: 'dsh-my-memory-confirm-summary-text' }, summary.text),
  )
}

/** 自定义确认面板（ask 模式，非原生 confirm）：删除红、保存绿。
 *  add/update 时若内容超长，显示概要预览（完整内容仍保存，issue #105）。 */
function ConfirmPanel({ confirm, onCancel, onOk, entryLimit }) {
  const isDelete = confirm.kind === 'delete'
  const text = CONFIRM_TEXTS[confirm.kind]()
  const showSummary = !isDelete && isOverEntryLimit(confirm.desc, entryLimit)
  return createElement(
    'div',
    { className: `dsh-my-memory-confirm dsh-my-memory-confirm-${isDelete ? 'delete' : 'save'}` },
    createElement(
      'div',
      { className: 'dsh-my-memory-confirm-head' },
      isDelete ? icon.trash(15) : icon.check(15),
      createElement('div', { className: 'dsh-my-memory-confirm-text' }, text),
    ),
    createElement('div', { className: 'dsh-my-memory-confirm-desc' }, confirm.desc),
    showSummary ? createElement(SummaryPreview, { desc: confirm.desc }) : null,
    createElement(
      'div',
      { className: 'dsh-my-memory-confirm-actions' },
      createElement(
        'button',
        {
          className: `dsh-my-memory-confirm-ok dsh-my-memory-confirm-ok-${isDelete ? 'delete' : 'save'}`,
          onClick: onOk,
        },
        isDelete ? icon.trash(14) : icon.check(14),
        isDelete ? strings.confirmDeleteBtn() : strings.confirmSave(),
      ),
      createElement(
        'button',
        { className: 'dsh-my-memory-confirm-cancel', onClick: onCancel },
        icon.close(14),
        strings.cancel(),
      ),
    ),
  )
}

/** 确认面板标题文案（按 kind 取；未知 kind 回落删除文案）。 */
const CONFIRM_TEXTS = {
  add: () => strings.confirmAdd(),
  update: () => strings.confirmUpdate(),
  delete: () => strings.confirmDelete(),
}

/** 一条待确认候选（issue #78）：分类徽标 + 描述 + 范围 + 来源 + 确认/拒弃。 */
function CandidateRow({ candidate, busy, onConfirm, onDismiss }) {
  return createElement(
    'div',
    { className: 'dsh-my-memory-row dsh-my-memory-row-candidate' },
    createElement(
      'div',
      { className: 'dsh-my-memory-row-head' },
      createElement(
        'div',
        { className: 'dsh-my-memory-row-desc-wrap' },
        createElement('span', { className: 'dsh-my-memory-ct-badge' }, strings.categoryLabel(candidate.category)),
        createElement('span', { className: 'dsh-my-memory-desc' }, candidate.desc),
      ),
      createElement(
        'div',
        { className: 'dsh-my-memory-actions' },
        createElement(
          IconButton,
          {
            className: 'dsh-my-memory-iconbtn dsh-my-memory-iconbtn-confirm',
            label: `${strings.confirmCandidate()} ${candidate.id}`,
            onClick: onConfirm,
          },
          icon.check(14),
        ),
        createElement(
          IconButton,
          {
            className: 'dsh-my-memory-iconbtn dsh-my-memory-iconbtn-danger',
            label: `${strings.dismissCandidate()} ${candidate.id}`,
            onClick: onDismiss,
          },
          icon.close(14),
        ),
      ),
    ),
    createElement(
      'div',
      { className: 'dsh-my-memory-meta' },
      createElement('span', { className: 'dsh-my-memory-meta-icon' }, icon.clock(11)),
      relativeTime(candidate.createdAt),
      createElement('span', { className: 'dsh-my-memory-meta-sep' }, '·'),
      strings.candidateScopeBadge(candidate.scope),
      createElement('span', { className: 'dsh-my-memory-meta-sep' }, '·'),
      strings.candidateSource(candidate.source?.sessionId),
    ),
    busy ? createElement('div', { className: 'dsh-my-memory-entry-hint' }, strings.loading()) : null,
  )
}

/** 记忆条目元数据行（issue #78）：分类徽标 + 置信度 + 矛盾标记 + 演进历史
 *  （展开时显示 history 列表）。 */
function MetadataRow({ item, isExpanded, onToggle }) {
  const hasHistory = Array.isArray(item.history) && item.history.length > 0
  return createElement(
    'div',
    { className: 'dsh-my-memory-meta' },
    createElement('span', { className: 'dsh-my-memory-ct-badge' }, strings.categoryLabel(item.category)),
    createElement('span', { className: 'dsh-my-memory-conf-badge' }, strings.confidenceLabel(item.confidence)),
    item.status === 'conflict-pending'
      ? createElement('span', { className: 'dsh-my-memory-conflict-badge' }, strings.statusConflict())
      : null,
    createElement('span', { className: 'dsh-my-memory-meta-sep' }, '·'),
    createElement('span', { className: 'dsh-my-memory-meta-icon' }, icon.clock(11)),
    relativeTime(item.updatedAt),
    hasHistory
      ? createElement(
          'button',
          {
            className: 'dsh-my-memory-expand',
            'aria-label': isExpanded ? strings.collapse() : strings.historyLabel(),
            onClick: onToggle,
          },
          icon.chevronDown(14),
          isExpanded ? strings.collapse() : strings.historyLabel(),
        )
      : null,
    isExpanded && hasHistory
      ? item.history.map((entry, index) =>
          createElement(
            'span',
            { key: `${entry.at}-${index}`, className: 'dsh-my-memory-history-entry' },
            `${strings.historyEntry(entry.action)} · ${relativeTime(entry.at)}`,
          ),
        )
      : null,
  )
}

/** 待确认候选区块（issue #78）：自动提取的记忆候选，确认后写入（渐进
 *  合并）、拒弃则丢弃——记忆绝不静默变更。 */
function CandidatesBlock({ candidates, busy, onConfirmCandidate, onDismissCandidate }) {
  const list = Array.isArray(candidates) ? candidates : []
  return createElement(
    'div',
    { className: 'dsh-my-memory-candidates' },
    createElement(
      'div',
      { className: 'dsh-my-memory-section-head' },
      createElement('span', { className: 'dsh-my-memory-section-title' }, strings.candidatesSection()),
      createElement(
        'span',
        { className: 'dsh-my-memory-badge' },
        strings.countBadge(strings.candidatesSection(), list.length),
      ),
    ),
    createElement('div', { className: 'dsh-my-memory-note' }, strings.candidatesNote()),
    list.length === 0
      ? createElement('div', { className: 'dsh-my-memory-empty' }, strings.candidatesEmpty())
      : list.map((candidate) =>
          createElement(CandidateRow, {
            key: candidate.id,
            candidate,
            busy,
            onConfirm: () => onConfirmCandidate(candidate.id),
            onDismiss: () => onDismissCandidate(candidate.id),
          }),
        ),
  )
}

/** Path input + load/refresh buttons + consent note. */
function Toolbar({ pathInput, onInput, onLoad, onRefresh }) {
  return createElement(
    'div',
    { className: 'dsh-my-memory-toolbar' },
    createElement(
      'div',
      { className: 'dsh-my-memory-pathbar' },
      createElement('input', {
        className: 'dsh-my-memory-path-input',
        placeholder: strings.projectHint(),
        value: pathInput,
        onChange: (event) => onInput(event.target.value),
        onKeyDown: (event) => {
          if (event.key === 'Enter') onLoad(pathInput)
        },
      }),
      createElement(
        'button',
        { className: 'dsh-my-memory-btn', 'aria-label': strings.loadProject(), onClick: () => onLoad(pathInput) },
        icon.folder(14),
        strings.loadProject(),
      ),
      createElement(
        'button',
        { className: 'dsh-my-memory-btn', 'aria-label': strings.refresh(), onClick: () => onRefresh(pathInput) },
        icon.refresh(14),
        strings.refresh(),
      ),
    ),
    createElement('div', { className: 'dsh-my-memory-note' }, strings.confirmHint()),
  )
}
