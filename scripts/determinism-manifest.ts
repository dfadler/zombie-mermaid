/**
 * Renders every sample in packages/site/samples-data.ts to SVG and ASCII and
 * prints a hash manifest, one `<sha256-16> <kind> <index> <title>` line each (#1861).
 * `.github/workflows/determinism.yml` runs it per OS/Node and diffs the manifests.
 * A render that throws is hashed as `THROW:<message>` so a throw mismatch also shows.
 *
 * Usage: scripts/tsx-css.sh scripts/determinism-manifest.ts > manifest.txt
 */
import { createHash } from 'node:crypto'
import { renderMermaidASCII, renderMermaidSVG } from '../src/index.ts'
import { samples } from '../packages/site/samples-data.ts'

const hash = (s: string) =>
  createHash('sha256').update(s).digest('hex').slice(0, 16)
const attempt = (fn: () => string) => {
  try {
    return fn()
  } catch (e) {
    return `THROW:${e instanceof Error ? e.message : String(e)}`
  }
}

samples.forEach((s, i) => {
  const title = s.title.replace(/\s+/g, ' ')
  const svg = attempt(() => renderMermaidSVG(s.source))
  const ascii = attempt(() =>
    renderMermaidASCII(s.source, { colorMode: 'none' }),
  )
  console.log(`${hash(svg)} svg ${i} ${title}`)
  console.log(`${hash(ascii)} ascii ${i} ${title}`)
})
