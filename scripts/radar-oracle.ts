/**
 * Compares the drawing of every radar sample in official mermaid.js and in our
 * SVG (#2814): viewBox, graticule rings, axis spokes and labels, curves, legend
 * rows and title, all exact to 0.01 (see scripts/lib/radar-agreement.ts).
 *
 * Usage: tsx scripts/radar-oracle.ts [--filter=<text>] [--thresholds]
 *        [--write-fixture=<file>]
 * `--thresholds` exits 1 when a sample differs or errored. `--write-fixture`
 * saves the official SVGs (without their CSS) for __tests__/radar-agreement.test.ts.
 * Set MERMAID_DIST=<path to mermaid.min.js> to score another mermaid build
 * (the first output line names the version scored).
 * Needs Chromium (`pnpm exec playwright install chromium`). A diagnostic, not CI.
 */
import { writeFileSync } from 'node:fs'
import { samples } from '../samples/samples-data.ts'
import { mermaidVersion } from './lib/mermaid-pin-freshness.ts'
import { radarMismatches, RADAR_EXTRA_SOURCES } from './lib/radar-agreement.ts'
import { renderRealMermaidSvg, startRealMermaid } from './lib/real-mermaid.ts'

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const filter = args.find((a) => a.startsWith('--filter='))?.slice(9)
  const fixture = args.find((a) => a.startsWith('--write-fixture='))?.slice(16)
  const distPath = process.env.MERMAID_DIST // A mermaid.min.js other than the pin
  console.log(`mermaid ${mermaidVersion(distPath)}`)
  const wanted = [
    ...samples
      .filter((s) => /^\s*radar-beta/.test(s.source))
      .map((s) => [s.title, s.source] as const),
    ...Object.entries(RADAR_EXTRA_SOURCES),
  ].filter(
    ([title]) => !filter || title.toLowerCase().includes(filter.toLowerCase()),
  )
  const session = await startRealMermaid(distPath)
  const saved: Record<string, { source: string; official: string }> = {}
  const bad: string[] = []
  try {
    for (const [i, [title, source]] of wanted.entries()) {
      try {
        const svg = await renderRealMermaidSvg(session, `radar_${i}`, source)
        saved[title] = {
          source,
          official: svg.replace(/<style>[\s\S]*?<\/style>/g, ''),
        }
        const diffs = radarMismatches(source, svg)
        console.log(`${diffs.length === 0 ? 'ok  ' : 'FAIL'} ${title}`)
        for (const d of diffs.slice(0, 5)) console.log(`       ${d}`)
        if (diffs.length > 0) bad.push(title)
      } catch (err) {
        console.log(`ERR  ${title}: ${(err as Error).message.split('\n')[0]}`)
        bad.push(title)
      }
    }
  } finally {
    await session.close()
  }
  if (fixture) {
    writeFileSync(fixture, JSON.stringify(saved, null, 2) + '\n')
    console.log(`wrote ${fixture}`)
  }
  if (args.includes('--thresholds') && bad.length > 0) {
    console.error(`\nDiffers from mermaid: ${bad.join(', ')}`)
    return 1
  }
  return 0
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], 'file://').href
) {
  process.exit(await main())
}
