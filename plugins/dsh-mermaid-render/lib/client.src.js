/**
 * dsh-mermaid-render — client half (browser).
 *
 * Renders mermaid / mmd fenced code blocks in the conversation into
 * interactive diagram cards, with the mermaid engine VENDORED (embedded
 * mermaid.min.js UMD) so rendering works fully offline with zero CDN
 * dependency.
 *
 * Detection targets the host's stock `div.md-code-block` container (the
 * structure the built-in renderer and dsh-think-zh-expand produce) and
 * checks the inner <code> for language-mermaid / language-mmd. A
 * MutationObserver follows React re-renders (streaming replies included);
 * rendering failures keep the original code block and show an inline
 * error banner.
 *
 * Styling uses DSH semantic tokens (--dsw-alias-* / --dsw-font-*), injected
 * with the activation and torn down with the fiber (no residue on HMR).
 *
 * BUILD NOTE: this file is the source template. scripts/build.mjs injects
 * the vendored mermaid.min.js into the MERMAID_UMD placeholder (the
 * `const MERMAID_UMD = ...` line below) and writes lib/client.js (the file
 * actually served by DSH).
 */
window.__ModuleLoader__.load({
  id: 'dsh-mermaid-render',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useEffect, useState } = require('react')
    const reactDomClient = require('react-dom/client')

    // ── vendored mermaid engine (base64-injected at build time) ─────────
    const MERMAID_UMD_B64 = __MERMAID_UMD_B64__
    // atob() yields a latin1 binary string; the vendored engine contains
    // non-ASCII chars, so decode the UTF-8 bytes back to a proper JS string
    // (naive `atob(b64)` corrupts them and the <script> fails to parse).
    function b64ToUtf8(b64) {
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return new TextDecoder('utf-8').decode(bytes)
    }
    const MERMAID_UMD = typeof atob === 'function' ? b64ToUtf8(MERMAID_UMD_B64) : ''

    let mermaidReady = null
    /** Load (or reuse) the embedded mermaid engine on window.mermaid. */
    function ensureMermaid() {
      if (typeof window !== 'undefined' && window.mermaid) {
        try {
          window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
        } catch (err) { /* already initialized */ }
        return Promise.resolve(window.mermaid)
      }
      if (mermaidReady) return mermaidReady
      mermaidReady = new Promise((resolve, reject) => {
        try {
          if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') {
            reject(new Error('no document to inject mermaid'))
            return
          }
          const script = document.createElement('script')
          script.textContent = MERMAID_UMD
          script.onerror = () => reject(new Error('mermaid engine failed to load'))
          document.head.appendChild(script)
          const m = typeof window !== 'undefined' ? window.mermaid : undefined
          if (!m) {
            reject(new Error('mermaid engine missing after injection'))
            return
          }
          m.initialize({ startOnLoad: false, securityLevel: 'strict' })
          resolve(m)
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      })
      return mermaidReady
    }

    // ── detection: md-code-block + code.language-mermaid / -mmd ─────────
    function isMermaidBlock(block) {
      try {
        const code = block.querySelector('code')
        if (!code) return false
        const cls = String(code.className || '').toLowerCase()
        return cls.includes('language-mermaid') || cls.includes('language-mmd')
      } catch (err) {
        return false
      }
    }

    function sourceOf(block) {
      try {
        const pre = block.querySelector('pre')
        return pre ? pre.textContent || '' : ''
      } catch (err) {
        return ''
      }
    }

    // ── diagram card (React) ─────────────────────────────────────────────
    function MermaidCard({ entryId, source }) {
      const [status, setStatus] = useState('loading')
      const [svg, setSvg] = useState(null)
      const [error, setError] = useState(null)
      const [mode, setMode] = useState('preview')

      useEffect(() => {
        let cancelled = false
        setStatus('loading')
        ensureMermaid()
          .then((m) => m.render(entryId, source))
          .then((out) => {
            if (cancelled) return
            setSvg(out && typeof out.svg === 'string' ? out.svg : null)
            setError(null)
            setStatus('ok')
          })
          .catch((err) => {
            if (cancelled) return
            setError(err instanceof Error ? err.message : String(err))
            setStatus('error')
          })
        return () => { cancelled = true }
      }, [entryId, source])

      return createElement('div', { className: 'dmr-card', 'data-dmr-entry': entryId },
        createElement('div', { className: 'dmr-card-head' },
          createElement('div', { className: 'dmr-view-toggle', role: 'group', 'aria-label': 'view mode' },
            createElement('button', {
              type: 'button',
              className: mode === 'preview' ? 'dmr-vt dmr-vt-active' : 'dmr-vt',
              onClick: () => setMode('preview'),
            }, '预览'),
            createElement('button', {
              type: 'button',
              className: mode === 'code' ? 'dmr-vt dmr-vt-active' : 'dmr-vt',
              onClick: () => setMode('code'),
            }, '代码'),
          ),
        ),
        status === 'loading'
          ? createElement('div', { className: 'dmr-loading' }, '渲染中…')
          : status === 'error'
            ? createElement('div', { className: 'dmr-error' },
                createElement('div', { className: 'dmr-error-title' }, 'Mermaid 渲染失败'),
                createElement('div', { className: 'dmr-error-msg' }, error),
              )
            : mode === 'code' || !svg
              ? createElement('pre', { className: 'dmr-code' }, source)
              : createElement('div', {
                  className: 'dmr-svg',
                  dangerouslySetInnerHTML: { __html: svg },
                }),
      )
    }

    // ── scanner: attach cards to mermaid blocks ─────────────────────────
    let seq = 0
    function installScanner() {
      const seen = new Set()

      const mount = (block) => {
        const source = sourceOf(block)
        if (!source.trim()) return
        seen.add(block)
        // Hide the original <pre>: the card owns preview/code switching.
        const pre = block.querySelector('pre')
        if (pre && pre.style) pre.style.display = 'none'
        const host = document.createElement('div')
        host.className = 'dmr-card-host'
        block.appendChild(host)
        const root = reactDomClient.createRoot(host)
        const entryId = 'dsh-mermaid-' + (++seq)
        root.render(createElement(MermaidCard, { entryId, source }))
      }

      // Streaming-aware: a mermaid block inside a still-streaming assistant
      // row gets its code text in incomplete chunks (e.g. just "flow" before
      // the rest of the diagram arrives). Mounting early renders a stale
      // snapshot that never updates, so skip blocks that live under an
      // ancestor with [data-streaming]; the observer watches that attribute
      // and re-scans once streaming ends, mounting the complete source then.
      const attemptMount = (block) => {
        if (seen.has(block)) return
        if (block.closest && block.closest('[data-streaming]')) return
        mount(block)
      }

      const scan = (root) => {
        const scrolls = []
        if (root instanceof Element && root.matches && root.matches('[data-conversation-scroll]')) scrolls.push(root)
        if (root.querySelectorAll) {
          for (const sc of root.querySelectorAll('[data-conversation-scroll]')) scrolls.push(sc)
        }
        for (const sc of scrolls) {
          for (const block of sc.querySelectorAll('div.md-code-block')) {
            if (seen.has(block)) continue
            if (!isMermaidBlock(block)) continue
            attemptMount(block)
          }
        }
      }

      scan(document.body)

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const added of mutation.addedNodes) {
            if (added.nodeType === 1) scan(added)
          }
        }
        // Fallback re-scan: a React list item added *inside*
        // [data-conversation-scroll] is scanned from `added`, which cannot
        // reach up to the scroll container, so a freshly rendered
        // md-code-block is missed (also missed while streaming, when
        // code.language-mermaid is set only after the block mounts). Rescan
        // every known scroll container so such blocks are picked up.
        for (const sc of document.querySelectorAll('[data-conversation-scroll]')) {
          for (const block of sc.querySelectorAll('div.md-code-block')) {
            if (seen.has(block)) continue
            if (!isMermaidBlock(block)) continue
            attemptMount(block)
          }
        }
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-streaming'] })
      return () => observer.disconnect()
    }

    // ── styles (DSH tokens; injected first, torn down with the fiber) ──
    const STYLES = `
.dmr-card{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:8px 12px;background:var(--dsw-alias-bg-layer-1);font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.dmr-card-head{display:flex;justify-content:flex-end}
.dmr-view-toggle{display:inline-flex;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:2px}
.dmr-vt{border:none;background:transparent;border-radius:6px;padding:2px 10px;cursor:pointer;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dmr-vt:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dmr-vt-active{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-weight:600}
.dmr-svg{overflow:auto;max-height:70vh}
.dmr-svg svg{max-width:100%;height:auto}
.dmr-code{margin:0;background:var(--dsw-alias-markdown-code-block);border-radius:8px;padding:8px 12px;overflow:auto;font:var(--dsw-font-markdown-code-block-small);white-space:pre-wrap}
.dmr-error{border-radius:8px;background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);padding:6px 10px}
.dmr-error-title{color:var(--dsw-alias-state-error-primary);font-weight:600}
.dmr-error-msg{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-all}
`

    exports.inject = []

    exports.apply = function apply(ctx) {
      // Stylesheet first, unconditionally (see dsh-file-activity pitfall:
      // injecting styles behind a service early-return loses them on HMR).
      ctx.effect(() => {
        if (typeof document === 'undefined' || document === null || typeof document.head === 'undefined') return () => {}
        const style = document.createElement('style')
        style.setAttribute('data-dsh-mermaid-render', 'styles')
        style.textContent = STYLES
        document.head.appendChild(style)
        return () => {
          if (style.parentNode) style.parentNode.removeChild(style)
        }
      }, 'dsh-mermaid-render: styles')

      ctx.effect(() => installScanner(), 'dsh-mermaid-render: scanner')
    }

    return module.exports
  },
})
