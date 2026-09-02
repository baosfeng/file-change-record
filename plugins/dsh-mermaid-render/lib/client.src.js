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
 * BUILD NOTE: this file is the SOURCE TEMPLATE. scripts/build.mjs splices
 * the `lib/parts/*.part.js` pieces into the PART placeholder markers below
 * (each piece is plain function-declaration text sharing this factory
 * scope), then injects the vendored mermaid.min.js (base64-encoded) into
 * the __MERMAID_UMD_B64__ placeholder inside engine.part.js, and writes
 * lib/client.js — the file actually served by DSH, which MUST be committed
 * (CI runs node --check + tests against it, not against this template).
 */
/* global __MERMAID_UMD_B64__ */
window.__ModuleLoader__.load({
  id: 'dsh-mermaid-render',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useEffect, useState } = require('react')
    const reactDomClient = require('react-dom/client')

    // ── parts (injected by scripts/build.mjs; keep this exact order — the
    //    initializers and function declarations run in splice order) ─────
    __PART_ENGINE__
    __PART_ICONS__
    __PART_EXPORT__
    __PART_CARD__
    __PART_SCANNER__
    __PART_STYLES__
    __PART_APPLY__

    return module.exports
  },
})
