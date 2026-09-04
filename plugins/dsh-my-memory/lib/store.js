/**
 * dsh-my-memory — two-scope memory storage.
 *
 *  - global:  $DSH_HOME/memory.json (fallback ~/.dsh/memory.json)
 *  - project: $DSH_HOME/memory/projects/<projectId>.json (centralized under
 *    the DSH home, issue #108), where projectId is a stable id derived from
 *    the project root (sha256 of the normalized root path, first 12 hex
 *    chars). The project root itself is the nearest ancestor with a .git
 *    directory (findProjectRoot), resolved from the session cwd.
 *
 *  Legacy location: <projectRoot>/.dsh/memory.json used to hold project
 *  memories until issue #108. migrateProjectMemory() copies any legacy data
 *  into the new centralized file on first access (and removes the legacy
 *  file), so existing memories are never lost.
 *
 * File shape (one scope per file):
 *   { "items": [ { "id", "desc", "createdAt", "updatedAt" } ] }
 *
 * Writes are debounced (multiple mutations within the window coalesce into
 * one disk write) and atomic (tmp + rename). Reads are defensive:
 * missing/corrupt files degrade to an empty list. The store keeps an
 * in-memory cache so the system-prompt section and the query tool read
 * without touching disk; load() restores the cache at startup (restart
 * recovery).
 */
import { createHash } from 'node:crypto'
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, normalize, resolve } from 'node:path'
import { findProjectRoot } from 'dsh-shared'

/** The DSH home directory: $DSH_HOME, or ~/.dsh when unset (shared by the
 *  global memory file and the centralized project memory directory). */
function dshHome() {
  const home = process.env.DSH_HOME
  if (typeof home === 'string' && home !== '') return home
  return join(homedir(), '.dsh')
}

/** Global memory file: $DSH_HOME/memory.json (fallback ~/.dsh/memory.json). */
export function globalMemoryFile() {
  return `${dshHome()}/memory.json`
}

/** Project memory directory: $DSH_HOME/memory/projects (issue #108). */
export function projectMemoryDir() {
  return join(dshHome(), 'memory', 'projects')
}

/**
 * Stable project id for a project root (issue #108, scheme A): sha256 of the
 * normalized absolute root path, first 12 hex chars. Deterministic across
 * machines/sessions, unique enough for per-project isolation, and safe as a
 * filename on every platform.
 */
export function projectIdOf(root) {
  const normalized = normalize(resolve(root))
  return createHash('sha256').update(normalized).digest('hex').slice(0, 12)
}

/**
 * Resolve the project memory paths for a cwd (issue #108): the new
 * centralized file under $DSH_HOME/memory/projects, plus the legacy
 * <projectRoot>/.dsh/memory.json (used only for migration), plus the
 * project root itself.
 */
export async function resolveProjectMemory(cwd) {
  const root = await findProjectRoot(cwd)
  return {
    root,
    file: join(projectMemoryDir(), `${projectIdOf(root)}.json`),
    legacyFile: join(root, '.dsh', 'memory.json'),
  }
}

/**
 * Project memory file for a cwd (new centralized location, issue #108).
 * Kept as a thin wrapper over resolveProjectMemory for callers that only
 * need the path.
 */
export async function projectMemoryFileOf(cwd) {
  return (await resolveProjectMemory(cwd)).file
}

/**
 * Migrate legacy <projectRoot>/.dsh/memory.json into the new centralized
 * file (issue #108). Returns true when a migration actually happened:
 *  - the new file already exists → nothing to do (migrated before or fresh);
 *  - the legacy file is missing or empty → nothing to migrate;
 *  - otherwise copies the legacy items into the new file (atomic write),
 *    then removes the legacy file and the now-empty .dsh directory
 *    (best-effort, so the project directory stays clean).
 * Data is never silently dropped: the legacy items land in the new file
 * before the old file is touched.
 */
export async function migrateProjectMemory({ file, legacyFile }) {
  try {
    await stat(file)
    return false
  } catch {
    // new file missing → a legacy file may need migrating
  }
  const legacy = await readMemoryFile(legacyFile)
  if (legacy.items.length === 0) return false
  await writeMemoryFile(file, legacy)
  try {
    await rm(legacyFile, { force: true })
    await rm(dirname(legacyFile), { force: true })
  } catch {
    // removal is best-effort; the migration itself already succeeded
  }
  return true
}

/** Empty memory document. */
function emptyMemory() {
  return { items: [] }
}

/** Read one memory file (missing/corrupt → empty document). */
export async function readMemoryFile(file) {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object') return normalizeMemory(parsed)
  } catch {
    // first run or unreadable file: empty memory
  }
  return emptyMemory()
}

/** Keep only well-formed items; anything else is ignored defensively. */
export function normalizeMemory(memory) {
  const items = Array.isArray(memory?.items) ? memory.items : []
  return {
    items: items
      .filter((item) => isMemoryItem(item))
      .map((item) => ({
        id: item.id,
        desc: item.desc,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
  }
}

/** One well-formed memory item (id + desc required, timestamps numeric). */
function isMemoryItem(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    item.id !== '' &&
    typeof item.desc === 'string' &&
    item.desc !== '' &&
    typeof item.createdAt === 'number' &&
    typeof item.updatedAt === 'number'
  )
}

/** Write one memory file atomically (tmp + rename); creates the directory. */
async function writeMemoryFile(file, memory) {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  await writeFile(tmp, JSON.stringify(memory, null, 2), 'utf8')
  await rename(tmp, file)
}

/** New memory item id: mem-<epoch>-<random>. */
function newMemoryId(now = Date.now()) {
  return `mem-${now}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * One scope's memory store: in-memory cache + debounced atomic writes.
 * Mutations update the cache immediately (prompt/tool reads see them at
 * once); the disk write is scheduled and coalesced within the debounce
 * window. The startup load starts immediately at construction; every write
 * awaits it, so a mutation issued before the restore finishes can never be
 * overwritten by the stale disk state (restart-recovery race).
 */
export function createStore({ file, debounceMs = 300 }) {
  const state = { items: [], timer: null, writing: Promise.resolve(), ready: null }
  state.ready = loadInto(state, file)
  return {
    load: () => state.ready,
    list: () => listOf(state),
    add: (desc, now) => addItem(state, file, debounceMs, desc, now),
    update: (id, desc, now) => updateItem(state, file, debounceMs, id, desc, now),
    remove: (id) => removeItem(state, file, debounceMs, id),
    flush: () => flushStore(state, file),
    dispose: () => disposeStore(state),
  }
}

/** Restore the cache from disk (missing/corrupt → empty). */
async function loadInto(state, file) {
  const memory = await readMemoryFile(file)
  state.items = memory.items
}

/** Snapshot of the current items (newest first). */
function listOf(state) {
  return [...state.items].sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Add one item; returns the created item (awaits the startup restore). */
async function addItem(state, file, debounceMs, desc, now = Date.now()) {
  await state.ready
  const item = { id: newMemoryId(now), desc, createdAt: now, updatedAt: now }
  state.items.push(item)
  scheduleWrite(state, file, debounceMs)
  return { ...item }
}

/** Update one item's desc; returns the updated item or undefined. */
async function updateItem(state, file, debounceMs, id, desc, now = Date.now()) {
  await state.ready
  const item = state.items.find((entry) => entry.id === id)
  if (item === undefined) return undefined
  item.desc = desc
  item.updatedAt = now
  scheduleWrite(state, file, debounceMs)
  return { ...item }
}

/** Remove one item; returns true when it existed. */
async function removeItem(state, file, debounceMs, id) {
  await state.ready
  const before = state.items.length
  state.items = state.items.filter((entry) => entry.id !== id)
  if (state.items.length === before) return false
  scheduleWrite(state, file, debounceMs)
  return true
}

/** Coalesce mutations within the debounce window into one disk write. */
function scheduleWrite(state, file, debounceMs) {
  if (state.timer !== null) clearTimeout(state.timer)
  state.timer = setTimeout(() => {
    state.timer = null
    state.writing = writeMemoryFile(file, { items: state.items }).catch(() => {})
  }, debounceMs)
}

/** Flush any pending write immediately (used on dispose and in tests). */
async function flushStore(state, file) {
  if (state.timer !== null) {
    clearTimeout(state.timer)
    state.timer = null
  }
  await writeMemoryFile(file, { items: state.items })
  await state.writing
}

/** Stop the debounce timer (pending changes are dropped). */
function disposeStore(state) {
  if (state.timer !== null) {
    clearTimeout(state.timer)
    state.timer = null
  }
}
