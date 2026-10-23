/**
 * Regenerates packages/elk-layout/src/font-advances.json: per-character advances (printable
 * ASCII) of mermaid's label font as this machine's Chromium resolves it. The table is
 * machine-specific (installed fonts decide what "trebuchet ms" falls back to), so the committed
 * one is the macOS Trebuchet MS table; after regenerating, run `pnpm run elk-layout:oracle` and
 * `UPDATE_ELK_LAYOUT=1` the unit-test fixtures. Needs Chromium.
 */
import { writeFileSync } from 'node:fs'
import { startRealMermaid } from './lib/real-mermaid.ts'

const s = await startRealMermaid()
const adv = await s.page.evaluate(() => {
  const c = document.createElement('canvas').getContext('2d')!
  c.font = '16px "trebuchet ms", verdana, arial, sans-serif'
  const out: Record<string, number> = {}
  for (let i = 32; i < 127; i++)
    out[String.fromCharCode(i)] = c.measureText(String.fromCharCode(i)).width
  return out
})
await s.close()
writeFileSync(
  new URL('../packages/elk-layout/src/font-advances.json', import.meta.url),
  JSON.stringify(adv) + '\n',
)
console.log(
  `wrote ${Object.keys(adv).length} advances; "yes" = ${adv.y! + adv.e! + adv.s!}`,
)
