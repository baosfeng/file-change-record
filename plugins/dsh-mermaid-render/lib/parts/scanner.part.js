// ── scanner: attach cards to mermaid blocks ─────────────────────────
let seq = 0

/** Mount a card into the block, hiding the original <pre>. */
function mountCard(seen, block) {
  const source = sourceOf(block)
  if (!source.trim()) return
  seen.add(block)
  const pre = block.querySelector('pre')
  if (pre && pre.style) pre.style.display = 'none'
  const host = document.createElement('div')
  host.className = 'dmr-card-host'
  block.appendChild(host)
  const root = reactDomClient.createRoot(host)
  const entryId = 'dsh-mermaid-' + ++seq
  root.render(createElement(MermaidCard, { entryId, source }))
}

// Streaming-aware: a mermaid block inside a still-streaming assistant
// row gets its code text in incomplete chunks (e.g. just "flow" before
// the rest of the diagram arrives). Mounting early renders a stale
// snapshot that never updates, so skip blocks that live under an
// ancestor with [data-streaming]; the observer watches that attribute
// and re-scans once streaming ends, mounting the complete source then.
function attemptMount(seen, block) {
  if (seen.has(block)) return
  if (block.closest && block.closest('[data-streaming]')) return
  mountCard(seen, block)
}

/** Scan a subtree for mermaid md-code-blocks under conversation scrolls. */
function scanBlocks(seen, root) {
  const scrolls = []
  if (root instanceof Element && root.matches && root.matches('[data-conversation-scroll]')) scrolls.push(root)
  if (root.querySelectorAll) {
    for (const sc of root.querySelectorAll('[data-conversation-scroll]')) scrolls.push(sc)
  }
  for (const sc of scrolls) {
    for (const block of sc.querySelectorAll('div.md-code-block')) {
      if (seen.has(block)) continue
      if (!isMermaidBlock(block)) continue
      attemptMount(seen, block)
    }
  }
}

/** Observe the body; returns the observer disposer. */
function installScanner() {
  const seen = new Set()
  scanBlocks(seen, document.body)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        if (added.nodeType === 1) scanBlocks(seen, added)
      }
    }
    // Fallback re-scan: a React list item added *inside*
    // [data-conversation-scroll] is scanned from `added`, which cannot
    // reach up to the scroll container, so a freshly rendered
    // md-code-block is missed (also missed while streaming, when
    // code.language-mermaid is set only after the block mounts). Rescan
    // every known scroll container so such blocks are picked up.
    for (const sc of document.querySelectorAll('[data-conversation-scroll]')) {
      scanBlocks(seen, sc)
    }
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-streaming'],
  })
  return () => observer.disconnect()
}
