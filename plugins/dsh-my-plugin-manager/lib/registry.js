/**
 * dsh-my-plugin-manager — registry.js: npm registry lookups for the market
 * browser (search) and the update check (latest versions).
 *
 * The npm registry is the public plugin source of truth: search covers every
 * published dsh plugin (npm search `keywords:dsh`), and `/<pkg>/latest`
 * gives the newest version for update comparison.
 */
const NPM_SEARCH = 'https://registry.npmjs.org/-/v1/search'
const NPM_PACKAGE = (name) => `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`

/** Search npm for plugins; returns a flat market list (name/version/…). */
export async function searchNpmPlugins(query, size = 30) {
  const url = `${NPM_SEARCH}?text=${encodeURIComponent(query)}&size=${size}`
  const data = await fetchJson(url)
  const objects = Array.isArray(data.objects) ? data.objects : []
  return objects.map((entry) => entryToResult(entry.package)).filter((entry) => entry.name !== '')
}

/** String fields of a market row (all defensive-empty). */
const STRING_FIELDS = ['name', 'version', 'description', 'date', 'homepage', 'repository']

/** One npm search hit into the market row shape (defensive defaults). */
function entryToResult(pkg) {
  const links = pkg?.links ?? {}
  const result = {}
  for (const field of STRING_FIELDS) result[field] = stringOf(pkg?.[field])
  result.homepage = stringOf(links.homepage)
  result.repository = stringOf(links.repository)
  result.author = authorOf(pkg?.author)
  return result
}

function authorOf(author) {
  if (typeof author === 'string') return author
  return author === null || author === undefined ? '' : stringOf(author.name)
}

function stringOf(value) {
  return typeof value === 'string' ? value : ''
}

/** Latest published version of a package ('' when unknown/error). */
export async function latestVersionOf(name) {
  try {
    const res = await fetch(NPM_PACKAGE(name))
    if (!res.ok) return ''
    const data = await res.json()
    return typeof data.version === 'string' ? data.version : ''
  } catch {
    return ''
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`registry request failed: ${res.status}`)
  return res.json()
}
