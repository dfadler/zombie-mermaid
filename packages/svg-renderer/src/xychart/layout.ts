import type {
  XYChart,
  PositionedXYChart,
  PositionedAxis,
  AxisTick,
  PositionedBar,
  PositionedLine,
  GridLine,
  PlotArea,
  LegendItem,
} from '@zombie-mermaid/mermaid-parser'
import { niceTickValues } from '@zombie-mermaid/core'
import type { XyChartRenderOptions } from '@zombie-mermaid/core'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// XY Chart layout engine
//
// Computes pixel coordinates for all chart elements. No dagre needed —
// direct coordinate-space mapping for axes, bars, lines, and grid.
// ============================================================================

/** Layout constants — aligned with Chart.js default proportions */
const XY = {
  plotWidth: 600,
  plotHeight: 340,
  padding: 22,
  titleFontSize: 18,
  titleFontWeight: 600,
  titleHeight: 42,
  axisLabelFontSize: 14,
  // Height mermaid 12.2.0 measures for a 14px axis label; half of it is the
  // value axis' outer padding.
  axisLabelHeight: 16,
  axisLabelFontWeight: 400,
  axisTitleFontSize: 15,
  axisTitleFontWeight: 500,
  xLabelHeight: 38,
  yLabelWidth: 58,
  yLabelGap: 18,
  axisTitlePad: 30,
  tickLength: 4,
  legendFontSize: 14,
  legendFontWeight: 400,
  legendHeight: 28,
  legendSwatchW: 14,
  legendSwatchH: 14,
  legendGap: 6,
  legendItemGap: 16,
} as const

/**
 * Mermaid measures axis labels in its own font, about 0.8 of our estimate
 * (6 digits at 14px: 44px against 55px), and sizes padding and bars from it.
 */
const MERMAID_TEXT_SCALE = 0.8

/**
 * Bar thickness following mermaid 12.2.0's band axis (xychartDiagram
 * `BaseAxis`/`BarPlot`): the axis reserves an outer padding of at least half
 * the widest label (capped at 20% of the extent), widened to 35% of the tick
 * distance when bars need the room, and a bar is 95% of the smaller of twice
 * that padding and the tick distance. Mermaid then spaces bars by the label
 * pitch `inner / (n - 1)`; ours are `extent / n` apart, so the result is
 * rescaled to keep the bar the same share of the spacing (#2515).
 * `labelHalf` is half the widest label along the axis.
 */
function barThickness(extent: number, n: number, labelHalf: number): number {
  const { pad, bar } = barPad(extent, n, labelHalf)
  return n < 2 ? bar : (bar * (extent / n) * (n - 1)) / (extent - 2 * pad)
}

/** Outer padding of a mermaid axis drawing bars, and the bar thickness it gives (`n` ticks). */
function barPad(extent: number, n: number, labelHalf: number) {
  const p0 = Math.min(labelHalf, 0.2 * extent)
  const tick0 = (extent - 2 * p0) / n
  const pad = 0.7 * tick0 > 2 * p0 ? Math.floor(0.35 * tick0) : p0
  return { p0, pad, bar: 0.95 * Math.min(2 * pad, (extent - 2 * pad) / n) }
}

/**
 * The value axis' range and outer padding as mermaid 12.2.0 has them (`LinearAxis`
 * over the raw data extent, `BaseAxis` padding of half the widest label along
 * the axis, capped at 20% of the extent): the lowest tick sits `pad` inside the
 * axis line, so the smallest bar and the lowest line point stay visible. A flat
 * series, which the parser gives a synthetic +-0.1 span, is a single tick at
 * the middle of the axis, as in mermaid.
 */
function valueAxis(
  chart: XYChart,
  extent: number,
  labelSize: (labels: string[]) => number,
) {
  const { min, max } = chart.yAxis.range!
  const all = chart.series.flatMap((s) => s.data)
  const v = all[0]
  const flat =
    v !== undefined &&
    all.every((d) => d === v) &&
    min === v - 0.1 &&
    max === v + 0.1
  // Ceiling: an explicit `y-axis v-0.1 --> v+0.1` over flat data collapses too; the parser would need to flag its synthetic range to tell them apart.
  const range = flat ? { min: v, max: v } : { min, max }
  const ticks = niceTickValues(range.min, range.max)
  const labels = formatTickLabels(ticks)
  const pad = Math.min(labelSize(labels) / 2, 0.2 * extent)
  const span = range.max - range.min
  const frac = (x: number) => (span > 0 ? (x - range.min) / span : 0.5)
  return { range, ticks, labels, pad, frac }
}

/**
 * The category axis: where each data point and tick sits (offsets from the
 * axis start, in pixels) and how thick a bar is. Categories, and data with no
 * x-axis, sit on band centres. A numeric range is mermaid's linear axis
 * (#1592): a tick at every d3 tick value of the range, points spread evenly
 * over [min, max] and placed by value, inset by the outer padding. Horizontal
 * charts run the range from the bottom up, as mermaid does.
 */
interface CatAxis {
  /** Offset of point `i` of a series with `n` points. */
  at(n: number, i: number): number
  ticks: { label: string; at: number }[]
  /** Bar thickness. */
  bar: number
}

function buildCatAxis(
  chart: XYChart,
  extent: number,
  horizontal: boolean,
): CatAxis {
  const range = chart.xAxis.categories ? undefined : chart.xAxis.range
  const half = (labels: string[]) =>
    horizontal
      ? XY.axisLabelFontSize / 2
      : (MERMAID_TEXT_SCALE *
          Math.max(
            ...labels.map((l) =>
              estimateTextWidth(
                l,
                XY.axisLabelFontSize,
                XY.axisLabelFontWeight,
              ),
            ),
          )) /
        2
  if (!range) {
    const n = getDataCount(chart)
    const labels = getCategoryLabels(chart, n)
    const at = (i: number) => (i + 0.5) * (extent / n)
    return {
      at: (_n, i) => at(i),
      ticks: labels.map((label, i) => ({
        label,
        at: at(i),
      })),
      bar: barThickness(extent, n, half(labels)),
    }
  }
  const values = niceTickValues(range.min, range.max)
  const labels = formatTickLabels(values)
  const { p0, pad, bar } = barPad(extent, values.length, half(labels))
  const p = chart.series.some((s) => s.type === 'bar') ? pad : p0
  const span = range.max - range.min
  const place = (v: number) => {
    const t = span > 0 ? (v - range.min) / span : 0.5
    return p + (horizontal ? 1 - t : t) * (extent - 2 * p)
  }
  return {
    at: (n, i) => place(n < 2 ? range.min : range.min + (i * span) / (n - 1)),
    ticks: values.map((v, i) => ({ label: labels[i]!, at: place(v) })),
    bar,
  }
}

/**
 * Lay out a parsed XY chart by computing pixel coordinates.
 */
export function layoutXYChart(
  chart: XYChart,
  _options: XyChartRenderOptions = {},
): PositionedXYChart {
  if (chart.horizontal) return layoutHorizontal(chart)
  return layoutVertical(chart)
}

// ============================================================================
// Vertical layout (default)
// ============================================================================

function layoutVertical(chart: XYChart): PositionedXYChart {
  const hasTitle = !!chart.title
  const hasXTitle = !!chart.xAxis.title
  const hasYTitle = !!chart.yAxis.title
  const hasLegend = chart.series.length > 1

  // Compute y-axis label width from tick labels
  //
  // parseXYChart always derives a y-axis range (from data or a 0-100
  // fallback — see xychart/parser.ts) before returning, so this is never
  // actually undefined for parsed input. That guarantee lives in a
  // different module, so narrow it here explicitly instead of trusting it
  // silently across the boundary.
  const yRange = chart.yAxis.range
  if (!yRange) {
    /* v8 ignore next */
    throw new Error('XY chart: y-axis range was not set by the parser')
  }
  const va = valueAxis(chart, XY.plotHeight, () => XY.axisLabelHeight)
  const yTicks = va.ticks
  const yLabels = va.labels
  const maxYLabelWidth = Math.max(
    ...yLabels.map((label) =>
      estimateTextWidth(label, XY.axisLabelFontSize, XY.axisLabelFontWeight),
    ),
    XY.yLabelWidth,
  )

  // Margins
  const top =
    XY.padding +
    (hasTitle ? XY.titleHeight : 0) +
    (hasLegend ? XY.legendHeight : 0)
  const bottom =
    XY.padding + XY.xLabelHeight + (hasXTitle ? XY.axisTitlePad : 0)
  const left =
    XY.padding +
    maxYLabelWidth +
    XY.yLabelGap +
    (hasYTitle ? XY.axisTitlePad : 0)
  const right = XY.padding

  const plotW = XY.plotWidth
  const plotH = XY.plotHeight
  const totalW = left + plotW + right
  const totalH = top + plotH + bottom

  const plotArea: PlotArea = { x: left, y: top, width: plotW, height: plotH }

  // Scales
  const dataCount = getDataCount(chart)
  const cat = buildCatAxis(chart, plotW, false)
  const xScale = (n: number, i: number) => left + cat.at(n, i)
  const yScale = (v: number) =>
    top + plotH - va.pad - va.frac(v) * (plotH - 2 * va.pad)

  // X-axis ticks
  const axisY = top + plotH
  const xTicks: AxisTick[] = cat.ticks.map((t) => ({
    label: t.label,
    x: left + t.at,
    y: axisY,
    tx: left + t.at,
    ty: axisY + XY.tickLength,
    labelX: left + t.at,
    labelY: axisY + 18,
    textAnchor: 'middle' as const,
  }))

  // Y-axis ticks
  const yAxisTicks: AxisTick[] = yTicks.map((v, i) => ({
    label: yLabels[i]!,
    x: left,
    y: yScale(v),
    tx: left - XY.tickLength,
    ty: yScale(v),
    labelX: left - XY.yLabelGap,
    labelY: yScale(v),
    textAnchor: 'end' as const,
  }))

  // Grid lines (horizontal at each y tick)
  const gridLines: GridLine[] = yTicks.map((v) => ({
    x1: left,
    y1: yScale(v),
    x2: left + plotW,
    y2: yScale(v),
  }))

  // Category labels for data attributes
  const catLabels = getCategoryLabels(chart, dataCount)

  // Global color index map: each series gets a unique color index regardless of type
  const colorMap = chart.series.map((_, i) => i)

  // Bars
  const bars = layoutBars(
    chart,
    xScale,
    yScale,
    cat.bar,
    // Mermaid draws every bar down to the bottom of the plot; only a range
    // that dips below zero keeps the zero line as the base.
    va.range.min >= 0 ? top + plotH : yScale(0),
    catLabels,
    colorMap,
  )

  // Lines
  const lines = layoutLines(chart, xScale, yScale, catLabels, colorMap)

  // Legend
  const legendY =
    XY.padding + (hasTitle ? XY.titleHeight : 0) + XY.legendHeight / 2
  const legend = hasLegend
    ? buildLegendItems(chart, totalW / 2, legendY, colorMap)
    : []

  // Axis lines
  const xAxisLine = {
    x1: left,
    y1: top + plotH,
    x2: left + plotW,
    y2: top + plotH,
  }
  const yAxisLine = { x1: left, y1: top, x2: left, y2: top + plotH }

  // Axis titles
  const xAxisObj: PositionedAxis = {
    ticks: xTicks,
    line: xAxisLine,
    ...(chart.xAxis.title
      ? {
          title: {
            text: chart.xAxis.title,
            x: left + plotW / 2,
            y: totalH - XY.padding,
          },
        }
      : {}),
  }
  const yAxisObj: PositionedAxis = {
    ticks: yAxisTicks,
    line: yAxisLine,
    ...(chart.yAxis.title
      ? {
          title: {
            text: chart.yAxis.title,
            x: XY.padding + 4,
            y: top + plotH / 2,
            rotate: -90,
          },
        }
      : {}),
  }

  // Title
  const titleObj = chart.title
    ? { text: chart.title, x: totalW / 2, y: XY.padding + XY.titleFontSize }
    : undefined

  return {
    width: totalW,
    height: totalH,
    title: titleObj,
    xAxis: xAxisObj,
    yAxis: yAxisObj,
    plotArea,
    bars,
    lines,
    gridLines,
    legend,
  }
}

// ============================================================================
// Horizontal layout
// ============================================================================

function layoutHorizontal(chart: XYChart): PositionedXYChart {
  const hasTitle = !!chart.title
  const hasXTitle = !!chart.xAxis.title
  const hasYTitle = !!chart.yAxis.title
  const hasLegend = chart.series.length > 1

  // In horizontal mode: categories go on y-axis (left side), values go on x-axis (bottom)
  //
  // See the matching comment in layoutVertical: the parser always derives a
  // y-axis range before returning, but that guarantee lives in a different
  // module, so it's narrowed here explicitly rather than trusted silently.
  const yRange = chart.yAxis.range
  if (!yRange) {
    /* v8 ignore next */
    throw new Error('XY chart: y-axis range was not set by the parser')
  }
  const va = valueAxis(
    chart,
    XY.plotWidth,
    (labels) =>
      MERMAID_TEXT_SCALE *
      Math.max(
        ...labels.map((l) =>
          estimateTextWidth(l, XY.axisLabelFontSize, XY.axisLabelFontWeight),
        ),
      ),
  )
  const valueTicks = va.ticks
  const valueLabels = va.labels

  // Compute category label widths for left margin
  const dataCount = getDataCount(chart)
  const catLabels = getCategoryLabels(chart, dataCount)
  const cat = buildCatAxis(chart, XY.plotHeight, true)
  const maxCatLabelWidth = Math.max(
    ...cat.ticks.map(({ label: l }) =>
      estimateTextWidth(l, XY.axisLabelFontSize, XY.axisLabelFontWeight),
    ),
    40,
  )

  const top =
    XY.padding +
    (hasTitle ? XY.titleHeight : 0) +
    (hasLegend ? XY.legendHeight : 0)
  const bottom =
    XY.padding + XY.xLabelHeight + (hasYTitle ? XY.axisTitlePad : 0)
  const left =
    XY.padding +
    maxCatLabelWidth +
    XY.yLabelGap +
    (hasXTitle ? XY.axisTitlePad : 0)
  // The last value label is centered on the plot's right edge, so reserve
  // half its width there (#2311).
  const right = Math.max(
    XY.padding,
    estimateTextWidth(
      valueLabels[valueLabels.length - 1]!,
      XY.axisLabelFontSize,
      XY.axisLabelFontWeight,
    ) /
      2 +
      4,
  )

  const plotW = XY.plotWidth
  const plotH = XY.plotHeight
  const totalW = left + plotW + right
  const totalH = top + plotH + bottom

  const plotArea: PlotArea = { x: left, y: top, width: plotW, height: plotH }

  // Value scale (horizontal: left to right)
  const valueScale = (v: number) =>
    left + va.pad + va.frac(v) * (plotW - 2 * va.pad)

  // Category scale (vertical: top to bottom)
  const catScale = (n: number, i: number) => top + cat.at(n, i)

  // X-axis (bottom): value ticks
  const xTicks: AxisTick[] = valueTicks.map((v, i) => ({
    label: valueLabels[i]!,
    x: valueScale(v),
    y: top + plotH,
    tx: valueScale(v),
    ty: top + plotH + XY.tickLength,
    labelX: valueScale(v),
    labelY: top + plotH + 18,
    textAnchor: 'middle' as const,
  }))

  // Y-axis (left): category ticks
  const yTicks: AxisTick[] = cat.ticks.map(({ label, at }) => ({
    label,
    x: left,
    y: top + at,
    tx: left - XY.tickLength,
    ty: top + at,
    labelX: left - XY.yLabelGap,
    labelY: top + at,
    textAnchor: 'end' as const,
  }))

  // Grid lines (vertical at each value tick)
  const gridLines: GridLine[] = valueTicks.map((v) => ({
    x1: valueScale(v),
    y1: top,
    x2: valueScale(v),
    y2: top + plotH,
  }))

  // Global color index map
  const colorMap = chart.series.map((_, i) => i)

  // Bars (horizontal)
  const barSeries = chart.series.filter((s) => s.type === 'bar')
  const barCount = barSeries.length
  const bars: PositionedBar[] = []
  if (barCount > 0) {
    // Mermaid 12.2.0 draws every bar series centred on the same category
    // (the series overlap, later ones on top) rather than side by side.
    const singleBarH = cat.bar
    const groupH = singleBarH
    let bIdx = 0
    let seriesArrayIdx = 0
    for (const s of chart.series) {
      if (s.type !== 'bar') {
        seriesArrayIdx++
        continue
      }
      for (let i = 0; i < s.data.length; i++) {
        const cy = catScale(s.data.length, i)
        const groupTop = cy - groupH / 2
        const by = groupTop
        const valX = valueScale(Math.max(s.data[i]!, va.range.min))
        const baseX = va.range.min >= 0 ? left : valueScale(0)
        bars.push({
          x: Math.min(baseX, valX),
          y: by,
          width: Math.abs(valX - baseX),
          height: singleBarH,
          value: s.data[i]!,
          // A series can carry more data points than the chart has category
          // labels for (e.g. a bar/line series longer than x-axis.categories
          // or the series that determined dataCount), so catLabels[i] is not
          // guaranteed to exist just because s.data[i] does. `label` is
          // already optional on PositionedBar, so let a missing entry flow
          // through as undefined instead of asserting past a real gap.
          label: catLabels[i],
          seriesIndex: bIdx,
          colorIndex: colorMap[seriesArrayIdx]!,
        })
      }
      bIdx++
      seriesArrayIdx++
    }
  }

  // Lines (horizontal: value on x, category index on y)
  const lines: PositionedLine[] = []
  let lineIdx = 0
  let lineSeriesIdx = 0
  for (const s of chart.series) {
    if (s.type !== 'line') {
      lineSeriesIdx++
      continue
    }
    const points = s.data.map((v, i) => ({
      x: valueScale(v),
      y: catScale(s.data.length, i),
      value: v,
      // See the matching comment in the bars loop above: a line series can
      // outrun catLabels, and the point's `label` is already optional.
      label: catLabels[i],
    }))
    lines.push({
      points,
      seriesIndex: lineIdx,
      colorIndex: colorMap[lineSeriesIdx]!,
    })
    lineIdx++
    lineSeriesIdx++
  }

  const xAxisLine = {
    x1: left,
    y1: top + plotH,
    x2: left + plotW,
    y2: top + plotH,
  }
  const yAxisLine = { x1: left, y1: top, x2: left, y2: top + plotH }

  // In horizontal mode, the "y-axis" title describes values (bottom) and "x-axis" title describes categories (left)
  const xAxisObj: PositionedAxis = {
    ticks: xTicks,
    line: xAxisLine,
    ...(chart.yAxis.title
      ? {
          title: {
            text: chart.yAxis.title,
            x: left + plotW / 2,
            y: totalH - XY.padding,
          },
        }
      : {}),
  }
  const yAxisObj: PositionedAxis = {
    ticks: yTicks,
    line: yAxisLine,
    ...(chart.xAxis.title
      ? {
          title: {
            text: chart.xAxis.title,
            x: XY.padding + 4,
            y: top + plotH / 2,
            rotate: -90,
          },
        }
      : {}),
  }

  const titleObj = chart.title
    ? { text: chart.title, x: totalW / 2, y: XY.padding + XY.titleFontSize }
    : undefined

  // Legend
  const legendY =
    XY.padding + (hasTitle ? XY.titleHeight : 0) + XY.legendHeight / 2
  const legend = hasLegend
    ? buildLegendItems(chart, totalW / 2, legendY, colorMap)
    : []

  return {
    width: totalW,
    height: totalH,
    horizontal: true,
    title: titleObj,
    xAxis: xAxisObj,
    yAxis: yAxisObj,
    plotArea,
    bars,
    lines,
    gridLines,
    legend,
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getDataCount(chart: XYChart): number {
  if (chart.xAxis.categories) return chart.xAxis.categories.length
  // For numeric range, use the length of the first series
  for (const s of chart.series) {
    if (s.data.length > 0) return s.data.length
  }
  return 1
}

function getCategoryLabels(chart: XYChart, count: number): string[] {
  if (chart.xAxis.categories) return chart.xAxis.categories
  if (chart.xAxis.range) {
    const { min, max } = chart.xAxis.range
    const step = count > 1 ? (max - min) / (count - 1) : 0
    return Array.from({ length: count }, (_, i) =>
      formatTickValue(min + step * i),
    )
  }
  return Array.from({ length: count }, (_, i) => String(i + 1))
}

/**
 * Minimum clear space between two neighbouring x-axis labels. */
const X_LABEL_MIN_GAP = 8

/**
 * Step between shown x-axis labels: 1 when every pair of neighbouring labels
 * keeps `X_LABEL_MIN_GAP` of clear space, otherwise the smallest n for which
 * every pair of shown (every n-th) labels does. Checked pairwise on the real
 * widths so one long label doesn't thin out an otherwise roomy axis. No longer
 * used by the SVG layout, which labels every category as mermaid 12.2.0 does;
 * kept as public API.
 */
export function xLabelStep(labels: string[], bandWidth: number): number {
  const widths = labels.map((l) =>
    estimateTextWidth(l, XY.axisLabelFontSize, XY.axisLabelFontWeight),
  )
  for (let step = 1; step < labels.length; step++) {
    let fits = true
    for (let i = 0; i + step < labels.length; i += step) {
      const gap = step * bandWidth - (widths[i]! + widths[i + step]!) / 2
      if (gap < X_LABEL_MIN_GAP) {
        fits = false
        break
      }
    }
    if (fits) return step
  }
  return Math.max(1, labels.length)
}

function layoutBars(
  chart: XYChart,
  xScale: (n: number, i: number) => number,
  yScale: (v: number) => number,
  singleBarW: number,
  baseY: number,
  catLabels: string[],
  colorMap: number[],
): PositionedBar[] {
  const barSeries = chart.series.filter((s) => s.type === 'bar')
  const barCount = barSeries.length
  if (barCount === 0) return []

  const groupW = singleBarW
  const bars: PositionedBar[] = []

  let bIdx = 0
  let seriesArrayIdx = 0
  for (const s of chart.series) {
    if (s.type !== 'bar') {
      seriesArrayIdx++
      continue
    }
    for (let i = 0; i < s.data.length; i++) {
      const cx = xScale(s.data.length, i)
      const groupLeft = cx - groupW / 2
      const bx = groupLeft
      const valY = yScale(s.data[i]!)
      bars.push({
        x: bx,
        y: Math.min(valY, baseY),
        width: singleBarW,
        height: Math.abs(baseY - valY),
        value: s.data[i]!,
        // catLabels has one entry per dataCount, which is not necessarily
        // s.data.length for every series. `label` is already optional on
        // PositionedBar, so let a missing entry flow through as undefined
        // instead of asserting past a real (if unusual) length mismatch.
        // See layoutHorizontal's matching comment.
        label: catLabels[i],
        seriesIndex: bIdx,
        colorIndex: colorMap[seriesArrayIdx]!,
      })
    }
    bIdx++
    seriesArrayIdx++
  }
  return bars
}

function layoutLines(
  chart: XYChart,
  xScale: (n: number, i: number) => number,
  yScale: (v: number) => number,
  catLabels: string[],
  colorMap: number[],
): PositionedLine[] {
  const lines: PositionedLine[] = []
  let lineIdx = 0
  let seriesArrayIdx = 0
  for (const s of chart.series) {
    if (s.type !== 'line') {
      seriesArrayIdx++
      continue
    }
    const points = s.data.map((v, i) => ({
      x: xScale(s.data.length, i),
      y: yScale(v),
      value: v,
      // See layoutBars' matching comment: a line series can outrun
      // catLabels, and the point's `label` is already optional.
      label: catLabels[i],
    }))
    lines.push({
      points,
      seriesIndex: lineIdx,
      colorIndex: colorMap[seriesArrayIdx]!,
    })
    lineIdx++
    seriesArrayIdx++
  }
  return lines
}

export { niceTickValues } from '@zombie-mermaid/core'

/**
 * Format a set of evenly-spaced tick values with enough decimal places to
 * keep every label distinct. Precision comes from the tick step, not the
 * magnitude of the value: a 0.5 step around 100 needs one decimal, or
 * 99.5 and 100.5 both collapse into neighbouring whole numbers.
 */
export function formatTickLabels(ticks: number[]): string[] {
  const step = ticks.length > 1 ? Math.abs(ticks[1]! - ticks[0]!) : 0
  // The -1e-9 keeps an exact power-of-ten step (0.1) from rounding up
  const decimals =
    step > 0 && step < 1 ? Math.ceil(-Math.log10(step) - 1e-9) : 0
  return ticks.map((v) =>
    Number.isInteger(v) && decimals === 0
      ? String(v)
      : String(Number(v.toFixed(decimals))),
  )
}

function formatTickValue(v: number): string {
  if (Number.isInteger(v)) return String(v)
  // Limit decimal places
  return v.toFixed(Math.abs(v) < 10 ? 1 : 0)
}

/** Build centered legend items for multi-series charts */
function buildLegendItems(
  chart: XYChart,
  centerX: number,
  y: number,
  colorMap: number[],
): LegendItem[] {
  const items: LegendItem[] = []
  let barIdx = 0,
    lineIdx = 0
  for (let si = 0; si < chart.series.length; si++) {
    const s = chart.series[si]!
    const label = s.type === 'bar' ? `Bar ${barIdx + 1}` : `Line ${lineIdx + 1}`
    items.push({
      label,
      x: 0,
      y,
      type: s.type,
      seriesIndex: s.type === 'bar' ? barIdx : lineIdx,
      colorIndex: colorMap[si]!,
    })
    if (s.type === 'bar') barIdx++
    else lineIdx++
  }

  // Measure total width, then center
  const itemWidths = items.map((item) => {
    const textW = estimateTextWidth(
      item.label,
      XY.legendFontSize,
      XY.legendFontWeight,
    )
    return XY.legendSwatchW + XY.legendGap + textW
  })
  const totalWidth =
    itemWidths.reduce((a, b) => a + b, 0) +
    (items.length - 1) * XY.legendItemGap
  let x = centerX - totalWidth / 2

  for (let i = 0; i < items.length; i++) {
    items[i]!.x = x
    x += itemWidths[i]! + XY.legendItemGap
  }

  return items
}
