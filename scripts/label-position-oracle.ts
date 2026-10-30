/**
 * Compares where an edge label sits relative to its edge, in official mermaid
 * versus our ASCII output (#1385).
 *
 * For each case the label's position along the edge (0 = source end, 1 =
 * target end, measured between the two nodes' facing sides) and its sideways
 * offset from the node centre line are reported for both renderers. Official
 * mermaid centres the label on the edge (along ~0.5, across ~0); the ASCII
 * renderer's deviation from that is what this prints.
 *
 * Usage: tsx scripts/label-position-oracle.ts
 * Needs Chromium (`pnpm exec playwright install chromium`). A diagnostic, not CI.
 */

import { startRealMermaid } from './lib/real-mermaid.ts'
import { measureLabels } from './lib/label-position.ts'

async function main() {
  const session = await startRealMermaid()
  await session.page.evaluate('window.__name = (f) => f')
  try {
    console.log(
      'case                       official along/across(px)  ascii along/across(cells)',
    )
    for (const { name, official: o, ascii: a } of await measureLabels(
      session,
    )) {
      console.log(
        `${name.padEnd(26)} ${o.along.toFixed(2)} / ${o.across.toFixed(0).padStart(4)}`.padEnd(
          52,
        ) + `${a.along.toFixed(2)} / ${a.across.toFixed(1)}`,
      )
    }
  } finally {
    await session.close()
  }
}

// Only run when executed directly, so layout-oracle.ts can import measureLabels.
if (
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], 'file://').href
) {
  await main()
}
