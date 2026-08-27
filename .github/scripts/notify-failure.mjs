#!/usr/bin/env node
/**
 * Release workflow 失败通知（issue #36）：创建 [发版失败] issue。
 *
 * 用法（由 release.yml 的 Notify failure via issue 步骤调用）：
 *   node .github/scripts/notify-failure.mjs
 *
 * 环境变量：
 *   GITHUB_TOKEN  — Actions 自动注入的 token（issues: write 权限）
 *   TAG           — 失败的 tag（如 dsh-my-memory@v0.1.0）
 *   RUN_ID        — 失败的 Actions run id
 */
const token = process.env.GITHUB_TOKEN
const tag = process.env.TAG ?? 'unknown-tag'
const runId = process.env.RUN_ID ?? ''

if (!token) {
  console.error('::warning::GITHUB_TOKEN 未提供，跳过失败通知')
  process.exit(0)
}

const body = [
  `## 发版失败：${tag}`,
  '',
  'Release workflow 执行失败（tag 已推送但 Release/npm 未完成）。',
  '',
  `- **tag**: ${tag}`,
  `- **run**: https://github.com/baosfeng/my-dsh-plugins/actions/runs/${runId}`,
  '- **失败步骤**: 见上方 run 日志',
  '',
  '请排查 workflow 失败原因并补发（修复后重新打 tag 或手动触发）。',
].join('\n')

const payload = JSON.stringify({
  title: `[发版失败] ${tag} Release workflow 失败`,
  body,
  labels: ['bug'],
})

const res = await fetch('https://api.github.com/repos/baosfeng/my-dsh-plugins/issues', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  },
  body: payload,
})

if (res.ok) {
  console.log(`::notice::failure issue created (HTTP ${res.status})`)
} else {
  const text = await res.text()
  console.error(`::warning::failed to create failure issue: HTTP ${res.status} ${text.slice(0, 200)}`)
  process.exit(0)
}
