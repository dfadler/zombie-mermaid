// ============================================================================
// Radar SVG renderer
//
// Draws a PositionedRadar (see ./layout.ts) in Mermaid's structure: one `<g>`
// translated to the centre holding the graticule rings, then for each axis its
// spoke and label, the curves, the legend and the title. The class names are
// Mermaid's (`radarGraticule`, `radarAxisLine`, `radarAxisLabel`,
// `radarCurve-N`, `radarLegendBox-N`, `radarLegendText`, `radarTitle`).
// Styling follows Mermaid's default theme, mapped onto this library's CSS
// custom properties so every theme (and live theme switching through
// `--bg`/`--fg`/`--accent`) applies:
//
//   Mermaid                         here
//   cScale0..11 curve colours       --radar-color-0..11: the theme accent,
//                                   then getSeriesColor() shades of it (as pie
//                                   does)
//   axis / label colour             var(--fg) / var(--_text)
//   graticule #DEDEDE at 0.3        var(--_line) at 0.3
//
// There is no hover or interactivity: Mermaid has none for this type.
// ============================================================================

import type { PositionedRadar } from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  paletteClass,
  withRootClass,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { pieColorValue } from '../pie/renderer.ts'

/** Mermaid's `curveOpacity` and `curveStrokeWidth` theme defaults. */
const CURVE_OPACITY = 0.5

function radarStyles(
  radar: PositionedRadar,
  colors: DiagramColors,
  nonce?: string,
): { css: string; cls: string } {
  const used = [
    ...new Set([
      ...radar.curves.map((c) => c.index),
      ...radar.legend.map((l) => l.index),
    ]),
  ].sort((a, b) => a - b)
  const vars = used.map(
    (i) =>
      `    --radar-color-${i}: ${pieColorValue(i, colors.accent, colors.bg)};`,
  )
  const rules = used.map(
    (i) =>
      `  .radarCurve-${i} { fill: var(--radar-color-${i}); fill-opacity: ${CURVE_OPACITY}; stroke: var(--radar-color-${i}); stroke-width: 2; }\n` +
      `  .radarLegendBox-${i} { fill: var(--radar-color-${i}); fill-opacity: ${CURVE_OPACITY}; stroke: var(--radar-color-${i}); }`,
  )
  const cls = paletteClass(vars)
  const css = `${styleOpenTag(nonce)}
  .radarTitle { fill: var(--_text); font-size: 16px; dominant-baseline: hanging; text-anchor: middle; }
  .radarAxisLine { stroke: var(--fg); stroke-width: 2; }
  .radarAxisLabel { fill: var(--_text); font-size: 12px; }
  .radarGraticule { fill: var(--_line); fill-opacity: 0.3; stroke: var(--_line); stroke-width: 1; }
  .radarLegendText { fill: var(--_text); text-anchor: start; font-size: 12px; dominant-baseline: hanging; }${
    vars.length > 0 ? `\n  .${cls} {\n${vars.join('\n')}\n  }` : ''
  }
${rules.join('\n')}
</style>`
  return { css, cls }
}

/** Numbers as Mermaid writes them, minus the float noise: no `-0`, at most 2 decimals. */
function n(v: number): string {
  const s = String(Math.round(v * 100) / 100)
  return s === '-0' ? '0' : s
}

const pts = (points: Array<{ x: number; y: number }>): string =>
  points.map((p) => `${n(p.x)},${n(p.y)}`).join(' ')

/**
 * Render a positioned radar as an SVG string.
 *
 * The accessible name is `title` (from `options.title`, or the diagram's own
 * `accTitle` via the front door), as for every type but C4: the visible
 * `title` is not used. It is dropped when `decorative` is set — see svgOpenTag() in
 * packages/core/src/theme.ts.
 */
export function renderRadarSvg(
  radar: PositionedRadar,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []
  const { css, cls } = radarStyles(radar, colors, emit.nonce)
  parts.push(
    withDataSrc(
      withRootClass(
        svgOpenTag(
          radar.width,
          radar.height,
          colors,
          transparent,
          title,
          decorative,
          undefined,
          emit.styleAttribute,
          emit.description,
        ),
        cls,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, false, emit.nonce, emit.bodyFont))
  parts.push(css)
  parts.push(
    `<g transform="translate(${n(radar.centerX)}, ${n(radar.centerY)})">`,
  )

  for (const ring of radar.rings) {
    parts.push(
      ring.kind === 'circle'
        ? `<circle r="${n(ring.r)}" class="radarGraticule"/>`
        : `<polygon points="${pts(ring.points)}" class="radarGraticule"/>`,
    )
  }
  for (const a of radar.axes) {
    parts.push(
      `<line x1="0" y1="0" x2="${n(a.x2)}" y2="${n(a.y2)}" class="radarAxisLine"/>`,
      `<text x="${n(a.labelX)}" y="${n(a.labelY)}" text-anchor="${a.anchor}" dominant-baseline="${a.baseline}" class="radarAxisLabel">${escapeXml(a.label)}</text>`,
    )
  }
  for (const c of radar.curves) {
    parts.push(
      c.kind === 'path'
        ? `<path d="${c.d}" class="radarCurve-${c.index}"/>`
        : `<polygon points="${pts(c.points ?? [])}" class="radarCurve-${c.index}"/>`,
    )
  }
  for (const l of radar.legend) {
    parts.push(
      `<g transform="translate(${n(l.x)}, ${n(l.y)})">` +
        `<rect width="12" height="12" class="radarLegendBox-${l.index}"/>` +
        `<text x="16" y="0" class="radarLegendText">${escapeXml(l.label)}</text></g>`,
    )
  }
  parts.push(
    `<text class="radarTitle" x="${n(radar.title.x)}" y="${n(radar.title.y)}">${escapeXml(radar.title.text)}</text>`,
    '</g>',
    '</svg>',
  )
  return parts.join('\n')
}
