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
    .replace(/<[^>]+>|[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-')

export function anchors(md: string): Set<string> {
  const seen = new Map<string, number>()
  const out = new Set<string>()
  for (const m of md
    .replace(/```[\s\S]*?```/g, '')
    .matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
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
  nodeMajor: string,
  exists: (p: string) => boolean = existsSync,
  read: (p: string) => string = (p) => readFileSync(p, 'utf8'),
): string[] {
  const errs: string[] = []
  // Blank out fenced code (keeps line numbers): examples may name hypothetical paths.
  const prose = md.replace(/```[\s\S]*?```/g, (b) =>
    '\n'.repeat(b.split('\n').length - 1),
  )
  prose.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`
    for (const m of line.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const href = m[1]!
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
      if (m[1] !== nodeMajor)
        errs.push(`${at}: "${m[0]}" but .nvmrc is ${nodeMajor}`)
  })
  return errs
}

function nodeConsistency(want: string): string[] {
  const errs: string[] = []
  const eng = JSON.parse(readFileSync('package.json', 'utf8')).engines?.node as
    string | undefined
  if (eng && !eng.includes(want))
    errs.push(`package.json engines.node "${eng}" vs .nvmrc ${want}`)
  const wf = execFileSync('git', ['ls-files', '.github/workflows'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
  for (const f of wf)
    for (const m of readFileSync(f, 'utf8').matchAll(
      /node-version:\s*['"]?(\d+)/g,
    ))
      if (m[1] !== want)
        errs.push(`${f}: node-version ${m[1]} vs .nvmrc ${want}`)
  return errs
}

if (process.argv[1]?.endsWith('check-docs.ts')) {
  const want = readFileSync('.nvmrc', 'utf8')
    .trim()
    .replace(/^v/, '')
    .split('.')[0]!
  const files = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !FROZEN.test(f) && !KNOWN_STALE.has(f))
  const errs = [
    ...nodeConsistency(want),
    ...files.flatMap((f) => checkDoc(f, readFileSync(f, 'utf8'), want)),
  ]
  if (errs.length) {
    console.error(errs.join('\n') + `\n${errs.length} docs drift problem(s)`)
    process.exit(1)
  }
  console.log(`docs drift: ${files.length} files ok`)
}
