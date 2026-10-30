// ============================================================================
// Quadrant chart layout
//
// Turns a parsed QuadrantChart into absolute SVG geometry, following Mermaid's
// own quadrantBuilder.ts (default config, mermaid@12.2.0). All lengths are
// Mermaid's and none depends on measured text, so this is pure arithmetic:
//
//   - a 500 x 500 frame; the plot is inset by 5px (quadrantPadding)
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
  width: 500,
  height: 500,
  titlePadding: 10,
  titleFontSize: 20,
  quadrantPadding: 5,
  axisLabelPadding: 5,
  axisLabelFontSize: 16,
  quadrantLabelFontSize: 16,
  quadrantTextTopPadding: 5,
  pointTextPadding: 5,
  pointLabelFontSize: 12,
  pointRadius: 5,
  internalBorderWidth: 1,
  externalBorderWidth: 2,
} as const

function text(
  t: Pick<PositionedQuadrantText, 'text' | 'x' | 'y' | 'fontSize'> &
    Partial<PositionedQuadrantText>,
): PositionedQuadrantText {
  return { anchor: 'middle', baseline: 'hanging', rotation: 0, ...t }
}

export function layoutQuadrantChart(
  chart: QuadrantChart,
): PositionedQuadrantChart {
  const Q = QUADRANT
  const hasPoints = chart.points.length > 0
  const showX = !!(chart.xAxisLeft || chart.xAxisRight)
  const showY = !!(chart.yAxisBottom || chart.yAxisTop)
  const showTitle = !!chart.title
  const axisSpace = Q.axisLabelPadding * 2 + Q.axisLabelFontSize
  const titleSpace = showTitle ? Q.titleFontSize + Q.titlePadding * 2 : 0
  const xTop = !hasPoints && showX ? axisSpace : 0
  const xBottom = hasPoints && showX ? axisSpace : 0
  const yLeft = showY ? axisSpace : 0

  const left = Q.quadrantPadding + yLeft
  const top = Q.quadrantPadding + xTop + titleSpace
  const w = Q.width - Q.quadrantPadding * 2 - yLeft
  const h = Q.height - Q.quadrantPadding * 2 - xTop - xBottom - titleSpace
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

  const half = Q.externalBorderWidth / 2
  const ext = (x1: number, y1: number, x2: number, y2: number) =>
    ({
      x1,
      y1,
      x2,
      y2,
      strokeWidth: Q.externalBorderWidth,
      kind: 'external',
    }) as const
  const int = (x1: number, y1: number, x2: number, y2: number) =>
    ({
      x1,
      y1,
      x2,
      y2,
      strokeWidth: Q.internalBorderWidth,
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
  const xY = hasPoints
    ? Q.axisLabelPadding + top + h + Q.quadrantPadding
    : Q.axisLabelPadding + titleSpace
  const xTwo = !!chart.xAxisRight
  const xLabel = (t: string, x: number) =>
    axisLabels.push(
      text({
        text: t,
        x,
        y: xY,
        fontSize: Q.axisLabelFontSize,
        anchor: xTwo ? 'middle' : 'start',
      }),
    )
  if (showX && chart.xAxisLeft) {
    xLabel(chart.xAxisLeft, left + (xTwo ? hw / 2 : 0))
  }
  if (showX && chart.xAxisRight) xLabel(chart.xAxisRight, left + hw + hw / 2)
  const yTwo = !!chart.yAxisTop
  const yLabel = (t: string, y: number) =>
    axisLabels.push(
      text({
        text: t,
        x: Q.axisLabelPadding,
        y,
        fontSize: Q.axisLabelFontSize,
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
    width: Q.width,
    height: Q.height,
    title: showTitle
      ? text({
          text: chart.title!,
          x: Q.width / 2,
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
