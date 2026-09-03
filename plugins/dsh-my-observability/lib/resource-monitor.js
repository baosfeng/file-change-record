/**
 * dsh-my-observability — 资源采样监控。
 *
 * 每 intervalMs（默认 15s）采样本进程 CPU/内存与审计文件大小/写入速率，
 * 保留最近 MAX_HISTORY 个样本（ring buffer），并做阈值评估（resource-rules）。
 * 用途：让「写放大/资源超限」在运行期当小时可见（9/2 事故复盘结论：
 * 15 小时 300GB 写入零监控是事故未被及时发现的主因）。
 *
 * 采样自身开销：15s 一次 process.cpuUsage/memoryUsage + fs.stat（<0.01% CPU、
 * 零分配大对象），远低于「监控不能放大被监控对象」的护栏（resource-budget-review）。
 */
import { statSync } from 'node:fs'
import { evaluateResourceAlerts, DEFAULT_LIMITS } from './resource-rules.js'
import { jsonlFile } from './store-persist.js'

const DEFAULT_INTERVAL_MS = 15000
const MAX_HISTORY = 60

/** 创建资源监控器：{ sample, start, stop }。options: intervalMs / limits。 */
export function createResourceMonitor(ctx, options = {}) {
  const intervalMs = Number.isFinite(options.intervalMs) && options.intervalMs > 0 ? options.intervalMs : DEFAULT_INTERVAL_MS
  const limits = { ...DEFAULT_LIMITS, ...(options.limits ?? {}) }
  const state = {
    timer: null,
    file: jsonlFile(),
    lastSample: null,
    lastCpu: process.cpuUsage(),
    history: [],
  }
  const monitor = {
    sample: () => sample(state, limits),
    start: () => startMonitor(state, intervalMs, monitor),
    stop: () => stopMonitor(state),
  }
  return monitor
}

/** 采样一次：CPU 使用率（窗口内 user+sys）/RSS/审计文件字节/写入速率 + 告警。 */
function sample(state, limits) {
  const now = Date.now()
  const cpu = process.cpuUsage()
  const cpuDelta = cpu.user - state.lastCpu.user + (cpu.system - state.lastCpu.system) // µs
  state.lastCpu = cpu
  const mem = process.memoryUsage()
  const memoryBytes = mem.rss
  let fileBytes = 0
  try {
    fileBytes = statSync(state.file).size
  } catch {
    // 审计文件尚未创建：字节为 0
  }
  const prev = state.lastSample
  if (prev !== null) {
    const deltaMs = Math.max(now - prev.time, 1)
    // CPU 单核折算：cpuDelta(µs) / deltaMs(ms) / 1000 → 百分比（×100）
    const cpuPercent = (cpuDelta / 1000 / deltaMs) * 100
    const byteDelta = fileBytes - prev.fileBytes
    const writeRateBytesPerHour = byteDelta > 0 ? (byteDelta / deltaMs) * 3600 * 1000 : 0
    const sample = { time: now, cpuPercent, memoryBytes, fileBytes, writeRateBytesPerHour }
    state.history.push(sample)
    if (state.history.length > MAX_HISTORY) state.history.splice(0, state.history.length - MAX_HISTORY)
    state.lastSample = sample
    return { ...sample, history: [...state.history], alerts: evaluateResourceAlerts(sample, limits) }
  }
  state.lastSample = { time: now, fileBytes, memoryBytes, cpuPercent: 0, writeRateBytesPerHour: 0 }
  return { ...state.lastSample, history: [...state.history], alerts: [] }
}

/** 启动周期采样（幂等）。 */
function startMonitor(state, intervalMs, monitor) {
  if (state.timer === null) {
    state.timer = setInterval(() => {
      void monitor.sample()
    }, intervalMs)
    if (state.timer.unref) state.timer.unref()
  }
  return state.timer
}

/** 停止采样（幂等）。 */
function stopMonitor(state) {
  if (state.timer !== null) {
    clearInterval(state.timer)
    state.timer = null
  }
}
