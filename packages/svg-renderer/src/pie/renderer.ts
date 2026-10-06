// ============================================================================
// Pie chart SVG renderer
//
// Draws a PositionedPieChart (see ./layout.ts) in Mermaid's own structure and
// paint order: outline circle, slices, percentage labels, title, legend.
//
// Styling follows Mermaid's pieStyles.ts and default theme, mapped onto this
// library's CSS custom properties so every theme (and live theme switching
// through `--bg`/`--fg`/`--accent`) applies:
//
//   Mermaid                         here
//   pie1..pie12                     --pie-color-0..11: the theme accent, then
//                                   getSeriesColor() shades of it (the same
//                                   palette xychart series use)
//   slice opacity 0.7               opacity: 0.7 (on fill and stroke, as there)
//   pieStrokeColor black, 2px       var(--fg), 2px
//   pieOuterStrokeColor black, 2px  var(--fg), 2px
//   title 25px, legend/labels 17px  same sizes, regular weight
//   text colours (black / #333)     var(--_text)
//
// The legend swatch is filled and stroked with the slice colour at full
// opacity, as in Mermaid. There are no tooltips or hover effects: Mermaid
// draws none by default (`highlightSlice` is off), so `interactivity` does
// not change the output.
// ============================================================================

import type { PositionedPieChart } from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
  escapeAttr,
} from '@zombie-mermaid/core'
import {
  getSeriesColor,
  CHART_ACCENT_FALLBACK,
} from '@zombie-mermaid/mermaid-parser'
import { withDataSrc } from '../renderer.ts'
import { PIE } from './layout.ts'

function r(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** CSS value for palette slot `index`: slot 0 follows `--accent` live. */
export function pieColorValue(
  index: number,
  accent: string | undefined,
  bg: string,
): string {
  if (index === 0) return `var(--accent, ${CHART_ACCENT_FALLBACK})`
  return getSeriesColor(index, accent ?? CHART_ACCENT_FALLBACK, bg)
}

function pieStyles(
  chart: PositionedPieChart,
  colors: DiagramColors,
  nonce?: string,
): string {
  const used = new Set<number>()
  for (const s of chart.slices) used.add(s.colorIndex)
  for (const l of chart.legend) used.add(l.colorIndex)
  const indices = [...used].sort((a, b) => a - b)

  const vars = indices.map(
    (i) =>
      `    --pie-color-${i}: ${pieColorValue(i, colors.accent, colors.bg)};`,
  )
  const rules = indices.map(
    (i) =>
      `  .pie-color-${i} { fill: var(--pie-color-${i}); }\n` +
      `  rect.pie-color-${i} { stroke: var(--pie-color-${i}); }`,
  )
  const varsBlock = vars.length > 0 ? `\n  svg {\n${vars.join('\n')}\n  }` : ''

  return `${styleOpenTag(nonce)}
  .pie-outer { fill: none; stroke: var(--fg); stroke-width: ${PIE.outerStrokeWidth}px; }
  .pie-slice { stroke: var(--fg); stroke-width: 2px; opacity: 0.7; }
  .pie-slice-label { fill: var(--_text); font-size: ${PIE.sectionFontSize}px; font-weight: ${PIE.fontWeight}; }
  .pie-title { fill: var(--_text); font-size: ${PIE.titleFontSize}px; font-weight: ${PIE.fontWeight}; }
  .pie-legend-text { fill: var(--_text); font-size: ${PIE.legendFontSize}px; font-weight: ${PIE.fontWeight}; }${varsBlock}
${rules.join('\n')}
</style>`
}

/**
 * Render a positioned pie chart as an SVG string.
 *
 * The accessible name is `title` (from `options.title`) when given,
 * otherwise the chart's own `accTitle`; `accDescr` becomes the root
 * `<desc>`. Both are dropped when `decorative` is set — see svgOpenTag() in
 * packages/core/src/theme.ts.
 */
export function renderPieSvg(
  chart: PositionedPieChart,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []

  parts.push(
    withDataSrc(
      svgOpenTag(
        chart.width,
        chart.height,
        colors,
        transparent,
        title ?? chart.accTitle,
        decorative,
        undefined,
        emit.styleAttribute,
        chart.accDescr,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, false, emit.nonce))
  parts.push(pieStyles(chart, colors, emit.nonce))

  parts.push(
    `<circle cx="${r(chart.cx)}" cy="${r(chart.cy)}" r="${r(chart.outerRadius)}" class="pie-outer"/>`,
  )

  for (const s of chart.slices) {
    parts.push(
      `<path d="${s.path}" class="pie-slice pie-color-${s.colorIndex}"` +
        ` data-label="${escapeAttr(s.label)}" data-value="${s.value}"/>`,
    )
  }

  for (const s of chart.slices) {
    parts.push(
      `<text x="${r(s.labelX)}" y="${r(s.labelY)}" text-anchor="middle" class="pie-slice-label">${escapeXml(s.percentText)}</text>`,
    )
  }

  if (chart.title) {
    parts.push(
      `<text x="${r(chart.title.x)}" y="${r(chart.title.y)}" text-anchor="middle" class="pie-title">${escapeXml(chart.title.text)}</text>`,
    )
  }

  for (const item of chart.legend) {
    parts.push(
      `<g class="pie-legend">` +
        `<rect x="${r(item.x)}" y="${r(item.y)}" width="${item.size}" height="${item.size}" class="pie-legend-swatch pie-color-${item.colorIndex}"/>` +
        `<text x="${r(item.textX)}" y="${r(item.textY)}" class="pie-legend-text">${escapeXml(item.text)}</text>` +
        `</g>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}
