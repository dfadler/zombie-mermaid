/**
 * Label-level verdicts for the 288 gallery cases (188 `general-N` + 100 `xychart-N`)
 * against the repo-pinned mermaid (#2678). Renders each source with real mermaid
 * (`scripts/lib/real-mermaid.ts`), then checks that every word mermaid draws also
 * appears in our SVG and in our ASCII. Pure numbers (ticks) are skipped; extras on
 * our side are not counted. Structure, geometry and palette are NOT compared (#2617);
 * the per-slice visual verdicts live in the #2678 comments.
 *   pnpm exec tsx scripts/gallery-verdicts.ts [--write]   (--write updates docs/gallery-verdicts.json)
 */
import { readFile, writeFile } from 'node:fs/promises'
import { renderMermaidASCII } from '../src/index.ts'
import { samples } from '../samples/samples-data.ts'
import { xychartSamples } from '../samples/xychart-samples-data.ts'
import { ourLabels } from './lib/samples-oracle-facts.ts'
import { renderRealMermaidSvg, startRealMermaid } from './lib/real-mermaid.ts'

const decode = (t: string) =>
  t
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
const words = (t: string) =>
  decode(t)
    .split(/[\s]+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((w) => w && !/^[\d.,%$-]+$/.test(w))
const mermaidWords = (svg: string) =>
  [...svg.matchAll(/<(text|span|p)\b[^>]*>([\s\S]*?)<\/\1>/g)].flatMap((m) =>
    words(m[2].split(/<[^>]*>/).join(' ')),
  )

const pkg = JSON.parse(
  await readFile('node_modules/mermaid/package.json', 'utf8'),
)
const cases = [
  ...samples.map((s, i) => ({
    s,
    id: `general-${i}`,
    hero: s.category === 'Hero',
  })),
  ...xychartSamples.map((s, i) => ({ s, id: `xychart-${i}`, hero: false })),
].filter((c) => !c.hero)

// Why a non-match is not a new defect (checked against open and closed issues when this was written).
const KNOWN: Record<string, string> = {
  'general-112':
    'the known pie entity false positive of the word check (dfadler/zombie-mermaid#3069)',
  'general-186':
    'a word wider than the frame is split with a hyphen at a different point than mermaid, by design (#2773)',
  'general-196':
    'mermaid 12.3.0 throws in headless Chromium, so there is nothing to compare (dfadler/zombie-mermaid#3069)',
  'general-237':
    'packet ASCII truncates narrow field labels (terminal adaptation, dfadler/zombie-mermaid#3069)',
  'general-242':
    'packet ASCII truncates narrow field labels (terminal adaptation, dfadler/zombie-mermaid#3069)',
}
const session = await startRealMermaid()
const rows: Record<string, unknown>[] = []
try {
  for (const { s, id } of cases) {
    const opts = 'options' in s ? s.options : undefined
    let svg: string
    try {
      svg = await renderRealMermaidSvg(
        session,
        `sm_${id.replace('-', '_')}`,
        s.source,
      )
    } catch (e) {
      rows.push({
        id,
        title: s.title,
        verdict: 'not-renderable',
        note: String(e instanceof Error ? e.message : e)
          .split('\n')[0]
          .slice(0, 160),
      })
      continue
    }
    const want = [...new Set(mermaidWords(svg))]
    const ourSvg = ourLabels(s.source, opts)
    const svgText = Array.isArray(ourSvg)
      ? words(ourSvg.join(' ')).join(' ')
      : null
    let ascii: string | null = null
    try {
      ascii = renderMermaidASCII(s.source, opts as never)
    } catch {}
    const missing = (hay: string | null) =>
      hay === null ? ['<render failed>'] : want.filter((w) => !hay.includes(w))
    const svgMiss = missing(svgText)
    // Also read the ASCII down its columns: xychart prints the y-axis title vertically.
    const lines = ascii?.split('\n') ?? []
    const cols = Array.from(
      { length: Math.max(0, ...lines.map((l) => l.length)) },
      (_, c) => lines.map((l) => l[c] ?? ' ').join(''),
    )
    const asciiMiss = missing(
      ascii === null
        ? null
        : words(ascii).join(' ') + ' ' + words(cols.join(' ')).join(' '),
    )
    rows.push({
      id,
      title: s.title,
      verdict: svgMiss.length || asciiMiss.length ? 'differs' : 'match',
      ...(svgMiss.length && { svgMissing: svgMiss.slice(0, 8) }),
      ...(asciiMiss.length && { asciiMissing: asciiMiss.slice(0, 8) }),
    })
  }
} finally {
  await session.close()
}
for (const r of rows)
  if (r.verdict !== 'match' && KNOWN[r.id as string])
    r.note = KNOWN[r.id as string]
const unexplained = rows.filter((r) => r.verdict !== 'match' && !r.note)
const count = (v: string) => rows.filter((r) => r.verdict === v).length
const out = {
  mermaidVersion: pkg.version,
  level:
    'label-level: every word mermaid draws (numbers excluded) appears in our SVG and in our ASCII; structure, geometry and palette not compared (#2617)',
  counts: {
    total: rows.length,
    match: count('match'),
    differs: count('differs'),
    'not-renderable': count('not-renderable'),
  },
  rows,
}
console.log(JSON.stringify(out.counts), 'mermaid', out.mermaidVersion)
if (unexplained.length) process.exitCode = 1 // A new difference: investigate, file an issue, then add it to KNOWN
if (process.argv.includes('--write'))
  await writeFile(
    'docs/gallery-verdicts.json',
    JSON.stringify(out, null, 1) + '\n',
  )
else
  for (const r of rows.filter((r) => r.verdict !== 'match'))
    console.log(JSON.stringify(r))
