/**
 * dsh-shared — atomic JSON persistence（由 dsh-file-activity / dsh-my-context /
 * dsh-my-guard / dsh-my-observability 的 store/persist 原子写逻辑抽取合并，
 * issue #45）。
 */

import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * 原子写 JSON 快照（tmp+rename，自动建目录）；失败仅告警不抛出。
 * 调用方负责串行化（dirtyChain）与防抖调度。
 */
export async function atomicWriteJson(file, value, logger, prefix) {
  const tmp = `${file}.tmp-${process.pid}`
  try {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(tmp, JSON.stringify(value), 'utf8')
    await rename(tmp, file)
  } catch (error) {
    logger?.warn(`${prefix} persist failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
