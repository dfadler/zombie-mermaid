// ============================================================================
// Pie chart layout
//
// Turns a parsed PieChart into absolute SVG geometry, following Mermaid's own
// renderer (packages/mermaid/src/diagrams/pie/pieRenderer.ts, default config:
// textPosition 0.75, no donut hole, legend on the right):
//
//   - a 450 x 450 frame with a 40px margin, so the pie radius is 185 and its
//     centre sits at (225, 225); a 2px outline circle of radius 186 around it
//   - slices in source order, clockwise from 12 o'clock (d3.pie with
//     sort(null)); slices under 1% of the total are left out and the rest
//     share the full circle between them
//   - each drawn slice labelled with `toFixed(0)` of its share of the
//     *whole* total (omitted slices included), at 0.75 of the radius
//   - the title centred over the pie with its baseline 25px from the top
//   - a legend row for every slice, omitted ones included: an 18px swatch
//     and the label (or `label [value]` with showData), rows 22px apart,
//     vertically centred on the pie, starting 216px right of its centre
//   - width = pie + margin + swatch + gap + longest legend text, widened to
//     fit a title wider than that
//   - `pie.legendPosition` (left | right | top | bottom | center): left puts the
//     legend column left of the pie and shifts the pie right to make room; top
//     and bottom stack the legend above or below (the pie shifts down for top)
//     and make the frame taller; center draws it over the pie. The title stays
//     centred on the frame in every case, as in Mermaid.
//   - `pie.highlightSlice`: the named slice grows 5% about the pie centre and
//     is drawn fully opaque (`hover` has no static meaning and is ignored).
//
// Two places differ from Mermaid on purpose, both where Mermaid's output is
// broken rather than a style choice:
//   - A legend taller than the 450px frame (more than ~20 rows) grows the
//     viewBox instead of being clipped at the top and bottom.
//   - A legend wider than the frame (top, bottom or centre with a very long
//     label) grows the viewBox instead of being clipped at the sides.
//   - A chart with no slices keeps the pie's own width. Mermaid's width
//     formula takes Math.max() of an empty list there (-Infinity), which
//     leaves a viewBox that crops the circle in half.
//
// Lengths are kept from Mermaid as-is. Text widths come from this library's
// own metrics for its own font, not Mermaid's "trebuchet ms".
// ============================================================================

import type {
  PieChart,
  PositionedPieChart,
  PositionedPieLegendItem,
  PositionedPieSlice,
} from '@zombie-mermaid/mermaid-parser'
import { estimateTextWidth } from '../styles.ts'

/** Mermaid pieRenderer.ts constants (default config and default theme). */
export const PIE = {
  /** Frame height; the pie's own width equals it. */
  height: 450,
  margin: 40,
  legendRectSize: 18,
  legendSpacing: 4,
  /** `pie.textPosition` default: label distance as a fraction of the radius. */
  textPosition: 0.75,
  /** `pieOuterStrokeWidth`; the outline circle sits half of it outside the pie. */
  outerStrokeWidth: 2,
  /** `pieTitleTextSize` */
  titleFontSize: 25,
  /** `pieSectionTextSize` */
  sectionFontSize: 17,
  /** `pieLegendTextSize` */
  legendFontSize: 17,
  fontWeight: 400,
  /** Mermaid's `pie1`..`pie12` scale wraps after this many colours. */
  paletteSize: 12,
  /** `.highlighted { scale: 1.05 }` in Mermaid's pieStyles.ts. */
  highlightScale: 1.05,
  /** Slices below this percentage of the total are not drawn. */
  minPercent: 1,
} as const

const TAU = Math.PI * 2

/** Round to two decimals for compact path data. */
function r(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** Point on a circle, angle in radians clockwise from 12 o'clock (d3's convention). */
function polar(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): { x: number; y: number } {
  return { x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) }
}

/** Wedge path, or a full circle when the slice covers the whole pie. */
function slicePath(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
  inner = 0,
): string {
  if (end - start >= TAU - 1e-9) {
    const ring = (rad: number, sweep: 0 | 1) =>
      `M${r(cx)},${r(cy - rad)}` +
      `A${r(rad)},${r(rad)},0,1,${sweep},${r(cx)},${r(cy + rad)}` +
      `A${r(rad)},${r(rad)},0,1,${sweep},${r(cx)},${r(cy - rad)}`
    return ring(radius, 1) + (inner > 0 ? ring(inner, 0) : '') + 'Z'
  }
  const p0 = polar(cx, cy, radius, start)
  const p1 = polar(cx, cy, radius, end)
  const large = end - start > Math.PI ? 1 : 0
  const head =
    `M${r(p0.x)},${r(p0.y)}` +
    `A${r(radius)},${r(radius)},0,${large},1,${r(p1.x)},${r(p1.y)}`
  if (inner <= 0) return `${head}L${r(cx)},${r(cy)}Z`
  const q0 = polar(cx, cy, inner, end)
  const q1 = polar(cx, cy, inner, start)
  return (
    `${head}L${r(q0.x)},${r(q0.y)}` +
    `A${r(inner)},${r(inner)},0,${large},0,${r(q1.x)},${r(q1.y)}Z`
  )
}

/** Legend row text, as Mermaid builds it: `String(value)`, no number formatting. */
function legendText(label: string, value: number, showData: boolean): string {
  return showData ? `${label} [${String(value)}]` : label
}

/** Lay out a parsed pie chart. Options are accepted for registry parity; none apply. */
export function layoutPieChart(
  chart: PieChart,
  _options: unknown = {},
): PositionedPieChart {
  const height = PIE.height
  const pieWidth = height
  const radius = Math.min(pieWidth, height) / 2 - PIE.margin
  // Everything below is first computed in Mermaid's frame (pie centre at
  // (225, 225)), then shifted so the viewBox starts at (0, 0).
  const cx0 = pieWidth / 2
  const cy0 = height / 2

  const total = chart.slices.reduce((sum, s) => sum + s.value, 0)

  // createPieArcs(): keep slices at or above 1% of the total. A zero total
  // gives NaN here, which drops every slice, as in Mermaid. (Mermaid filters
  // a second time on `toFixed(0) !== '0'`, which nothing at or above 1% can
  // fail, so that step is not repeated.)
  const drawn = chart.slices
    .map((slice, index) => ({ slice, colorIndex: index % PIE.paletteSize }))
    .filter(({ slice }) => (slice.value / total) * 100 >= PIE.minPercent)
  // d3.pie() spreads the full circle over the slices it is given.
  const drawnTotal = drawn.reduce((sum, d) => sum + d.slice.value, 0)

  // Legend geometry. Mermaid positions the legend per `pie.legendPosition`;
  // with no legend rows there is nothing to place, so it is treated as 'right'.
  const rowHeight = PIE.legendRectSize + PIE.legendSpacing
  const rowCount = chart.slices.length
  const legendPosition =
    rowCount > 0 ? (chart.legendPosition ?? 'right') : 'right'
  const legendTexts = chart.slices.map((s) =>
    legendText(s.label, s.value, chart.showData),
  )
  const longestText = Math.max(
    0,
    ...legendTexts.map((t) =>
      estimateTextWidth(t, PIE.legendFontSize, PIE.fontWeight),
    ),
  )
  const swatchAndGap = PIE.legendRectSize + PIE.legendSpacing
  const legendBlockHeight = rowHeight * rowCount

  // Mermaid shifts the pie (not the title) for 'left' and 'top'.
  const pieShiftX = legendPosition === 'left' ? longestText + swatchAndGap : 0
  const pieShiftY = legendPosition === 'top' ? legendBlockHeight + rowHeight : 0
  // Legend rows in Mermaid's frame (title and legend are relative to
  // (cx0, cy0); only the pie moves with the shift).
  const centredX = cx0 - longestText / 2 - swatchAndGap
  const rowsTop = cy0 - legendBlockHeight / 2
  const legendOrigin = {
    right: { x: cx0 + 12 * PIE.legendRectSize, y: rowsTop },
    left: { x: cx0 - radius - swatchAndGap, y: rowsTop },
    center: { x: centredX, y: rowsTop },
    top: { x: centredX, y: cy0 - radius },
    bottom: { x: centredX, y: cy0 + radius + rowHeight },
  }[legendPosition]

  const sideWidth = swatchAndGap + longestText
  const chartAndLegendWidth =
    rowCount > 0 && (legendPosition === 'left' || legendPosition === 'right')
      ? pieWidth + PIE.margin + sideWidth
      : pieWidth + PIE.margin
  const chartAndLegendHeight =
    legendPosition === 'top' || legendPosition === 'bottom'
      ? height + legendBlockHeight
      : height

  const titleText = chart.title ?? ''
  const titleWidth =
    titleText.length > 0
      ? estimateTextWidth(titleText, PIE.titleFontSize, PIE.fontWeight)
      : 0
  const titleLeft = cx0 - titleWidth / 2
  const titleRight = cx0 + titleWidth / 2

  // Mermaid sizes the box from the pie, legend column and title only, so a
  // legend that sticks out (see the header) is clipped there; grow instead.
  const legendLeft = legendOrigin.x
  const legendRight = legendOrigin.x + sideWidth
  const legendTop = legendOrigin.y
  const legendBottom =
    legendOrigin.y + legendBlockHeight - rowHeight + PIE.legendRectSize
  const minX = Math.min(0, titleLeft, rowCount > 0 ? legendLeft : 0)
  const maxX = Math.max(
    chartAndLegendWidth,
    titleRight,
    rowCount > 0 ? legendRight : 0,
  )
  const minY = rowCount > 0 ? Math.min(0, legendTop) : 0
  const maxY =
    rowCount > 0 ? Math.max(chartAndLegendHeight, legendBottom) : height

  const dx = -minX
  const dy = -minY
  const cx = cx0 + pieShiftX + dx
  const cy = cy0 + pieShiftY + dy

  const slices: PositionedPieSlice[] = []
  let angle = 0
  // Mermaid: a hole only for 0 < donutHole <= 0.9; labels stay at textPosition.
  const hole = chart.donutHole ?? 0
  const innerRadius = hole > 0 && hole <= 0.9 ? hole * radius : 0
  const labelRadius = radius * (chart.textPosition ?? PIE.textPosition)
  for (const { slice, colorIndex } of drawn) {
    const start = angle
    const end = angle + (slice.value / drawnTotal) * TAU
    angle = end
    const label = polar(cx, cy, labelRadius, (start + end) / 2)
    // Mermaid's `.highlighted` is `scale: 1.05` about the pie centre plus full
    // opacity; `hover` only scales under a pointer, so it never applies here.
    const highlighted =
      chart.highlightSlice !== undefined &&
      chart.highlightSlice !== 'hover' &&
      chart.highlightSlice !== '' &&
      chart.highlightSlice === slice.label
    const grow = highlighted ? PIE.highlightScale : 1
    slices.push({
      label: slice.label,
      value: slice.value,
      colorIndex,
      startAngle: start,
      endAngle: end,
      path: slicePath(cx, cy, radius * grow, start, end, innerRadius * grow),
      percentText: `${((slice.value / total) * 100).toFixed(0)}%`,
      labelX: label.x,
      labelY: label.y,
      ...(highlighted ? { highlighted } : {}),
    })
  }

  const legend: PositionedPieLegendItem[] = legendTexts.map((text, index) => {
    const x = legendOrigin.x + dx
    const y = legendOrigin.y + index * rowHeight + dy
    return {
      text,
      colorIndex: index % PIE.paletteSize,
      x,
      y,
      size: PIE.legendRectSize,
      textX: x + PIE.legendRectSize + PIE.legendSpacing,
      textY: y + PIE.legendRectSize - PIE.legendSpacing,
    }
  })

  return {
    width: Math.ceil(maxX - minX),
    height: Math.ceil(maxY - minY),
    cx,
    cy,
    radius,
    outerRadius: radius + PIE.outerStrokeWidth / 2,
    title:
      titleText.length > 0
        ? { text: titleText, x: cx0 + dx, y: cy0 + dy - (height - 50) / 2 }
        : undefined,
    slices,
    legend,
    accTitle: chart.accTitle,
    accDescr: chart.accDescr,
    sliceColors: chart.sliceColors,
  }
}
