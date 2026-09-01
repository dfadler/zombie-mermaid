/**
 * Generates the shields.io "endpoint" badge data consumed by the README's
 * bundle-size badge: https://shields.io/badges/endpoint-badge — a small
 * JSON file, read directly from this repo's raw content on GitHub, that
 * tells shields.io what label/message/color to render. Unlike a static
 * `img.shields.io/badge/...` URL (which freezes whatever number was true
 * when someone typed it), the badge always reflects whatever this file
 * last committed, so refreshing the badge is "commit a new JSON file",
 * not "hand-edit a URL in README.md".
 *
 * Measures the gzipped size of `dist/index.js` — the main ESM entry point
 * (`import { renderMermaid } from 'zombie-mermaid'`), i.e. the number most
 * consumers actually experience. This intentionally does *not* duplicate
 * scripts/check-bundle-size.ts's multi-file budget/gate logic (added by
 * issue #293, gzip-checking dist/index.{js,cjs}, dist/ascii.{js,cjs}, and
 * dist/cli.js against bundle-size-budget.json) — that script's job is
 * "fail CI on regression," this script's job is "report one number for
 * the badge." Once both scripts have landed on `main`, consider having
 * this one read its size straight from check-bundle-size.ts's own
 * measurement (or from bundle-size-budget.json's key list) instead of
 * hardcoding `dist/index.js` here, so the two can't silently drift.
 *
 * Usage: pnpm run build && tsx scripts/generate-bundle-badge.ts
 *
 * Wired into .github/workflows/publish.yml: runs after a successful npm
 * publish (i.e. once per actual release, not on every merge to main) so
 * the badge tracks what was actually shipped, then commits
 * badges/bundle-size.json back to main if the number changed.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const ENTRY_POINT = 'dist/index.js'
const OUTPUT_PATH = 'badges/bundle-size.json'

function fmtKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

let raw: Buffer
try {
  raw = await readFile(new URL(`../${ENTRY_POINT}`, import.meta.url))
} catch {
  console.error(`Could not read ${ENTRY_POINT} — run \`pnpm run build\` first.`)
  process.exit(1)
}

const gzipSize = gzipSync(raw).length
const message = fmtKB(gzipSize)

// shields.io endpoint badge schema: https://shields.io/badges/endpoint-badge
const badge = {
  schemaVersion: 1,
  label: 'bundle size (gzip)',
  message,
  color: 'blue',
}

await mkdir(new URL('../badges', import.meta.url), { recursive: true })
await writeFile(
  new URL(`../${OUTPUT_PATH}`, import.meta.url),
  JSON.stringify(badge, null, 2) + '\n',
  'utf-8',
)

console.log(`${ENTRY_POINT}: ${message} gzipped -> wrote ${OUTPUT_PATH}`)
