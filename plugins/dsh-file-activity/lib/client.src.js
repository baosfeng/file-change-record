/**
 * dsh-file-activity — client half (browser).
 *
 * Extends dsh-better-sidebar with a "文件活动 / File Activity" tab:
 *  - recent file access history (agent + sidebar operations),
 *  - per-file create/modify/read counts flattened by folder, with multi-level
 *    folders shown as dotted paths (a.b.c.d) and their files indented below,
 *  - clicking any file opens a FLOATING preview that reuses the sidebar's
 *    NATIVE viewer via `ctx.betterSidebar.matchFileViewer(path)` — its own
 *    `component` is mounted (built-in markdown / code / image / pdf / html
 *    renderers), so code gets syntax highlighting and markdown gets rendered
 *    with no hand-rolled preview; clicking outside / Esc / × closes it,
 *  - auto-opens once per session by default (toggleable in the sidebar
 *    settings, enabled by default).
 *
 * Data source: the plugin host half (fs/observed for agent tools) + this
 * half's fetch interception for sidebar file operations (fs.read / fs.write /
 * /sidebar/file media opens), both persisted host-side; the tab polls
 * /file-activity/api/stats.
 *
 * Styling follows the dsh-better-sidebar design language: all colors ride the
 * DSH semantic tokens (--dsw-alias-*), typography rides the font roles
 * (--dsw-font-*), motion rides --ds-*. Flat surfaces (no box-shadow), hairline
 * borders, 28px circular icon controls with hover fills, and 8px-radius rows
 * with hover fills. The stylesheet is injected once per activation and torn
 * down with the fiber, so HMR/disable leaves no residue.
 *
 * BUILD NOTE: this file is the SOURCE TEMPLATE. scripts/build.mjs splices the
 * `lib/parts/*.part.js` pieces into the PART placeholder markers below (each
 * piece is plain function-declaration text sharing this factory scope; the
 * browser ModuleLoader does not support relative-path require) and writes
 * lib/client.js — the file actually served by DSH, which MUST be committed
 * (CI runs node --check + tests against it, not against this template).
 */
window.__ModuleLoader__.load({
  id: 'dsh-file-activity',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useEffect, useMemo, useState, useSyncExternalStore } = require('react')

    const TAB_ID = 'file-activity:recent'
    const AUTO_OPEN_KEY = 'dsh-file-activity:auto-opened:'
    const POLL_MS = 6000

    // ── parts (injected by scripts/build.mjs; keep this exact order — the
    //    const initializers below run in splice order) ─────────────────────
    __PART_I18N__
    __PART_FORMAT__
    __PART_TREE__
    __PART_STORE__
    __PART_API__
    __PART_INTERCEPTOR__
    __PART_AUTO_OPEN__
    __PART_ICONS__
    __PART_STYLES__
    __PART_ROWS__
    __PART_VIEW__
    __PART_PREVIEW__
    __PART_APPLY__

    return module.exports
  },
})
