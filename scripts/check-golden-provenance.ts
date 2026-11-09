// Golden provenance guard (#2679): every tracked golden/snapshot file must be covered by
// an entry in docs/golden-provenance.json (class, source, owning test; a mermaid version and
// verdict when it was compared). Run: pnpm run check:docs
// First matching entry wins; a path ending in '/' matches by prefix. PNG baselines are out of scope.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const GOLDEN =
  /(\.snap$|\/__[a-z-]*snapshots__\/|\/testdata\/|elk-layout\/__tests__\/fixtures\/.*\.expected\.json$|ascii-layout\/__tests__\/fixtures\/.*\.ascii\.txt$|c4-mermaid-reference\.json$|mindmap-official-.*\.json$)/

interface Entry {
  paths: string[]
  class: string
  source: string
  owner: string
  mermaid?: string
  verdict?: string
}
export interface Manifest {
  classes: Record<string, string>
  entries: Entry[]
}

export function checkGoldens(
  files: string[],
  manifest: Manifest,
  exists: (p: string) => boolean = existsSync,
): string[] {
  const errs: string[] = []
  const hit = (e: Entry, f: string) =>
    e.paths.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p))
  manifest.entries.forEach((e, i) => {
    const id = `entry ${i} (${e.paths[0]})`
    if (!(e.class in manifest.classes))
      errs.push(`${id}: unknown class "${e.class}"`)
    if (!e.source) errs.push(`${id}: missing source`)
    if (!exists(e.owner)) errs.push(`${id}: owner ${e.owner} does not exist`)
    if (e.mermaid && !e.verdict)
      errs.push(`${id}: mermaid ${e.mermaid} without a verdict`)
    if (e.class === 'a' && !e.mermaid)
      errs.push(`${id}: class a needs a mermaid version`)
    if (!files.some((f) => hit(e, f)))
      errs.push(`${id}: matches no golden file (stale)`)
  })
  for (const f of files)
    if (!manifest.entries.some((e) => hit(e, f)))
      errs.push(`${f}: no entry in docs/golden-provenance.json`)
  return errs
}

export function main(): number {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => GOLDEN.test('/' + f))
  const manifest = JSON.parse(
    readFileSync('docs/golden-provenance.json', 'utf8'),
  ) as Manifest
  const errs = checkGoldens(files, manifest)
  if (errs.length) {
    console.error(
      errs.join('\n') + `\n${errs.length} golden provenance problem(s)`,
    )
    return 1
  }
  console.log(`golden provenance: ${files.length} files covered`)
  return 0
}

if (process.argv[1]?.endsWith('check-golden-provenance.ts'))
  process.exitCode = main()
