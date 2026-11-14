// Lists the docs under docs/research and docs/decisions that are candidates for moving
// their bulk onto the issue they answer, leaving a short summary plus a link in the repo.
// Read-only: it prints a Markdown table and writes nothing. Usage:
//   pnpm exec tsx scripts/doc-migration-report.ts [--max-lines N] [--all]
// A doc is a candidate when it has more than N lines (default 80). `--all` lists every doc.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIRS = ['docs/research', 'docs/decisions']
const SKIP = new Set(['README.md'])

export interface DocRow {
  path: string
  lines: number
  status: string
  issues: number[]
  referencedBy: number
}

/** Issue numbers a doc names: `#123` and `/issues/123`, plus a leading number in the file name. */
export function issueRefs(name: string, text: string): number[] {
  const found = new Set<number>()
  for (const m of text.matchAll(/(?:#|\/issues\/)(\d{2,5})\b/g))
    found.add(Number(m[1]))
  const lead = /^(\d{2,5})-/.exec(name) ?? /-(\d{2,5})(?:-\d+)?\.md$/.exec(name)
  if (lead) found.add(Number(lead[1]))
  return [...found].sort((a, b) => a - b)
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return files(p)
    return f.endsWith('.md') && !SKIP.has(f) ? [p] : []
  })
}

/** Count tracked files outside the doc directories that mention the doc's file name. */
function referencedBy(path: string): number {
  const name = path.split('/').pop() as string
  try {
    const out = execFileSync(
      'git',
      ['grep', '-lF', name, '--', '.', ...DIRS.map((d) => `:!${d}`)],
      {
        encoding: 'utf8',
      },
    )
    return out.split('\n').filter(Boolean).length
  } catch {
    return 0 // git grep exits 1 on no match
  }
}

export function report(maxLines: number, all: boolean): DocRow[] {
  return DIRS.flatMap(files)
    .map((path): DocRow => {
      const text = readFileSync(path, 'utf8')
      const status = /^Status:\s*(.+)$/m.exec(text)?.[1].slice(0, 40) ?? ''
      return {
        path,
        lines: text.split('\n').length,
        status,
        issues: issueRefs(path.split('/').pop() as string, text),
        referencedBy: referencedBy(path),
      }
    })
    .filter((r) => all || r.lines > maxLines)
    .sort((a, b) => b.lines - a.lines)
}

if (process.argv[1]?.endsWith('doc-migration-report.ts')) {
  const args = process.argv.slice(2)
  const i = args.indexOf('--max-lines')
  const maxLines = i >= 0 ? Number(args[i + 1]) : 80
  if (!Number.isFinite(maxLines)) throw new Error('--max-lines needs a number')
  const rows = report(maxLines, args.includes('--all'))
  console.log('| Doc | Lines | Status | Issues named | Referenced by |')
  console.log('| --- | ---: | --- | --- | ---: |')
  for (const r of rows) {
    const issues = r.issues.length
      ? r.issues.map((n) => `#${n}`).join(' ')
      : 'none'
    console.log(
      `| ${r.path} | ${r.lines} | ${r.status} | ${issues} | ${r.referencedBy} |`,
    )
  }
  console.log(
    `\n${rows.length} doc(s)${args.includes('--all') ? '' : ` over ${maxLines} lines`}.`,
  )
}
