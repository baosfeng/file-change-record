/**
 * dsh-my-memory — two-scope memory storage.
 *
 *  - global:  $DSH_HOME/memory.json (fallback ~/.dsh/memory.json)
 *  - project: <projectRoot>/.dsh/memory.json, where projectRoot is the
 *    nearest ancestor with a .git directory (findProjectRoot), resolved from
 *    the session cwd — the same global/project pattern as dsh-my-skill-manager.
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
import { readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdir } from 'node:fs/promises'

/** Global memory file: $DSH_HOME/memory.json (fallback ~/.dsh/memory.json). */
export function globalMemoryFile() {
  const home = process.env.DSH_HOME
  if (typeof home === 'string' && home !== '') return `${home}/memory.json`
  return `${homedir()}/.dsh/memory.json`
}

/** Empty memory document. */
export function emptyMemory() {
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
export async function writeMemoryFile(file, memory) {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  await writeFile(tmp, JSON.stringify(memory, null, 2), 'utf8')
  await rename(tmp, file)
}

/** Project memory path for a cwd: <projectRoot>/.dsh/memory.json. */
export async function projectMemoryFileOf(cwd) {
  const root = await findProjectRoot(cwd)
  return join(root, '.dsh', 'memory.json')
}

/**
 * Find the project root for a cwd: nearest ancestor containing a `.git`
 * directory; falls back to cwd itself. Returns cwd when nothing is found.
 */
export async function findProjectRoot(cwd) {
  let current = cwd
  for (;;) {
    try {
      const st = await stat(join(current, '.git'))
      if (st.isDirectory()) return current
    } catch {
      // no .git here — keep walking up
    }
    const parent = dirname(current)
    if (parent === current) return cwd
    current = parent
  }
}

/** New memory item id: mem-<epoch>-<random>. */
export function newMemoryId(now = Date.now()) {
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
