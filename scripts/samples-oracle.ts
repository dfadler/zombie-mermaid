/**
 * Gallery fidelity oracle (#2678), sibling of `fork-fixes-oracle.ts` for the
 * two sample files; ids match the snapshot PNG names. Setup: `npm i mermaid@latest`
 * in an empty dir outside the repo. Run:
 *   MERMAID_LATEST_DIR=<dir> OUT=<out dir> pnpm exec tsx scripts/samples-oracle.ts [--only=id,id] [--prefix=general|xychart]
 * Writes `<id>.png`, `<id>.json` and `manifest.json` (versions, rejections, pin-vs-latest diffs) to $OUT.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { samples } from '../samples/samples-data.ts'
import { xychartSamples } from '../samples/xychart-samples-data.ts'
import {
  facts,
  hash,
  norm,
  ourLabels,
  slug,
} from './lib/samples-oracle-facts.ts'
import {
  startRealMermaid,
  renderRealMermaidSvg,
  trimMermaidSvg,
  type RealMermaidSession,
} from './lib/real-mermaid.ts'

if (!process.env.MERMAID_LATEST_DIR || !process.env.OUT)
  throw new Error('set MERMAID_LATEST_DIR and OUT')
const latestDir = resolve(process.env.MERMAID_LATEST_DIR)
const out = resolve(process.env.OUT)
const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',')
const prefix = process.argv.find((a) => a.startsWith('--prefix='))?.slice(9)

// Names as in svg-samples.visual.test.ts; Hero is not snapshotted.
const cases = [
  ...samples.map((s, i) => ({ s, id: `general-${i}`, group: 'general' })),
  ...xychartSamples.map((s, i) => ({
    s,
    id: `xychart-${i}`,
    group: 'xychart',
  })),
]
  .filter(
    ({ s, group }) =>
      (group !== 'general' || s.category !== 'Hero') &&
      (!prefix || group === prefix),
  )
  .map(({ s, id }) => ({
    id: `${id}-${slug(s.category ?? 'uncategorized')}-${slug(s.title)}`,
    title: s.title,
    source: s.source,
    options: 'options' in s ? s.options : undefined,
  }))
const version = async (dir: string) =>
  JSON.parse(
    await readFile(join(dir, 'node_modules/mermaid/package.json'), 'utf8'),
  ).version as string

async function renderOne(s: RealMermaidSession, id: string, source: string) {
  try {
    // Reseed Math.random (rough.js wobble) so pin/latest compare deterministically.
    await s.page.evaluate(() => {
      let a = 0x2f6e2b1
      Math.random = () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    })
    const rid = `sm_${id.replace(/-/g, '_')}`
    const svg = await renderRealMermaidSvg(s, rid, source)
    return { svg, error: null as string | null }
  } catch (e) {
    return { svg: null, error: e instanceof Error ? e.message : String(e) }
  }
}

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
  for (const f of cases.filter((f) => !only || only.includes(f.id))) {
    const l = await renderOne(latest, f.id, f.source)
    const p = await renderOne(pin, f.id, f.source)
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
          ours: ourLabels(f.source, f.options),
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
      svgHash: l.svg ? hash(norm(l.svg)) : null,
    })
  }
} finally {
  await Promise.all([pin.close(), latest.close()])
}
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(
  `${manifest.count} cases @ mermaid ${versions.latest} (pin ${versions.pin}): ${manifest.rejected.length} rejected, ${manifest.pinVsLatestDiffers.length} differ pin vs latest -> ${out}`,
)
