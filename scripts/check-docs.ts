// Docs drift guards (#1570): relative links + anchors, stale repo paths,
// diagram-type counts, Node-version consistency. Run: pnpm run check:docs
// Frozen historical docs (research, decisions, blog posts, changelog) are
// excluded by path; ponytail: swap for status-header detection once #1549 lands.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DIAGRAM_TYPES } from '../packages/core/src/diagram-type.ts'

const FROZEN =
  /^(docs\/(research|decisions)\/|blog-posts\/|CHANGELOG\.md|.*\/CHANGELOG\.md|\.changeset\/|\.agents\/|\.claude\/)/
// Known-stale docs awaiting their own cleanup; remove an entry when fixed.
// ponytail: whole-file skip, per-line baseline if this list grows.
const KNOWN_STALE = new Set([
  'CLAUDE.md', // demo/client.ts (renamed; needs owner decision)
  'docs/parser-error-audit-541.md', // pre-monorepo src/ paths
  'docs/xychart-design.md', // pre-monorepo src/ paths
  'docs/promotion/258-pr-rescue-candidates.md', // pre-monorepo src/ paths
])
const ROOTS = [
  'src/',
  'packages/',
  'scripts/',
  'docs/',
  'demo/',
  '__tests__/',
  'config/',
  '.github/',
  'skills/',
]
const NUMWORDS: Record<string, number> = {
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
}

const slug = (h: string) =>
  h
    .toLowerCase()
    .replace(/<[^>]+>|[`*~]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-')

// Blank out fenced code (backtick or tilde; the closer must reuse the opener's
// marker and be at least as long), keeping line numbers intact.
export function stripFences(md: string): string {
  let open: { ch: string; len: number } | null = null
  return md
    .split('\n')
    .map((line) => {
      const m = /^ {0,3}(`{3,}|~{3,})/.exec(line)
      if (!open) {
        if (!m) return line
        open = { ch: m[1]![0]!, len: m[1]!.length }
        return ''
      }
      if (m && m[1]![0] === open.ch && m[1]!.length >= open.len) open = null
      return ''
    })
    .join('\n')
}

// True when the range admits only the given major or newer.
export function engineMatches(eng: string, want: string): boolean {
  if (eng.includes('||')) return false
  // Fixed regex captures the leading major; compare it as a string (no dynamic RegExp, ReDoS-safe).
  const m = /^\s*(?:>=|\^|~)?\s*v?(\d+)(?!\d)/.exec(eng)
  return m?.[1] === want
}

export function anchors(md: string): Set<string> {
  const seen = new Map<string, number>()
  const out = new Set<string>()
  for (const m of stripFences(md).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const s = slug(m[1]!)
    const n = seen.get(s) ?? 0
    seen.set(s, n + 1)
    out.add(n ? `${s}-${n}` : s)
  }
  return out
}

export function checkDoc(
  file: string,
  md: string,
  nodeMajors: string | string[],
  exists: (p: string) => boolean = existsSync,
  read: (p: string) => string = (p) => readFileSync(p, 'utf8'),
): string[] {
  const errs: string[] = []
  const majors = [nodeMajors].flat()
  // Fenced code is blanked: examples may name hypothetical paths.
  const prose = stripFences(md)
  prose.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`
    const hrefs = [
      ...[...line.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map(
        (m) => m[1]!,
      ),
      // reference-style definition: `[id]: ./dest.md "title"`
      ...[...line.matchAll(/^ {0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/g)].map(
        (m) => m[1]!,
      ),
    ]
    for (const href of hrefs) {
      if (/^([a-z]+:|\/\/)/i.test(href)) continue
      const [p, frag] = href.split('#')
      const target = p ? resolve(dirname(file), p) : resolve(file)
      if (!exists(target)) errs.push(`${at}: broken link ${href}`)
      else if (
        frag &&
        target.endsWith('.md') &&
        !anchors(read(target)).has(frag.toLowerCase())
      )
        errs.push(`${at}: missing anchor ${href}`)
    }
    for (const m of line.matchAll(/`([^`\s]+)`/g)) {
      const t = m[1]!.replace(/:\d+(-\d+)?$/, '').replace(/[:,.]+$/, '')
      if (
        ROOTS.some((r) => t.startsWith(r)) &&
        !/[*<>{}$()|[\]]|\.\.\./.test(t) &&
        !exists(resolve(t))
      )
        errs.push(`${at}: stale path ${t}`)
    }
    for (const m of line.matchAll(
      /\b(\d+|six|seven|eight|nine|ten|eleven|twelve)\s+(?:supported\s+)?diagram types\b/gi,
    )) {
      const n = NUMWORDS[m[1]!.toLowerCase()] ?? Number(m[1])
      if (n !== DIAGRAM_TYPES.length)
        errs.push(
          `${at}: "${m[0]}" but DIAGRAM_TYPES has ${DIAGRAM_TYPES.length}`,
        )
    }
    for (const m of line.matchAll(/\bNode(?:\.js)?\s*(?:v|>=\s*)?(\d{2})\b/g))
      if (!majors.includes(m[1]!))
        errs.push(`${at}: "${m[0]}" but .nvmrc/engines are ${majors.join('/')}`)
  })
  return errs
}

type Fs = {
  read: (p: string) => string
  ls: (glob: string) => string[]
}
const realFs: Fs = {
  read: (p) => readFileSync(p, 'utf8'),
  ls: (g) =>
    execFileSync('git', ['ls-files', g], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean),
}

export function nodeConsistency(want: string, fs: Fs = realFs): string[] {
  const errs: string[] = []
  // Dev toolchain (#1567): devEngines.runtime must match .nvmrc; the consumer
  // floor (engines.node) is deliberately lower and is allowed in prose below.
  const dev = JSON.parse(fs.read('package.json')).devEngines?.runtime
    ?.version as string | undefined
  if (dev && !engineMatches(dev, want))
    errs.push(`package.json devEngines.runtime "${dev}" vs .nvmrc ${want}`)
  for (const f of fs.ls('.github/workflows'))
    for (const m of fs.read(f).matchAll(/node-version:\s*['"]?(\d+)/g))
      if (m[1] !== want)
        errs.push(`${f}: node-version ${m[1]} vs .nvmrc ${want}`)
  return errs
}

export function checkAll(fs: Fs = realFs): { files: number; errs: string[] } {
  const want = fs.read('.nvmrc').trim().replace(/^v/, '').split('.')[0]!
  const floor = /(\d+)/.exec(
    JSON.parse(fs.read('package.json')).engines?.node ?? '',
  )?.[1]
  const majors = floor && floor !== want ? [want, floor] : want
  const files = fs
    .ls('*.md')
    .filter((f) => !FROZEN.test(f) && !KNOWN_STALE.has(f))
  return {
    files: files.length,
    errs: [
      ...nodeConsistency(want, fs),
      ...files.flatMap((f) => checkDoc(f, fs.read(f), majors)),
    ],
  }
}

/** Prints the report and returns the process exit code. */
export function main(fs: Fs = realFs): number {
  const { files, errs } = checkAll(fs)
  if (errs.length) {
    console.error(errs.join('\n') + `\n${errs.length} docs drift problem(s)`)
    return 1
  }
  console.log(`docs drift: ${files} files ok`)
  return 0
}

if (process.argv[1]?.endsWith('check-docs.ts')) process.exitCode = main()
