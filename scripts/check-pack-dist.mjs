// Release guard (#1991): fail if any public package's tarball would ship
// without its entry files (main/module/types/bin/exports targets). 5.1.0 and
// 5.2.0 went out with no dist/ because the release job never built.
// Run after `pnpm run build`: `node scripts/check-pack-dist.mjs`.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const leaves = (v) =>
  typeof v === 'string'
    ? [v]
    : v && typeof v === 'object'
      ? Object.values(v).flatMap(leaves)
      : []

/** Entry files a package.json promises that `npm pack --dry-run` does not list. */
export function missingEntries(dir) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const packed = new Set(
    JSON.parse(
      execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
        cwd: dir,
        encoding: 'utf8',
      }),
    )[0].files.map((f) => f.path),
  )
  const entries = [
    pkg.main,
    pkg.module,
    pkg.types,
    ...leaves(pkg.bin),
    ...leaves(pkg.exports),
  ]
    .filter((e) => typeof e === 'string' && !e.includes('*'))
    .map((e) => e.replace(/^\.\//, ''))
  return [...new Set(entries)].filter((e) => !packed.has(e))
}

export function main(root = resolve(import.meta.dirname, '..')) {
  const dirs = [
    root,
    ...readdirSync(join(root, 'packages')).map((d) => join(root, 'packages', d)),
  ].filter(
    (d) =>
      existsSync(join(d, 'package.json')) &&
      !JSON.parse(readFileSync(join(d, 'package.json'), 'utf8')).private,
  )
  let bad = 0
  for (const d of dirs) {
    const missing = missingEntries(d)
    if (missing.length) {
      bad++
      console.error(
        `FAIL ${d}: tarball lacks ${missing.join(', ')} (was the build run?)`,
      )
    }
  }
  console.log(`checked ${dirs.length} packages, ${bad} missing entry files`)
  return bad ? 1 : 0
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main())
