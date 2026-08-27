    // ── api: fetch helpers for the Memory views ────────────────────────────
    const API_BASE = '/my-memory/api'

    /** One GET memory payload into { scope, cwd, projectRoot, items }. */
    function normalizeMemory(value) {
      return {
        scope: value.scope ?? 'global',
        cwd: value.cwd ?? '',
        projectRoot: value.projectRoot ?? '',
        items: Array.isArray(value.items) ? value.items : [],
      }
    }

    /** GET /my-memory/api/memory?scope=…&cwd=… → normalized value; rejects on bad responses. */
    function fetchMemory(scope, cwd) {
      const query = cwd.trim() === '' ? `?scope=${scope}` : `?scope=${scope}&cwd=${encodeURIComponent(cwd.trim())}`
      return fetch(`${API_BASE}/memory${query}`)
        .then((res) => res.json())
        .then((body) => {
          if (body === null || body.ok !== true) throw new Error('bad memory response')
          return normalizeMemory(body.value)
        })
    }

    /** POST /my-memory/api/memory — a write gated on the user-consent marker. */
    function writeMemory({ action, scope, cwd, id, desc }) {
      return fetch(`${API_BASE}/memory`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, scope, cwd, id, desc, confirmed: true }),
      })
        .then((res) => res.json())
        .then((body) => {
          if (body === null || body.ok !== true) throw new Error('write failed')
          return normalizeMemory({ ...body.value, scope })
        })
    }
