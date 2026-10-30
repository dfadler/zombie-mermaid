// ============================================================================
// Quadrant chart layout
//
// Turns a parsed QuadrantChart into absolute SVG geometry, following Mermaid's
// own quadrantBuilder.ts (default config, mermaid@12.2.0). All lengths are
// Mermaid's and none depends on measured text, so this is pure arithmetic:
//
//   - a 500 x 500 frame (`chartWidth`/`chartHeight`); the plot is inset by 5px
//     (quadrantPadding). Each default here can be set by `%%{init}%%` config
//   - the title takes 20 + 2 * 10px at the top, when there is one
//   - an axis takes 2 * 5 + 16px on its side, when it has any text: the x axis
//     sits on top while the chart has no points and moves below the plot as
//     soon as it has one; the y axis is on the left
//   - four equal cells; labels centred in them while the chart has no points,
//     at the top (5px down) once it has some
//   - a point is a circle (radius 5) at (x, 1 - y) of the plot, labelled with
//     its text 5px below its centre
//   - frame lines 2px, the cross 1px, drawn half a frame-width short of the
//     corners so the strokes meet
//   - Mermaid inserts each new point at the front of its list, so the last
//     point in the source is drawn first (underneath); `points` here is in
//     that paint order.
//
// Differences from Mermaid are in the renderer, not here: colours come from
// this library's theme variables, and the default point fill is the theme's
// foreground (Mermaid 12.2.0's default theme emits `hsl(240, 100%, NaN%)`,
// which browsers drop, leaving black).
// ============================================================================

import type {
  PositionedQuadrantCell,
  PositionedQuadrantChart,
  PositionedQuadrantLine,
  PositionedQuadrantPoint,
  PositionedQuadrantText,
  QuadrantChart,
} from '@zombie-mermaid/mermaid-parser'

/** Mermaid's default `quadrantChart` config. */
export const QUADRANT = {
  titlePadding: 10,
  titleFontSize: 20,
  quadrantPadding: 5,
  xAxisLabelPadding: 5,
  yAxisLabelPadding: 5,
  xAxisLabelFontSize: 16,
  yAxisLabelFontSize: 16,
  quadrantLabelFontSize: 16,
  quadrantTextTopPadding: 5,
  pointTextPadding: 5,
  pointLabelFontSize: 12,
  pointRadius: 5,
  quadrantInternalBorderStrokeWidth: 1,
  quadrantExternalBorderStrokeWidth: 2,
  xAxisPosition: 'top',
  yAxisPosition: 'left',
} as const

/** `chartWidth`/`chartHeight` are the config's names for the frame size. */
const DEFAULTS = { chartWidth: 500, chartHeight: 500 }

function text(
  t: Pick<PositionedQuadrantText, 'text' | 'x' | 'y' | 'fontSize'> &
    Partial<PositionedQuadrantText>,
): PositionedQuadrantText {
  return { anchor: 'middle', baseline: 'hanging', rotation: 0, ...t }
}

export function layoutQuadrantChart(
  chart: QuadrantChart,
): PositionedQuadrantChart {
  const Q = { ...QUADRANT, ...DEFAULTS, ...chart.config }
  const hasPoints = chart.points.length > 0
  const showX = !!(chart.xAxisLeft || chart.xAxisRight)
  const showY = !!(chart.yAxisBottom || chart.yAxisTop)
  const showTitle = !!chart.title
  const xSpace = Q.xAxisLabelPadding * 2 + Q.xAxisLabelFontSize
  const ySpace = Q.yAxisLabelPadding * 2 + Q.yAxisLabelFontSize
  const titleSpace = showTitle ? Q.titleFontSize + Q.titlePadding * 2 : 0
  // Points push the x axis below the plot whatever `xAxisPosition` says.
  const xOnTop = !hasPoints && Q.xAxisPosition === 'top'
  const xTop = xOnTop && showX ? xSpace : 0
  const xBottom = !xOnTop && showX ? xSpace : 0
  const yLeft = Q.yAxisPosition === 'left' && showY ? ySpace : 0
  const yRight = Q.yAxisPosition === 'right' && showY ? ySpace : 0

  const left = Q.quadrantPadding + yLeft
  const top = Q.quadrantPadding + xTop + titleSpace
  const w = Q.chartWidth - Q.quadrantPadding * 2 - yLeft - yRight
  const h = Q.chartHeight - Q.quadrantPadding * 2 - xTop - xBottom - titleSpace
  const hw = w / 2
  const hh = h / 2

  // Quadrant 1 is top right, 2 top left, 3 bottom left, 4 bottom right.
  const origins = [
    [left + hw, top],
    [left, top],
    [left, top + hh],
    [left + hw, top + hh],
  ] as const
  const quadrants: PositionedQuadrantCell[] = origins.map(([x, y], index) => ({
    index,
    x,
    y,
    width: hw,
    height: hh,
    text: text({
      text: chart.quadrants[index]!,
      x: x + hw / 2,
      y: hasPoints ? y + Q.quadrantTextTopPadding : y + hh / 2,
      fontSize: Q.quadrantLabelFontSize,
      baseline: hasPoints ? 'hanging' : 'middle',
    }),
  }))

  const half = Q.quadrantExternalBorderStrokeWidth / 2
  const ext = (x1: number, y1: number, x2: number, y2: number) =>
    ({
      x1,
      y1,
      x2,
      y2,
      strokeWidth: Q.quadrantExternalBorderStrokeWidth,
      kind: 'external',
    }) as const
  const int = (x1: number, y1: number, x2: number, y2: number) =>
    ({
      x1,
      y1,
      x2,
      y2,
      strokeWidth: Q.quadrantInternalBorderStrokeWidth,
      kind: 'internal',
    }) as const
  const lines: PositionedQuadrantLine[] = [
    ext(left - half, top, left + w + half, top),
    ext(left + w, top + half, left + w, top + h - half),
    ext(left - half, top + h, left + w + half, top + h),
    ext(left, top + half, left, top + h - half),
    int(left + hw, top + half, left + hw, top + h - half),
    int(left + half, top + hh, left + w - half, top + hh),
  ]

  const axisLabels: PositionedQuadrantText[] = []
  const xY = xOnTop
    ? Q.xAxisLabelPadding + titleSpace
    : Q.xAxisLabelPadding + top + h + Q.quadrantPadding
  const xTwo = !!chart.xAxisRight
  const xLabel = (t: string, x: number) =>
    axisLabels.push(
      text({
        text: t,
        x,
        y: xY,
        fontSize: Q.xAxisLabelFontSize,
        anchor: xTwo ? 'middle' : 'start',
      }),
    )
  if (showX && chart.xAxisLeft) {
    xLabel(chart.xAxisLeft, left + (xTwo ? hw / 2 : 0))
  }
  if (showX && chart.xAxisRight) xLabel(chart.xAxisRight, left + hw + hw / 2)
  const yX =
    Q.yAxisPosition === 'left'
      ? Q.yAxisLabelPadding
      : Q.yAxisLabelPadding + left + w + Q.quadrantPadding
  const yTwo = !!chart.yAxisTop
  const yLabel = (t: string, y: number) =>
    axisLabels.push(
      text({
        text: t,
        x: yX,
        y,
        fontSize: Q.yAxisLabelFontSize,
        anchor: yTwo ? 'middle' : 'start',
        rotation: -90,
      }),
    )
  if (showY && chart.yAxisBottom) {
    yLabel(chart.yAxisBottom, top + h - (yTwo ? hh / 2 : 0))
  }
  if (showY && chart.yAxisTop) yLabel(chart.yAxisTop, top + hh - hh / 2)

  const points: PositionedQuadrantPoint[] = [...chart.points]
    .reverse()
    .map((p) => {
      const x = left + p.x * w
      const y = top + h - p.y * h
      return {
        x,
        y,
        radius: p.radius ?? Q.pointRadius,
        color: p.color,
        // Mermaid's default stroke is the default fill, not the point's own.
        strokeColor: p.strokeColor,
        strokeWidth: p.strokeWidth ?? '0px',
        text: text({
          text: p.label,
          x,
          y: y + Q.pointTextPadding,
          fontSize: Q.pointLabelFontSize,
        }),
      }
    })

  return {
    width: Q.chartWidth,
    height: Q.chartHeight,
    themeColors: chart.themeColors,
    title: showTitle
      ? text({
          text: chart.title!,
          x: Q.chartWidth / 2,
          y: Q.titlePadding,
          fontSize: Q.titleFontSize,
        })
      : undefined,
    quadrants,
    lines,
    axisLabels,
    points,
  }
}
