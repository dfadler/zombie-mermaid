/**
 * Renders every sample in packages/site/samples-data.ts to SVG and ASCII and
 * prints a hash manifest, one `<sha256-16> <kind> <index> <title>` line each (#1861).
 * `.github/workflows/determinism.yml` runs it per OS/Node and diffs the manifests.
 * Logic lives in scripts/lib/determinism-manifest.ts (tested).
 *
 * Usage: scripts/tsx-css.sh scripts/determinism-manifest.ts > manifest.txt
 */
import { renderMermaidASCII, renderMermaidSVG } from '../src/index.ts'
import { samples } from '../packages/site/samples-data.ts'
import { manifestLines } from './lib/determinism-manifest.ts'

const lines = manifestLines(
  samples,
  (src) => renderMermaidSVG(src),
  (src) => renderMermaidASCII(src, { colorMode: 'none' }),
)
for (const line of lines) console.log(line)
