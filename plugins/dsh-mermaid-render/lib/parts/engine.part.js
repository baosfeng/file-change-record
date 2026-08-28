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
    } catch {
      /* already initialized */
    }
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
  } catch {
    return false
  }
}

function sourceOf(block) {
  try {
    const pre = block.querySelector('pre')
    return pre ? pre.textContent || '' : ''
  } catch {
    return ''
  }
}
