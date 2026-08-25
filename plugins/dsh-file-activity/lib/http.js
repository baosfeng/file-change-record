/**
 * HTTP helpers shared by the /file-activity routes: bounded JSON body
 * reading, JSON responses, and session working-directory resolution.
 */

/** Read a JSON request body (bounded). */
export async function readJsonBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) throw new Error('request body too large')
  }
  if (body === '') return {}
  return JSON.parse(body)
}

export function writeJson(response, status, value) {
  const payload = JSON.stringify(value)
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-cache' })
  response.end(payload)
}

export function writeError(response, error) {
  const message = error instanceof Error ? error.message : String(error)
  writeJson(response, 400, { ok: false, error: { message } })
}

/** Session working directory, mirroring better-sidebar's resolution. */
export function sessionCwdOf(ctx, sessionId) {
  const session = ctx.sessions.get(sessionId)
  const headerCwd = session?.header?.cwd
  if (typeof headerCwd === 'string' && headerCwd !== '') return headerCwd
  return process.cwd()
}
