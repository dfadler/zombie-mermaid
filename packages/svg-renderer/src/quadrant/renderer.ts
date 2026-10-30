// ============================================================================
// Quadrant chart SVG renderer
//
// Draws a PositionedQuadrantChart (see ./layout.ts) in Mermaid's structure and
// paint order: quadrant fills and labels, border lines, points, axis labels,
// title. Styling follows Mermaid's default theme, mapped onto this library's
// CSS custom properties so every theme (and live theme switching through
// `--bg`/`--fg`/`--accent`) applies:
//
//   Mermaid                         here
//   quadrant1Fill..quadrant4Fill    the theme accent mixed into --bg at four
//                                   falling strengths (Mermaid steps its
//                                   primaryColor toward white the same way)
//   border strokes                  the accent mixed 35% into --bg
//   title / label / point text      var(--_text)
//   point fill and stroke           var(--fg), see below
//
// One deliberate difference: Mermaid 12.2.0's default theme emits
// `fill="hsl(240, 100%, NaN%)"` for every point without a `color`, which
// browsers discard, so GitHub and mermaid.live show near-black dots. They get
// `var(--fg)` here, which is the same dot under a light theme and stays
// visible under a dark one. A point's own `color` / `stroke-color` /
// `stroke-width` (or its class's) are drawn as written.
//
// There is no hover or interactivity: Mermaid has none for this type.
// ============================================================================

import type { PositionedQuadrantChart } from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { CHART_ACCENT_FALLBACK } from '@zombie-mermaid/mermaid-parser'
import { withDataSrc } from '../renderer.ts'

function r(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** Accent share of each quadrant fill, quadrant 1 first (Mermaid: darkest first). */
const FILL_MIX = [14, 10, 6, 3] as const

function quadrantStyles(
  chart: PositionedQuadrantChart,
  nonce?: string,
): string {
  const accent = `var(--accent, ${CHART_ACCENT_FALLBACK})`
  const border = `color-mix(in srgb, ${accent} 35%, var(--bg))`
  const fills = FILL_MIX.map(
    (n, i) =>
      `  .quadrant-cell-${i} { fill: color-mix(in srgb, ${accent} ${n}%, var(--bg)); }`,
  )
  // A custom colour has to be a CSS rule: a class rule beats a `fill`
  // attribute, and an inline `style` attribute would need `style-src 'unsafe-inline'`.
  const custom = chart.points.flatMap((p, i) => {
    const decl = [
      p.color && `fill: ${p.color};`,
      p.strokeColor && `stroke: ${p.strokeColor};`,
      p.strokeWidth !== '0px' && `stroke-width: ${p.strokeWidth};`,
    ].filter(Boolean)
    return decl.length > 0
      ? [`  .quadrant-point-${i} { ${decl.join(' ')} }`]
      : []
  })
  // `quadrant*` theme variables (honoured only when the caller opted in; the
  // layout drops them otherwise). Colours were validated in core. Axis labels
  // are told apart by rotation, so the markup stays as it was without them.
  const t = chart.themeColors ?? {}
  const themed = [
    ...[1, 2, 3, 4].flatMap((n) => [
      t[`quadrant${n}Fill` as 'quadrant1Fill'] &&
        `  .quadrant-cell-${n - 1} { fill: ${t[`quadrant${n}Fill` as 'quadrant1Fill']}; }`,
      t[`quadrant${n}TextFill` as 'quadrant1TextFill'] &&
        `  .quadrant:nth-child(${n}) .quadrant-label { fill: ${t[`quadrant${n}TextFill` as 'quadrant1TextFill']}; }`,
    ]),
    t.quadrantPointFill &&
      `  .quadrant-point { fill: ${t.quadrantPointFill}; stroke: ${t.quadrantPointFill}; }`,
    t.quadrantPointTextFill &&
      `  .quadrant-point-label { fill: ${t.quadrantPointTextFill}; }`,
    t.quadrantXAxisTextFill &&
      `  .quadrant-axis-label[transform$="rotate(0)"] { fill: ${t.quadrantXAxisTextFill}; }`,
    t.quadrantYAxisTextFill &&
      `  .quadrant-axis-label[transform$="rotate(-90)"] { fill: ${t.quadrantYAxisTextFill}; }`,
    t.quadrantTitleFill &&
      `  .quadrant-title { fill: ${t.quadrantTitleFill}; }`,
    t.quadrantInternalBorderStrokeFill &&
      `  .quadrant-line-internal { stroke: ${t.quadrantInternalBorderStrokeFill}; }`,
    t.quadrantExternalBorderStrokeFill &&
      `  .quadrant-line-external { stroke: ${t.quadrantExternalBorderStrokeFill}; }`,
  ].filter(Boolean)
  return `${styleOpenTag(nonce)}
${fills.join('\n')}
  .quadrant-line { stroke: ${border}; }
  .quadrant-text { fill: var(--_text); }
  .quadrant-point { fill: var(--fg); stroke: var(--fg); stroke-width: 0px; }${[...themed, ...custom].map((r) => '\n' + r).join('')}
</style>`
}

function textEl(
  t: PositionedQuadrantChart['axisLabels'][number],
  cls: string,
): string {
  // Mermaid draws empty quadrant labels as empty <text>; nothing to say here.
  if (!t.text) return ''
  return (
    `<text x="0" y="0" class="quadrant-text ${cls}" font-size="${t.fontSize}"` +
    ` dominant-baseline="${t.baseline}" text-anchor="${t.anchor}"` +
    ` transform="translate(${r(t.x)}, ${r(t.y)}) rotate(${t.rotation})">${escapeXml(t.text)}</text>`
  )
}

/**
 * Render a positioned quadrant chart as an SVG string.
 *
 * The accessible name is `title` (from `options.title`, or the chart's own
 * `accTitle` via the front door), as for every type but C4: the visible
 * `title` is not used. It is dropped when `decorative` is set — see svgOpenTag() in
 * packages/core/src/theme.ts.
 */
export function renderQuadrantSvg(
  chart: PositionedQuadrantChart,
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
        title,
        decorative,
        undefined,
        emit.styleAttribute,
        emit.description,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, false, emit.nonce, emit.bodyFont))
  parts.push(quadrantStyles(chart, emit.nonce))

  parts.push('<g class="quadrants">')
  for (const q of chart.quadrants) {
    parts.push(
      `<g class="quadrant"><rect x="${r(q.x)}" y="${r(q.y)}" width="${r(q.width)}" height="${r(q.height)}" class="quadrant-cell-${q.index}"/>` +
        `${textEl(q.text, 'quadrant-label')}</g>`,
    )
  }
  parts.push('</g>')

  parts.push('<g class="border">')
  for (const l of chart.lines) {
    parts.push(
      `<line x1="${r(l.x1)}" y1="${r(l.y1)}" x2="${r(l.x2)}" y2="${r(l.y2)}" stroke-width="${l.strokeWidth}" class="quadrant-line quadrant-line-${l.kind}"/>`,
    )
  }
  parts.push('</g>')

  parts.push('<g class="data-points">')
  chart.points.forEach((p, i) => {
    const custom =
      p.color || p.strokeColor || p.strokeWidth !== '0px'
        ? ` quadrant-point-${i}`
        : ''
    parts.push(
      `<g class="data-point"><circle cx="${r(p.x)}" cy="${r(p.y)}" r="${p.radius}" class="quadrant-point${custom}"/>` +
        `${textEl(p.text, 'quadrant-point-label')}</g>`,
    )
  })
  parts.push('</g>')

  parts.push('<g class="labels">')
  for (const a of chart.axisLabels) {
    parts.push(`<g class="label">${textEl(a, 'quadrant-axis-label')}</g>`)
  }
  parts.push('</g>')

  parts.push('<g class="title">')
  if (chart.title) parts.push(textEl(chart.title, 'quadrant-title'))
  parts.push('</g>')

  parts.push('</svg>')
  return parts.join('\n')
}
