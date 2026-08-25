/**
 * State model + persistence for file activity.
 *
 * State (recent history + per-file counts) is kept per session and persisted
 * to $DSH_HOME/file-activity.json (atomic tmp+rename, debounced). Loading is
 * defensive: missing / corrupt / wrong-version files degrade to fresh state.
 */
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'

/** How many recent entries to keep per session (LRU: one entry per path). */
const RECENT_LIMIT = 5

/** State file: $DSH_HOME/file-activity.json (fallback: ~/.dsh/file-activity.json). */
export function stateFile() {
  const home = process.env.DSH_HOME
  if (typeof home === 'string' && home !== '') return `${home}/file-activity.json`
  return `${homedir()}/.dsh/file-activity.json`
}

/** Empty state document. */
export function createState() {
  return { version: 1, sessions: {} }
}

/** Load persisted state (missing/corrupt file → fresh state). */
export async function loadState(file) {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && parsed.version === 1) return parsed
  } catch {
    // first run or unreadable file: start fresh
  }
  return createState()
}

/** Map a raw operation kind (tool name or client op) to 'read' | 'write' | 'edit'. */
export function mapOp(op) {
  switch (op) {
    case 'write': return 'write'
    case 'edit':
    case 'str_replace_editor': return 'edit'
    case 'read':
    case 'read_image':
    default: return 'read'
  }
}

/**
 * Fold one observed operation into the state.
 * 'write' is classified create vs modify through the per-session known-file
 * registry (first contact = create, later writes = modify); edits are always
 * modifies. Each file's counters also track firstSeen (first contact time,
 * i.e. creation time) and lastSeen (most recent activity time).
 * Returns true when a record was produced.
 */
export function applyRecord(state, sessionId, path, op, time) {
  if (!isValidRecordTarget(sessionId, path)) return false
  const session = state.sessions[sessionId] ?? (state.sessions[sessionId] = { known: {}, counts: {}, recent: [] })
  const timestamp = typeof time === 'number' ? time : Date.now()
  const firstSeen = typeof session.known[path] === 'number' ? session.known[path] : timestamp
  const finalOp = classifyOp(op, session.known[path])
  session.known[path] = firstSeen
  const counts = session.counts[path] ?? (session.counts[path] = { read: 0, create: 0, modify: 0 })
  bumpCount(counts, finalOp, firstSeen, timestamp)
  // Newest-first LRU history: revisiting a path moves it to the front
  // instead of appending a duplicate; cap at RECENT_LIMIT entries.
  const existing = session.recent.findIndex((entry) => entry.path === path)
  if (existing !== -1) session.recent.splice(existing, 1)
  session.recent.unshift({ path, op: finalOp, time: timestamp })
  if (session.recent.length > RECENT_LIMIT) session.recent.length = RECENT_LIMIT
  return true
}

/** A record target is valid when both ids are non-empty strings (no NUL). */
function isValidRecordTarget(sessionId, path) {
  return typeof sessionId === 'string' && sessionId !== ''
    && typeof path === 'string' && path !== '' && !path.includes('\0')
}

/** 'write' → create/modify by the known-file registry; 'edit' → modify; else read. */
function classifyOp(op, knownTime) {
  if (op === 'write') return knownTime ? 'modify' : 'create'
  if (op === 'edit') return 'modify'
  return 'read'
}

/** Increment the matching counter and refresh firstSeen/lastSeen. */
function bumpCount(counts, finalOp, firstSeen, timestamp) {
  if (finalOp === 'create') counts.create += 1
  else if (finalOp === 'modify') counts.modify += 1
  else counts.read += 1
  counts.firstSeen = firstSeen
  counts.lastSeen = timestamp
}

/**
 * Normalize + trim a loaded state document in place: null/absent sessions are
 * reset to {}, pre-existing history is deduped by path and capped at
 * RECENT_LIMIT (LRU semantics: one entry per path, newest occurrence wins —
 * the array is newest-first, so the first occurrence of each path is kept).
 * Returns { state, trimmed } where trimmed reports whether anything changed.
 */
export function trimLoadedState(loaded) {
  if (loaded.sessions === undefined || loaded.sessions === null || typeof loaded.sessions !== 'object') loaded.sessions = {}
  let trimmed = false
  for (const session of Object.values(loaded.sessions)) {
    if (Array.isArray(session.recent)) {
      const seen = new Set()
      const deduped = session.recent.filter((entry) => {
        if (typeof entry?.path !== 'string' || entry.path === '') return false
        if (seen.has(entry.path)) return false
        seen.add(entry.path)
        return true
      })
      if (deduped.length !== session.recent.length) trimmed = true
      session.recent = deduped
      if (session.recent.length > RECENT_LIMIT) {
        session.recent.length = RECENT_LIMIT
        trimmed = true
      }
    }
  }
  return { state: loaded, trimmed }
}

/**
 * Whether `path` appears in this session's recorded file activity (counts or
 * recent). The media route authorizes EXACTLY these paths — the record itself
 * is the permission: the agent actually touched the file, so previewing it is
 * expected, while arbitrary unrecorded paths stay refused.
 */
export function isRecordedPath(state, sessionId, path) {
  const session = state.sessions[sessionId]
  if (session === undefined) return false
  if (session.counts !== undefined && typeof session.counts[path] === 'object' && session.counts[path] !== null) return true
  if (Array.isArray(session.recent)) return session.recent.some((entry) => entry.path === path)
  return false
}
