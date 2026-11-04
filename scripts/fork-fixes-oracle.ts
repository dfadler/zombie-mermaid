/**
 * Oracle harness for the fork-fixes audit (#2606/#2607): renders every
 * `demo/fork-fixes-data.ts` source with a mermaid install OUTSIDE the repo
 * (default: the latest npm release) and, for comparison, with the repo pin.
 *
 * Setup (once):  mkdir -p $ORACLE_DIR/mermaid-latest && cd $_ && npm init -y && npm i mermaid@latest
 * Run:           MERMAID_LATEST_DIR=<that dir> OUT=<out dir> pnpm exec tsx scripts/fork-fixes-oracle.ts [--only=id,id]
 *
 * Writes, per entry id, to $OUT: `<id>.png`, `<id>.json` (facts: source, error,
 * trimmed SVG, element counts, marker ids) and `<id>.pin.json` when the pin's
 * render differs; plus `manifest.json` (versions, rejected sources, pin-vs-latest diffs).
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { forkFixes } from '../demo/fork-fixes-data.ts'
import {
  startRealMermaid,
  renderRealMermaidSvg,
  trimMermaidSvg,
  type RealMermaidSession,
} from './lib/real-mermaid.ts'

const latestDir = resolve(process.env.MERMAID_LATEST_DIR ?? '')
const out = resolve(process.env.OUT ?? '')
if (!process.env.MERMAID_LATEST_DIR || !process.env.OUT)
  throw new Error('set MERMAID_LATEST_DIR and OUT')
const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',')

const version = async (dir: string) =>
  JSON.parse(
    await readFile(join(dir, 'node_modules/mermaid/package.json'), 'utf8'),
  ).version as string

async function renderOne(s: RealMermaidSession, id: string, source: string) {
  try {
    // rough.js seeds its wobble from Math.random; reseed so pin/latest compare deterministically.
    await s.page.evaluate(() => {
      let a = 0x2f6e2b1
      Math.random = () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    })
    // One render id per entry so the pin/latest SVGs are comparable byte-for-byte.
    const svg = await renderRealMermaidSvg(
      s,
      `fx_${id.replace(/-/g, '_')}`,
      source,
    )
    return { svg, error: null as string | null }
  } catch (e) {
    return { svg: null, error: e instanceof Error ? e.message : String(e) }
  }
}

const facts = (svg: string) => ({
  nodes: (svg.match(/class="[^"]*\bnode\b/g) ?? []).length,
  edgePaths: (svg.match(/class="[^"]*\bedgePath\b/g) ?? []).length,
  markers: [...svg.matchAll(/<marker[^>]*id="([^"]+)"/g)].map((m) => m[1]),
  markerRefs: [
    ...new Set(
      [...svg.matchAll(/marker-(?:start|end)="url\(#([^)]+)\)"/g)].map(
        (m) => m[1],
      ),
    ),
  ],
  text: [...svg.matchAll(/<(?:text|span|p)[^>]*>([^<]+)</g)]
    .map((m) => m[1].trim())
    .filter(Boolean),
})
// Iconify ids carry a per-page random suffix; they're noise for the comparison.
const norm = (svg: string) =>
  trimMermaidSvg(svg).replace(/IconifyId[0-9a-f]+/g, 'IconifyId')
const hash = (s: string) =>
  createHash('sha1').update(s).digest('hex').slice(0, 10)

await mkdir(out, { recursive: true })
const pin = await startRealMermaid()
const latest = await startRealMermaid(
  join(latestDir, 'node_modules/mermaid/dist/mermaid.min.js'),
)
const versions = {
  pin: await version(resolve(import.meta.dirname, '..')),
  latest: await version(latestDir),
}
const manifest = {
  versions,
  count: 0,
  rejected: [] as unknown[],
  pinRejected: [] as unknown[],
  pinVsLatestDiffers: [] as string[],
  entries: [] as unknown[],
}
try {
  for (const f of forkFixes.filter((f) => !only || only.includes(f.id))) {
    const [l, p] = [
      await renderOne(latest, f.id, f.source),
      await renderOne(pin, f.id, f.source),
    ]
    manifest.count++
    if (l.error) manifest.rejected.push({ id: f.id, error: l.error })
    if (p.error) manifest.pinRejected.push({ id: f.id, error: p.error })
    let png: string | null = null
    if (l.svg) {
      await latest.page.setContent(
        `<body style="margin:0;background:#fff;padding:16px">${l.svg}</body>`,
      )
      png = `${f.id}.png`
      await latest.page.screenshot({ path: join(out, png), fullPage: true })
    }
    const differs =
      l.svg !== null && p.svg !== null && norm(l.svg) !== norm(p.svg)
    if (differs || (l.error !== null) !== (p.error !== null))
      manifest.pinVsLatestDiffers.push(f.id)
    await writeFile(
      join(out, `${f.id}.json`),
      JSON.stringify(
        {
          id: f.id,
          title: f.title,
          source: f.source,
          mermaidVersion: versions.latest,
          error: l.error,
          png,
          facts: l.svg ? facts(l.svg) : null,
          trimmedSvg: l.svg ? trimMermaidSvg(l.svg) : null,
          pinTrimmedSvg: differs && p.svg ? trimMermaidSvg(p.svg) : undefined,
        },
        null,
        2,
      ),
    )
    manifest.entries.push({
      id: f.id,
      ok: !l.error,
      png,
      svgHash: l.svg ? hash(trimMermaidSvg(l.svg)) : null,
    })
  }
} finally {
  await Promise.all([pin.close(), latest.close()])
}
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(
  `${manifest.count} entries @ mermaid ${versions.latest} (pin ${versions.pin}): ${manifest.rejected.length} rejected, ${manifest.pinVsLatestDiffers.length} differ pin vs latest -> ${out}`,
)
