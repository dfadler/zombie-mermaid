/**
 * Lists gallery samples missing a visual baseline (#1562): every non-Hero
 * samples-data.ts sample needs an SVG and an ASCII screenshot, and every
 * xychart sample an SVG one, on both darwin and linux. Name scheme mirrors
 * svg-samples/ascii-samples.visual.test.ts.
 *
 * Usage: tsx scripts/check-visual-baselines.ts   (exit 1 if any are missing)
 */
import { existsSync } from 'node:fs'
import { samples } from '../packages/site/samples-data.ts'
import { xychartSamples } from '../packages/site/xychart-samples-data.ts'

const slug = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
const dir = new URL('../__tests__/visual/__screenshots__/', import.meta.url)

const expected: string[] = []
const add = (file: string, name: string) => {
  for (const os of ['darwin', 'linux'])
    expected.push(`${file}/${name}-chromium-${os}.png`)
}
for (const [i, s] of samples.entries()) {
  if (s.category === 'Hero') continue
  const name = `general-${i}-${slug(s.category ?? 'uncategorized')}-${slug(s.title)}`
  add('svg-samples.visual.test.ts', name)
  add('ascii-samples.visual.test.ts', name)
}
for (const [i, s] of xychartSamples.entries())
  add(
    'svg-samples.visual.test.ts',
    `xychart-${i}-${slug(s.category ?? 'uncategorized')}-${slug(s.title)}`,
  )

const missing = expected.filter((p) => !existsSync(new URL(p, dir)))
for (const m of missing) console.log(`missing: ${m}`)
console.log(
  `${expected.length - missing.length}/${expected.length} baselines present`,
)
process.exit(missing.length ? 1 : 0)
