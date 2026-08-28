/**
 * post-release.mjs — 发版后校验（issue #36）：GitHub Release 创建成功 + npm 版本同步。
 *
 * 从 release.mjs 移出（控制 release.mjs 文件行数 ≤ 300）；逻辑不变：
 *   - waitForRelease：轮询 GitHub API 确认 Release 已创建（需 GH_TOKEN，未配置跳过）
 *   - waitForNpm：轮询 npm registry 确认目标版本已发布
 *   - verifyPostRelease：任一失败即 exit 1
 */
import { execSync } from 'node:child_process'

/** 轮询 GitHub API 确认 Release 已创建（tag push 后 workflow 需时间跑）。 */
export async function waitForRelease(tag, timeoutMs = 300000) {
  const token = process.env.GH_TOKEN
  if (!token) return { ok: false, skipped: true }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(
      `https://api.github.com/repos/baosfeng/my-dsh-plugins/releases/tags/${encodeURIComponent(tag)}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
      },
    )
    if (res.status === 200) return { ok: true }
    if (res.status !== 404) return { ok: false, http: res.status }
    await new Promise((r) => setTimeout(r, 10000))
  }
  return { ok: false, timeout: true }
}

/** 确认 npm 已发布目标版本（npm view <pkg> version）。 */
export async function waitForNpm(pkgName, version, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const out = execSync(`npm view ${pkgName} version`, { encoding: 'utf8' }).trim()
      if (out === version) return { ok: true }
    } catch {
      // npm view 失败（包未发布）→ 继续轮询
    }
    await new Promise((r) => setTimeout(r, 10000))
  }
  return { ok: false, timeout: true }
}

/** 发版后校验：Release + npm 任一失败即 exit 1（issue #36 期望 3）。 */
export async function verifyPostRelease(pkgName, name, version) {
  const tag = `${name}@v${version}`
  const release = await waitForRelease(tag)
  if (release.skipped) {
    console.log('- GH_TOKEN 未配置，跳过 GitHub Release 校验（发版后请手动确认）')
  } else if (release.ok) {
    console.log(`✓ GitHub Release ${tag} 已创建`)
  } else {
    console.error(
      `✗ GitHub Release ${tag} 未在 5 分钟内创建（workflow 可能失败）— 请检查 https://github.com/baosfeng/my-dsh-plugins/actions`,
    )
    process.exit(1)
  }
  const npm = await waitForNpm(pkgName, version)
  if (npm.ok) {
    console.log(`✓ npm ${pkgName}@${version} 已发布`)
  } else {
    console.error(`✗ npm ${pkgName}@${version} 未在 5 分钟内发布（包名被占用或 publish 失败）— 请检查 Actions 日志`)
    process.exit(1)
  }
}
