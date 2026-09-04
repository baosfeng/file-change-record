/**
 * dsh-my-memory — client half (browser). SOURCE TEMPLATE.
 *
 * A Web Settings "记忆 / Memory" tab (official `slots` extension point — no
 * third-party dependency) showing the GLOBAL and PROJECT memory scopes side
 * by side, with add / edit / delete. Every write goes through a custom
 * confirmation UI (built on the ask pattern, NOT the native browser
 * confirm): delete is a red, eye-catching two-step confirm; save/add is
 * green. The project scope is visually distinct (project-root badge +
 * different section accent) so the two scopes never blur together.
 *
 * Data source: GET /my-memory/api/memory + POST /my-memory/api/memory
 * (server half). Writes carry `confirmed: true` — the server refuses any
 * write without the user-consent marker.
 *
 * BUILD NOTE: this file is the SOURCE TEMPLATE. scripts/build.mjs splices
 * the `lib/parts/*.part.js` pieces into the PART placeholder markers below
 * (each piece is plain function-declaration text sharing this factory scope;
 * the browser ModuleLoader does not support relative-path require) and writes
 * lib/client.js — the file actually served by DSH, which MUST be committed
 * (CI runs node --check + tests against it, not against this template).
 */
window.__ModuleLoader__.load({
  id: 'dsh-my-memory',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const { createElement, useEffect, useState } = require('react')

    // ── parts (injected by scripts/build.mjs; keep this exact order — the
    //    const initializers below run in splice order) ─────────────────────
    __PART_I18N__
    __PART_STYLES__
    __PART_API__
    __PART_ICONS__
    __PART_UTILS__
    __PART_VIEW_ROWS__
    __PART_CANDIDATES__
    __PART_VIEW__
    __PART_APPLY__

    return module.exports
  },
})
