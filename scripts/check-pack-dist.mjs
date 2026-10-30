// Release guard (#1991): fail if any public package's tarball would ship
// without its entry files (main/module/types/bin/exports targets). 5.1.0 and
// 5.2.0 went out with no dist/ because the release job never built.
// Run after `pnpm run build`: `node scripts/check-pack-dist.mjs`.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const leaves = (v) =>
  typeof v === 'string'
    ? [v]
    : v && typeof v === 'object'
      ? Object.values(v).flatMap(leaves)
      : []

const packedFiles = (dir) =>
  new Set(
    JSON.parse(
      execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
        cwd: dir,
        encoding: 'utf8',
      }),
    )[0].files.map((f) => f.path),
  )

/**
 * Source-map problems in what `npm pack` would ship (#2195): any `.map` file
 * (no sourcesContent, and the `../src` files they name are not packed, so a
 * consumer cannot use them), and any packed script whose
 * `//# sourceMappingURL=` names a file that is not in the tarball.
 */
export function mapProblems(dir) {
  const packed = packedFiles(dir)
  const out = [...packed]
    .filter((f) => f.endsWith('.map'))
    .map((f) => `ships ${f}`)
  for (const f of packed) {
    if (!/\.[cm]?js$/.test(f)) continue
    const m = /^\/\/# sourceMappingURL=(.+)$/m.exec(
      readFileSync(join(dir, f), 'utf8'),
    )
    if (m && !packed.has(join(dirname(f), m[1])))
      out.push(`${f} -> missing ${m[1]}`)
  }
  return out
}

/**
 * `dist/cli.js` must import the shared `./ascii-layout.js` entry, not carry its own
 * `./src-*.js` chunks (#2272): a second copy of the ascii-layout code (~25 KB unpacked).
 */
export function cliChunkProblems(dir) {
  const f = join(dir, 'dist/cli.js')
  if (!existsSync(f)) return []
  const chunks = [
    ...readFileSync(f, 'utf8').matchAll(/["'](\.\/src-[^"']+)["']/g),
  ].map((m) => `dist/cli.js loads its own chunk ${m[1]}`)
  return chunks
}

/** Entry files a package.json promises that `npm pack --dry-run` does not list. */
export function missingEntries(dir) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const packed = packedFiles(dir)
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
    ...readdirSync(join(root, 'packages')).map((d) =>
      join(root, 'packages', d),
    ),
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
    const maps = mapProblems(d)
    if (maps.length) {
      bad++
      console.error(`FAIL ${d}: source maps (#2195): ${maps.join('; ')}`)
    }
    const dup = cliChunkProblems(d)
    if (dup.length) {
      bad++
      console.error(`FAIL ${d}: duplicate chunks (#2272): ${dup.join('; ')}`)
    }
  }
  console.log(`checked ${dirs.length} packages, ${bad} failing`)
  return bad ? 1 : 0
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main())
