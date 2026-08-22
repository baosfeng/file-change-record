/**
 * Headless-Chrome end-to-end verification via CDP (v2 — bounded waits +
 * progress logs). Loads the real GUI page and checks for the
 * dsh-file-activity tab registration and rendering.
 */
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9225
const PROFILE = '/tmp/dsh-fa-cdp2'

const log = (...args) => console.log('[e2e]', ...args)

rmSync(PROFILE, { recursive: true, force: true })
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--remote-allow-origins=*', '--disable-background-networking', '--disable-component-update',
  'about:blank',
], { stdio: 'ignore' })

async function cdpJson(path, timeoutMs = 3000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { signal: controller.signal })
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const timer = setTimeout(() => { try { ws.close() } catch {} ; reject(new Error('ws connect timeout')) }, 4000)
    ws.onopen = () => { clearTimeout(timer); resolve(ws) }
    ws.onerror = () => { clearTimeout(timer); reject(new Error('ws error')) }
  })
}

function cdpCall(ws, method, params = {}, timeoutMs = 6000) {
  const id = Math.floor(Math.random() * 1e9)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('message', onMessage)
      reject(new Error(`CDP ${method} timeout`))
    }, timeoutMs)
    const onMessage = (event) => {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      if (msg.id === id) {
        clearTimeout(timer)
        ws.removeEventListener('message', onMessage)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
    }
    ws.addEventListener('message', onMessage)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(ws, expression) {
  const result = await cdpCall(ws, 'Runtime.evaluate', { expression, returnByValue: true })
  return result?.result?.value
}

try {
  log('waiting for CDP endpoint...')
  let targets = []
  for (let i = 0; i < 20; i++) {
    try {
      targets = await cdpJson('/json/list')
      if (targets.length > 0) break
    } catch { /* retry */ }
    await sleep(300)
  }
  if (targets.length === 0) throw new Error('CDP endpoint did not come up')
  log('CDP endpoint up, targets:', targets.length)

  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  log('connecting to page target...')
  const ws = await connect(page.webSocketDebuggerUrl)
  log('connected, enabling runtime...')
  await cdpCall(ws, 'Runtime.enable')
  await cdpCall(ws, 'Page.enable')
  log('navigating to GUI...')
  await cdpCall(ws, 'Page.navigate', { url: 'http://127.0.0.1:3080/' }, 10000)

  log('waiting for app render (polling DOM)...')
  let bodyText = ''
  for (let i = 0; i < 25; i++) {
    await sleep(2000)
    try {
      bodyText = (await evaluate(ws, 'document.body ? document.body.innerText : ""')) || ''
      if (i % 3 === 0) log(`poll ${i}: body ${bodyText.length} chars, hasTab=${bodyText.includes('文件活动') || bodyText.includes('File Activity')}`)
      if (bodyText.includes('文件活动') || bodyText.includes('File Activity')) break
    } catch (error) {
      log('poll error (ignored):', error.message)
    }
  }

  const checks = {}
  checks.tabRendered = bodyText.includes('文件活动') || bodyText.includes('File Activity')
  log('tab rendered:', checks.tabRendered)

  try {
    const lsValue = await evaluate(ws, 'JSON.stringify(Array.from({length: localStorage.length}, (_, i) => { const k = localStorage.key(i); return [k, localStorage.getItem(k)] }).filter(([k]) => k.includes("file-activity") || k.includes("better-sidebar") || k.includes("dsh-sidebar")))')
    checks.localStorage = lsValue ?? '{}'
    log('localStorage plugin/sidebar keys:', String(checks.localStorage).slice(0, 1200))
  } catch (error) {
    log('localStorage read failed:', error.message)
  }

  // Sidebar panel DOM presence (better-sidebar mounts a portal host)
  try {
    const panelInfo = await evaluate(ws, 'JSON.stringify({ panelHost: !!document.querySelector("[data-dsh-panel-host]"), sidebarRoot: !!document.querySelector("[data-dsh-sidebar]"), bodyLen: document.body.innerText.length })')
    log('panel DOM:', panelInfo)
  } catch (error) {
    log('panel DOM read failed:', error.message)
  }

  log('body snippet:', bodyText.replace(/\s+/g, ' ').slice(0, 900))
  log('=== E2E DONE ===')
} catch (error) {
  console.error('[e2e] FAILED:', error.message)
} finally {
  try { chrome.kill('SIGKILL') } catch {}
  process.exit(0)
}
