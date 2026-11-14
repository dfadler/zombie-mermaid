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
import { resolve } from 'node:path'
import { renderMermaidASCII, renderMermaidSVG } from '../src/index.ts'
import { samples } from '../samples/samples-data.ts'
import { xychartSamples } from '../samples/xychart-samples-data.ts'
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
// Box-drawing, blocks and arrows touch labels in ASCII (`─other─`): they separate words.
const unbox = (t: string) => t.replace(/[\u2500-\u259F\u25A0-\u25FF]/g, ' ')
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
// `expect` is the exact `verdict|svg missing|ascii missing` signature recorded for it: a row that
// differs in any other way (another word, another failure) is a new difference and fails the run.
const KNOWN: Record<string, { expect: string; note: string }> = {
  'general-112': {
    expect: 'differs||lt;&amp;&gt',
    note: 'the known pie entity false positive of the word check (dfadler/zombie-mermaid#3069)',
  },
  'general-186': {
    expect:
      'differs|pneumonoultramicroscopicsilic,ovolcanoconiosis_extra|Antidisestablishmentarianism,pneumonoultramicroscopicsilic,ovolcanoconiosis_extra',
    note: 'a word wider than the frame is split with a hyphen at a different point than mermaid, by design (dfadler/zombie-mermaid#2773)',
  },
  'general-196': {
    expect: 'not-renderable||',
    note: 'mermaid 12.3.0 throws in headless Chromium, so there is nothing to compare (dfadler/zombie-mermaid#3069)',
  },
  'general-237': {
    expect: 'differs||URG,ACK',
    note: 'packet ASCII truncates narrow field labels (terminal adaptation, dfadler/zombie-mermaid#3069)',
  },
  'general-242': {
    expect: 'differs||quotes',
    note: 'packet ASCII truncates narrow field labels (terminal adaptation, dfadler/zombie-mermaid#3069)',
  },
}
const sig = (r: Record<string, unknown>) =>
  [
    r.verdict,
    [r.svgMissing ?? []].flat().join(','),
    [r.asciiMissing ?? []].flat().join(','),
  ].join('|')
// Always audit the installed build the version label comes from, whatever $MERMAID_DIST says.
const session = await startRealMermaid(
  resolve('node_modules/mermaid/dist/mermaid.min.js'),
)
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
    // Tags become spaces: a wrapped label is several `<tspan>`s, one word each.
    let svgText: Set<string> | null = null
    try {
      svgText = new Set(
        [
          ...renderMermaidSVG(s.source, opts as never).matchAll(
            /<text\b[^>]*>([\s\S]*?)<\/text>/g,
          ),
        ].flatMap((m) => words(m[1].split(/<[^>]*>/).join(' '))),
      )
    } catch {}
    let ascii: string | null = null
    try {
      ascii = renderMermaidASCII(s.source, opts as never)
    } catch {}
    // Whole-word membership, so `APIGateway` cannot stand in for a missing `API`.
    const missing = (hay: Set<string> | null) =>
      hay === null ? ['<render failed>'] : want.filter((w) => !hay.has(w))
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
        : new Set([...words(unbox(ascii)), ...words(unbox(cols.join(' ')))]),
    )
    rows.push({
      id,
      title: s.title,
      verdict: svgMiss.length || asciiMiss.length ? 'differs' : 'match',
      ...(svgMiss.length && { svgMissing: svgMiss }),
      ...(asciiMiss.length && { asciiMissing: asciiMiss }),
    })
  }
} finally {
  await session.close()
}
const known = (r: Record<string, unknown>) => KNOWN[r.id as string]
for (const r of rows) if (known(r)?.expect === sig(r)) r.note = known(r).note
const unexplained = rows.filter(
  (r) => r.verdict !== 'match' && known(r)?.expect !== sig(r),
)
for (const r of unexplained)
  console.log('UNEXPLAINED', sig(r), JSON.stringify(r))
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
