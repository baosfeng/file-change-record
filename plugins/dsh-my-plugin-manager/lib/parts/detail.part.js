// ── detail panel (issue #90): README / version history / deps / install ──
function PluginDetailPanel({ name, detail, loading, error, version, onClose, onVersionChange, install, installing }) {
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-detail' },
    createElement(DetailHead, { name, onClose }),
    renderDetail({ detail, loading, error, version, onVersionChange, install, installing }),
  )
}

function DetailHead({ name, onClose }) {
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-detail-head' },
    createElement('span', { className: 'dsh-my-plugin-manager-detail-title' }, name ?? ''),
    createElement(
      'button',
      { className: 'dsh-my-plugin-manager-btn dsh-my-plugin-manager-btn-ghost', onClick: onClose },
      strings.close(),
    ),
  )
}

/** Loading → error → detail-body switch. */
function renderDetail({ detail, loading, error, version, onVersionChange, install, installing }) {
  if (loading) return createElement('div', { className: 'dsh-my-plugin-manager-status' }, strings.loadingDetail())
  if (error !== null && error !== false) {
    const message = typeof error === 'string' ? error : strings.loadError()
    return createElement('div', { className: 'dsh-my-plugin-manager-error' }, `${strings.detailFailed()}：${message}`)
  }
  if (detail === null) return null
  const readmeBody =
    detail.readme === ''
      ? createElement('div', { className: 'dsh-my-plugin-manager-empty' }, strings.noReadme())
      : createElement(ReadmeView, { text: detail.readme })
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-detail-body' },
    createElement(DetailMeta, { detail, version, onVersionChange, install, installing }),
    createElement(DetailSection, { title: strings.readme(), body: readmeBody }),
    createElement(DetailSection, {
      title: strings.versionHistory(),
      body: createElement(DetailTimeline, { versions: detail.versions }),
    }),
    createElement(DetailSection, {
      title: strings.dependencies(),
      body: createElement(DetailDeps, { dependencies: detail.dependencies, peerDependencies: detail.peerDependencies }),
    }),
  )
}

/** Metadata toolbar: version picker + install button + info tags. */
function DetailMeta({ detail, version, onVersionChange, install, installing }) {
  const source = installSource(detail.name, version, detail.latest)
  const installingThis = installing === source
  const versions = Array.isArray(detail.versions) ? detail.versions : []
  const isLatest = version === '' || version === detail.latest
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-detail-meta' },
    createElement(
      'div',
      { className: 'dsh-my-plugin-manager-detail-toolbar' },
      createElement(
        'select',
        {
          className: 'dsh-my-plugin-manager-detail-version',
          value: version ?? '',
          onChange: (event) => onVersionChange(event.target.value),
        },
        versions.map((v) => createElement('option', { key: v.version, value: v.version }, v.version)),
      ),
      createElement(
        'button',
        {
          className: 'dsh-my-plugin-manager-btn dsh-my-plugin-manager-btn-primary',
          onClick: () => install(source),
          disabled: installingThis,
        },
        icon.plus(14),
        installingThis ? strings.installing() : isLatest ? strings.installLatest() : strings.installAt(version),
      ),
    ),
    detail.description !== ''
      ? createElement('div', { className: 'dsh-my-plugin-manager-detail-desc' }, detail.description)
      : null,
    createElement(
      'div',
      { className: 'dsh-my-plugin-manager-detail-tags' },
      metaTag(detail.author, strings.author()),
      metaTag(detail.license, strings.license()),
      metaTag(detail.downloads > 0 ? String(detail.downloads) : '', strings.downloads()),
      detail.repository !== ''
        ? createElement(
            'a',
            {
              className: 'dsh-my-plugin-manager-detail-tag dsh-my-plugin-manager-detail-tag-link',
              href: detail.repository,
              target: '_blank',
              rel: 'noreferrer',
            },
            strings.repository(),
          )
        : null,
    ),
  )
}

/** A single metadata chip; hidden when the value is empty. */
function metaTag(value, label) {
  if (value === '' || value === null || value === undefined) return null
  return createElement('span', { className: 'dsh-my-plugin-manager-detail-tag' }, `${label}：${value}`)
}

function installSource(name, version, latest) {
  return version !== '' && version !== latest ? `${name}@${version}` : name
}

function DetailSection({ title, body }) {
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-detail-section' },
    createElement('div', { className: 'dsh-my-plugin-manager-detail-section-title' }, title),
    body,
  )
}

/** README preview: dsh-md-render MarkdownView, falling back to plain <pre>. */
function ReadmeView({ text }) {
  if (MarkdownView) return createElement(MarkdownView, { text })
  return createElement('pre', { className: 'dsh-my-plugin-manager-readme-plain' }, text)
}

function DetailTimeline({ versions }) {
  if (!Array.isArray(versions) || versions.length === 0) {
    return createElement('div', { className: 'dsh-my-plugin-manager-empty' }, strings.noVersions())
  }
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-timeline' },
    versions.map((entry, i) =>
      createElement(
        'div',
        { key: `${entry.version}-${i}`, className: 'dsh-my-plugin-manager-timeline-item' },
        createElement('span', { className: 'dsh-my-plugin-manager-timeline-dot' }),
        createElement('span', { className: 'dsh-my-plugin-manager-timeline-version' }, entry.version),
        createElement('span', { className: 'dsh-my-plugin-manager-timeline-date' }, entry.date),
      ),
    ),
  )
}

/** dependencies + peerDependencies tables (peer missing highlighted). */
function DetailDeps({ dependencies, peerDependencies }) {
  const deps = Array.isArray(dependencies) ? dependencies : []
  const peers = Array.isArray(peerDependencies) ? peerDependencies : []
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-deps' },
    createElement(
      'div',
      { className: 'dsh-my-plugin-manager-deps-group' },
      createElement('div', { className: 'dsh-my-plugin-manager-deps-label' }, strings.dependencies()),
      deps.length === 0
        ? createElement(
            'div',
            { className: 'dsh-my-plugin-manager-empty dsh-my-plugin-manager-dep-empty' },
            strings.noDependencies(),
          )
        : depRows(deps),
    ),
    createElement(
      'div',
      { className: 'dsh-my-plugin-manager-deps-group dsh-my-plugin-manager-deps-peer' },
      createElement('div', { className: 'dsh-my-plugin-manager-deps-label' }, strings.peerDependencies()),
      createElement('div', { className: 'dsh-my-plugin-manager-deps-hint' }, strings.peerHint()),
      peers.length === 0
        ? createElement(
            'div',
            { className: 'dsh-my-plugin-manager-empty dsh-my-plugin-manager-dep-empty' },
            strings.noDependencies(),
          )
        : peerRows(peers),
    ),
  )
}

function depRows(deps) {
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-dep-table' },
    deps.map((dep) =>
      createElement(
        'div',
        { key: dep.name, className: 'dsh-my-plugin-manager-dep-row' },
        createElement('span', { className: 'dsh-my-plugin-manager-dep-name' }, dep.name),
        createElement('span', { className: 'dsh-my-plugin-manager-dep-spec' }, dep.spec),
      ),
    ),
  )
}

function peerRows(peers) {
  return createElement(
    'div',
    { className: 'dsh-my-plugin-manager-dep-table' },
    peers.map((peer) =>
      createElement(
        'div',
        {
          key: peer.name,
          className: `dsh-my-plugin-manager-dep-row${peer.missing ? ' dsh-my-plugin-manager-dep-missing' : ''}`,
        },
        createElement('span', { className: 'dsh-my-plugin-manager-dep-name' }, peer.name),
        createElement('span', { className: 'dsh-my-plugin-manager-dep-spec' }, peer.spec),
        peer.missing
          ? createElement('span', { className: 'dsh-my-plugin-manager-dep-missing-badge' }, strings.missingPeer())
          : null,
      ),
    ),
  )
}
