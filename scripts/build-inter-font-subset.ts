/**
 * Regenerates packages/svg-renderer/src/generated/inter-font-subset.ts, the
 * opt-in `embedFont: 'subset'` data (#1867). All logic, and the reasoning for
 * the subset choices, is in scripts/lib/inter-font-subset.ts (tested by
 * __tests__/generated-inter-font.test.ts, which also fails when the committed
 * file is stale).
 */
import { writeFile } from 'node:fs/promises'
import {
  buildInterSubset,
  interFaceCss,
  interGeneratedTs,
} from './lib/inter-font-subset.ts'

const woff2 = await buildInterSubset()
const out = new URL(
  '../packages/svg-renderer/src/generated/inter-font-subset.ts',
  import.meta.url,
)
await writeFile(out, interGeneratedTs(interFaceCss(woff2)), 'utf8')
console.log(`Wrote inter-font-subset.ts (${woff2.length} bytes woff2)`)
