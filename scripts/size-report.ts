/**
 * `pnpm run size:report` (run `pnpm run build` first): where the bytes are.
 *
 * Per package and dist file: raw/gzip/brotli; per-module contribution from the
 * shipped sourcemaps (no sourcesContent, #1968, so attribution decodes the
 * mappings); biggest modules; modules duplicated across ESM outputs; and what
 * `npm pack --dry-run --json` would publish. Output is Markdown. Logic lives
 * in scripts/lib/size-report.ts (tested); this file is I/O only.
 *
 * Usage: tsx scripts/size-report.ts [--top N]
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  attribute,
  findDuplicates,
  measure,
  moduleLabel,
  table,
  tarballByKind,
  topN,
  type SourceMap,
} from './lib/size-report.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = [
  '.',
  'packages/core',
  'packages/mermaid-parser',
  'packages/svg-renderer',
  'packages/ascii-renderer',
  'packages/mcp',
]
const topIdx = process.argv.indexOf('--top')
const TOP = topIdx > 0 ? Number(process.argv[topIdx + 1]) || 10 : 10
const kb = (n: number) => `${(n / 1024).toFixed(1)} KiB`

const esmModules: Record<string, Map<string, number>> = {}

for (const pkg of PACKAGES) {
  const dir = join(ROOT, pkg)
  const dist = join(dir, 'dist')
  if (!existsSync(dist)) {
    console.log(`## ${pkg}\n\nMISSING dist/: run \`pnpm run build\` first\n`)
    continue
  }
  const name = (
    JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      name: string
    }
  ).name
  console.log(`## ${name} (${pkg})\n`)

  const js = readdirSync(dist).filter((f) => /\.c?js$/.test(f))
  console.log(
    table(
      ['file', 'raw', 'gzip', 'brotli'],
      js.map((f) => {
        const s = measure(readFileSync(join(dist, f)))
        return [`dist/${f}`, s.raw, s.gzip, s.brotli]
      }),
    ),
  )

  for (const f of js) {
    const mapPath = join(dist, `${f}.map`)
    if (!existsSync(mapPath)) {
      console.log(`\n_dist/${f}: no sourcemap, no per-module breakdown_`)
      continue
    }
    const map = JSON.parse(readFileSync(mapPath, 'utf8')) as SourceMap
    const mods = new Map<string, number>()
    for (const [src, n] of attribute(
      readFileSync(join(dist, f), 'utf8'),
      map,
    )) {
      const label = moduleLabel(dist, src, ROOT)
      mods.set(label, (mods.get(label) ?? 0) + n)
    }
    if (f.endsWith('.js')) esmModules[`${pkg}/dist/${f}`] = mods
    const rows = topN(
      [...mods].map(([m, bytes]) => ({ m, bytes })),
      TOP,
    )
    console.log(`\nTop ${TOP} modules in dist/${f} (chars of output):\n`)
    console.log(
      table(
        ['module', 'chars'],
        rows.map((r) => [r.m, r.bytes]),
      ),
    )
  }

  const out = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  )[0] as {
    size: number
    unpackedSize: number
    files: { path: string; size: number }[]
  }
  const kinds = tarballByKind(out.files)
  console.log(
    `\nTarball: ${out.size} B packed, ${out.unpackedSize} B unpacked (${kb(out.unpackedSize)})\n`,
  )
  console.log(
    table(
      ['kind', 'bytes', 'share of unpacked'],
      Object.entries(kinds)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => [
          k,
          n,
          `${((n / out.unpackedSize) * 100).toFixed(1)}%`,
        ]),
    ),
  )
  console.log(
    `\n<details><summary>npm pack file list</summary>\n\n${table(
      ['path', 'bytes'],
      out.files.map((x) => [x.path, x.size]),
    )}\n\n</details>\n`,
  )
}

const dups = findDuplicates(esmModules)
console.log('## Modules present in more than one ESM output\n')
console.log(
  dups.length === 0
    ? 'None.'
    : table(
        ['module', 'files', 'extra chars'],
        dups
          .slice(0, TOP * 2)
          .map((d) => [d.module, d.files.join(', '), d.bytes]),
      ),
)
