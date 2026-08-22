#!/usr/bin/env node
/**
 * Extract the CHANGELOG.md section for a given version and write it to a file.
 *
 * Usage: node .github/scripts/extract-release-body.mjs <version> <out-file>
 *   version: bare semver, e.g. 0.1.0 (matches the "## [0.1.0]" heading)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [version, outFile] = process.argv.slice(2)
if (!version || !outFile) {
  console.error('usage: extract-release-body.mjs <version> <out-file>')
  process.exit(2)
}

const changelog = readFileSync(resolve('CHANGELOG.md'), 'utf8')
const lines = changelog.split('\n')

const heading = `## [${version}]`
const start = lines.findIndex((l) => l.trim().startsWith(heading))
if (start === -1) {
  console.error(`no CHANGELOG.md section found for [${version}]`)
  process.exit(1)
}

// Collect lines until the next "## " heading (any level-2 heading).
const body = []
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].startsWith('## ')) break
  body.push(lines[i])
}

const result = body.join('\n').trim() + '\n'
writeFileSync(resolve(outFile), result, 'utf8')
console.log(`extracted ${result.length} bytes for ${version} -> ${outFile}`)
