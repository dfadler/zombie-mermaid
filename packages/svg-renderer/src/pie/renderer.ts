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
//   pie1..pie12                     --pie-color-0..11: Mermaid's default-theme
//                                   scale; on a dark background the theme
//                                   accent, then getSeriesColor() shades of it
//   slice opacity 0.7               opacity: 0.7 (on fill and stroke, as there)
//   pieStrokeColor black, 2px       var(--fg), 2px
//   pieOuterStrokeColor black, 2px  var(--fg), 2px
//   title 25px, legend/labels 17px  same sizes, regular weight
//   text colours (black / #333)     var(--_text)
//
// The legend swatch is filled and stroked with the slice colour at full
// opacity, as in Mermaid. There are no tooltips or hover effects: Mermaid
// draws none by default (`highlightSlice` is off), so `interactivity` does
// not change the output. A `highlightSlice` label draws that slice 5% larger
// (in its path) and at full opacity, as Mermaid's `.highlighted` does.
// ============================================================================

import type { PositionedPieChart } from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  paletteClass,
  withRootClass,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
  escapeAttr,
} from '@zombie-mermaid/core'
import {
  getSeriesColor,
  CHART_ACCENT_FALLBACK,
  isValidHex,
  isDarkBackground,
} from '@zombie-mermaid/mermaid-parser'
import { withDataSrc } from '../renderer.ts'
import { PIE, PIE_FONT_STACK } from './layout.ts'

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

/**
 * Mermaid 12.3.0's default-theme `pie1`..`pie12` (measured with
 * scripts/lib/real-mermaid.ts, #2855), wrapping after 12 as its ordinal scale does.
 */
export const MERMAID_PIE_COLORS = [
  '#ECECFF',
  '#ffffde',
  'hsl(80, 100%, 56.2745098039%)',
  'hsl(240, 100%, 86.2745098039%)',
  'hsl(60, 100%, 63.5294117647%)',
  'hsl(80, 100%, 76.2745098039%)',
  'hsl(300, 100%, 76.2745098039%)',
  'hsl(180, 100%, 56.2745098039%)',
  'hsl(0, 100%, 56.2745098039%)',
  'hsl(300, 100%, 56.2745098039%)',
  'hsl(150, 100%, 56.2745098039%)',
  'hsl(0, 100%, 66.2745098039%)',
] as const

/**
 * Slice colour for slot `index`: Mermaid's scale, except on a dark hex
 * background where its pastels at 0.7 opacity wash out, so the theme-derived
 * scale stays (the theme-aware option #2855 asks to keep).
 */
function pieSliceColor(index: number, colors: DiagramColors): string {
  if (!(isValidHex(colors.bg) && isDarkBackground(colors.bg)))
    return MERMAID_PIE_COLORS[index % MERMAID_PIE_COLORS.length]!
  return pieColorValue(index, colors.accent, colors.bg)
}

function pieStyles(
  chart: PositionedPieChart,
  colors: DiagramColors,
  nonce?: string,
  fontStack?: string,
): { css: string; cls: string } {
  const used = new Set<number>()
  for (const s of chart.slices) used.add(s.colorIndex)
  for (const l of chart.legend) used.add(l.colorIndex)
  const indices = [...used].sort((a, b) => a - b)

  const vars = indices.map(
    (i) =>
      `    --pie-color-${i}: ${chart.sliceColors?.[i] ?? pieSliceColor(i, colors)};`,
  )
  const rules = indices.map(
    (i) =>
      `  .pie-color-${i} { fill: var(--pie-color-${i}); }\n` +
      `  rect.pie-color-${i} { stroke: var(--pie-color-${i}); }`,
  )
  // Mermaid's `.pieCircle.highlighted`: full opacity (the 5% growth is in the path).
  const highlightRule = chart.slices.some((s) => s.highlighted)
    ? '\n  .pie-slice.pie-highlight { opacity: 1; }'
    : ''
  const cls = paletteClass(vars)
  const varsBlock =
    vars.length > 0 ? `\n  .${cls} {\n${vars.join('\n')}\n  }` : ''

  // Mermaid's default font applies to the chart's text only; an explicit
  // `font` keeps the shared `text` rule.
  const family = fontStack ? ` font-family: ${fontStack};` : ''
  const css = `${styleOpenTag(nonce)}
  .pie-outer { fill: none; stroke: var(--fg); stroke-width: ${PIE.outerStrokeWidth}px; }
  .pie-slice { stroke: var(--fg); stroke-width: 2px; opacity: 0.7; }${highlightRule}
  .pie-slice-label { fill: var(--_text);${family} font-size: ${PIE.sectionFontSize}px; font-weight: ${PIE.fontWeight}; }
  .pie-title { fill: var(--_text);${family} font-size: ${PIE.titleFontSize}px; font-weight: ${PIE.fontWeight}; }
  .pie-legend-text { fill: var(--_text);${family} font-size: ${PIE.legendFontSize}px; font-weight: ${PIE.fontWeight}; }${varsBlock}
${rules.join('\n')}
</style>`
  return { css, cls }
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
  font?: string,
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []
  const { css, cls } = pieStyles(
    chart,
    colors,
    emit.nonce,
    font === undefined ? PIE_FONT_STACK : undefined,
  )

  parts.push(
    withDataSrc(
      withRootClass(
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
        cls,
      ),
      embedSource,
    ),
  )
  parts.push(
    buildStyleBlock(font ?? 'sans-serif', false, emit.nonce, emit.bodyFont),
  )
  parts.push(css)

  parts.push(
    `<circle cx="${r(chart.cx)}" cy="${r(chart.cy)}" r="${r(chart.outerRadius)}" class="pie-outer"/>`,
  )

  for (const s of chart.slices) {
    parts.push(
      `<path d="${s.path}" class="pie-slice${s.highlighted ? ' pie-highlight' : ''} pie-color-${s.colorIndex}"` +
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
