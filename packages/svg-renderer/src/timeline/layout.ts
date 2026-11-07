// ============================================================================
// Timeline layout
//
// Turns a parsed Timeline into absolute SVG geometry, following Mermaid's own
// timelineRenderer.ts (left to right) and timelineRendererVertical.ts (`timeline
// TD`), default config, checked against mermaid@12.2.0 and 12.3.0 (identical).
// The numbers are Mermaid's; the one input that needs a browser there, where
// a label wraps, is found here by summing Trebuchet MS advances.
//
// Left to right:
//   - periods sit in columns 200px apart starting at x = 200; a box is
//     150 + 2 * 20 wide and its text wraps at 150px
//   - a section heading spans its columns (200 * n - 10) at y = 50 and the
//     periods start 50px under it; without sections they start at y = 50
//   - a period box is as tall as its text needs, never under 67.8px, and
//     within a section never shorter than an earlier period (Mermaid keeps a
//     running maximum); the dashed line under each period runs past its events
//   - events stack from 100px under the period's row, 10px apart, 50px at least
//   - the main axis runs under the periods at y = 100 + 67.8 (+ 50 + the
//     tallest heading with sections), from x = 150 to the content's width + 450
//   - the title is 4ex bold at x = content width / 2 - 150, y = 20
//   - the viewBox is the bounding box of all of that plus 50px
//
// Differences from Mermaid are in the renderer: colours come from this
// library's theme variables.
// ============================================================================

import type {
  PositionedTimeline,
  PositionedTimelineConnector,
  PositionedTimelineNode,
  Timeline,
  TimelinePeriod,
} from '@zombie-mermaid/mermaid-parser'
import { trebuchetAdvance } from './trebuchet-widths.ts'

/** Mermaid's default font size and the line pitch of its wrapped text (1.1em). */
export const TIMELINE = {
  fontSize: 16,
  lineHeight: 17.6,
  /** Height of one line of text as Mermaid measures it (`getBBox`). */
  firstLineHeight: 19,
  /** Added to the text height: `fontSize * 1.1 * 0.5`. */
  textPad: 8.8,
  nodeWidth: 150,
  padding: 20,
  /** `timeline.leftMargin`. */
  leftMargin: 150,
  columnWidth: 200,
  eventGap: 10,
  /** The height Mermaid's first measuring pass gives every period (it measures `[object Object]`). */
  periodFloor: 67.8,
  eventFloor: 50,
  titleFontSize: 33.4688,
  titleAscent: 31,
  titleDescent: 7,
  viewBoxPadding: 50,
  colorLimit: 12,
} as const

/** Width of `text` in Mermaid's default font at 16px (or `size`). */
export function textWidth(text: string, size = 16, bold = false): number {
  let em = 0
  for (const ch of text) {
    const a = trebuchetAdvance(ch, bold)
    // Outside printable ASCII there is no table: wide scripts take a full em.
    em += a ?? ((ch.codePointAt(0) ?? 0) >= 0x2e80 ? 1 : 0.6)
  }
  return em * size
}

/**
 * Mermaid's `wrap()` from timeline/svgDraw.js: words (and the whitespace
 * between them) are added to a line until it is wider than `width`, then the
 * overflowing word starts the next line. A word wider than the box on an empty
 * line leaves an empty first line, as it does there. `<br>` forces a break.
 */
export function wrapTimelineText(text: string, width: number): string[] {
  const tokens = text.split(/(\s+|<br>)/)
  const lines: string[] = []
  let line: string[] = []
  // The tspan being filled; Mermaid only rewrites it on the next token.
  let current = ''
  for (const token of tokens) {
    line.push(token)
    const joined = line.join(' ').trim()
    if (textWidth(joined.replace(/\s+/g, ' ')) > width || token === '<br>') {
      line.pop()
      lines.push(line.join(' ').trim())
      line = token === '<br>' ? [''] : [token]
      current = token
    } else {
      current = joined
    }
  }
  lines.push(current)
  return lines.map((l) => l.replace(/\s+/g, ' '))
}

/**
 * Lines Mermaid's text box spans. A `dy` shift applies to the first glyph of a
 * `tspan`, so an empty line (a single word wider than the box leaves an empty
 * first one, `<br><br>` an empty middle one) takes no room: only lines with
 * text count.
 */
export function spannedLines(lines: string[]): number {
  return lines.filter((l) => l !== '').length
}

/** Height Mermaid computes for `n` spanned lines, padding included. */
function rawHeight(n: number, padding: number = TIMELINE.padding): number {
  return (
    (n === 0 ? 0 : TIMELINE.firstLineHeight + (n - 1) * TIMELINE.lineHeight) +
    TIMELINE.textPad +
    padding
  )
}

/** Height of `text` wrapped to `width`. */
function heightOf(
  text: string,
  width: number,
  padding: number = TIMELINE.padding,
): number {
  return rawHeight(spannedLines(wrapTimelineText(text, width)), padding)
}

function colorClass(sectionColor: number): number {
  return (sectionColor % TIMELINE.colorLimit) - 1
}

interface Bounds {
  x1: number
  y1: number
  x2: number
  y2: number
}

function grow(
  b: Bounds | undefined,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Bounds {
  if (!b) return { x1, y1, x2, y2 }
  return {
    x1: Math.min(b.x1, x1),
    y1: Math.min(b.y1, y1),
    x2: Math.max(b.x2, x2),
    y2: Math.max(b.y2, y2),
  }
}

/** Lay out a left-to-right timeline (Mermaid's default direction). */
function layoutLR(tl: Timeline): PositionedTimeline {
  const { periods, sections } = tl
  const T = TIMELINE
  const hasSections = sections.length > 0
  const nodes: PositionedTimelineNode[] = []
  const connectors: PositionedTimelineConnector[] = []

  // First pass: the tallest heading, and the longest event column.
  let maxSectionHeight = 0
  for (const s of sections) {
    maxSectionHeight = Math.max(
      maxSectionHeight,
      heightOf(s, T.nodeWidth) + T.padding,
    )
  }
  const maxTaskHeight0 = periods.length > 0 ? T.periodFloor : 0
  let maxEventLineLength = 0
  for (const p of periods) {
    let sum = 0
    for (const e of p.events) sum += heightOf(e, T.nodeWidth)
    if (p.events.length > 0) sum += (p.events.length - 1) * T.eventGap
    maxEventLineLength = Math.max(maxEventLineLength, sum)
  }

  // Bounding box of what Mermaid has drawn when it measures it for the axis.
  let content: Bounds | undefined
  const addNode = (n: PositionedTimelineNode, anchorW: number) => {
    nodes.push(n)
    content = grow(content, n.x, n.y, n.x + n.width, n.y + n.height)
    // Text wider than its box (one long word) sticks out of it.
    for (const l of n.lines) {
      const w = textWidth(l)
      content = grow(
        content,
        n.x + anchorW / 2 - w / 2,
        n.y,
        n.x + anchorW / 2 + w / 2,
        n.y,
      )
    }
  }

  const drawPeriods = (
    list: TimelinePeriod[],
    x0: number,
    y0: number,
    firstColor: number,
    multicolor: boolean,
  ) => {
    let x = x0
    let color = firstColor
    let runningMax = maxTaskHeight0
    for (const p of list) {
      const lines = wrapTimelineText(p.label, T.nodeWidth)
      const height = Math.max(rawHeight(spannedLines(lines)), runningMax)
      runningMax = Math.max(runningMax, height)
      addNode(
        {
          kind: 'period',
          x,
          y: y0,
          width: T.nodeWidth + 2 * T.padding,
          height,
          lines,
          colorClass: colorClass(color),
          padding: T.padding,
        },
        T.nodeWidth + 2 * T.padding,
      )
      // Events, 100px below the period row (plus 100 again for the gap).
      let ey = y0 + 200
      for (const e of p.events) {
        const el = wrapTimelineText(e, T.nodeWidth)
        const eh = Math.max(rawHeight(spannedLines(el)), T.eventFloor)
        addNode(
          {
            kind: 'event',
            x,
            y: ey,
            width: T.nodeWidth + 2 * T.padding,
            height: eh,
            lines: el,
            colorClass: colorClass(color),
            padding: T.padding,
          },
          T.nodeWidth + 2 * T.padding,
        )
        ey += T.eventGap + eh
      }
      const cx = x + 95
      const c: PositionedTimelineConnector = {
        x1: cx,
        y1: y0 + runningMax,
        x2: cx,
        y2: y0 + runningMax + 100 + maxEventLineLength + 100,
      }
      connectors.push(c)
      content = grow(content, c.x1, c.y1, c.x2, c.y2)
      x += T.columnWidth
      if (multicolor) color++
    }
  }

  const masterX = 50 + T.leftMargin
  if (hasSections) {
    let x = masterX
    sections.forEach((name, i) => {
      const own = periods.filter((p) => p.section === name)
      const n = Math.max(own.length, 1)
      const lines = wrapTimelineText(name, T.columnWidth * n - 50)
      addNode(
        {
          kind: 'section',
          x,
          y: 50,
          width: T.columnWidth * n - 50 + 2 * T.padding,
          height: Math.max(rawHeight(spannedLines(lines)), maxSectionHeight),
          lines,
          colorClass: colorClass(i),
          padding: T.padding,
        },
        T.columnWidth * n - 50 + 2 * T.padding,
      )
      drawPeriods(own, x, 100 + maxSectionHeight, i, false)
      x += T.columnWidth * n
    })
  } else {
    drawPeriods(periods, masterX, 50, 0, true)
  }

  const boxWidth = content ? content.x2 - content.x1 : 0
  const depthY = hasSections
    ? maxSectionHeight + maxTaskHeight0 + 150
    : maxTaskHeight0 + 100
  const axis = {
    x1: T.leftMargin,
    y1: depthY,
    x2: boxWidth + 3 * T.leftMargin,
    y2: depthY,
  }
  return finish(tl, nodes, connectors, axis, boxWidth)
}

/** Add the title, take the viewBox and move everything to its origin. */
function finish(
  tl: Timeline,
  nodes: PositionedTimelineNode[],
  connectors: PositionedTimelineConnector[],
  axis: PositionedTimeline['axis'],
  boxWidth: number,
): PositionedTimeline {
  const T = TIMELINE
  let b: Bounds | undefined
  for (const n of nodes) {
    b = grow(b, n.x, n.y, n.x + n.width, n.y + n.height)
    for (const l of n.lines) {
      const w = textWidth(l)
      b = grow(
        b,
        n.x + n.width / 2 - w / 2,
        n.y,
        n.x + n.width / 2 + w / 2,
        n.y,
      )
    }
  }
  for (const c of connectors) b = grow(b, c.x1, c.y1, c.x2, c.y2)
  b = grow(b, axis.x1, axis.y1, axis.x2, axis.y2)
  let title: PositionedTimeline['title']
  if (tl.title) {
    const x = boxWidth / 2 - T.leftMargin
    title = { text: tl.title, x, y: 20, fontSize: T.titleFontSize }
    const w = textWidth(tl.title, T.titleFontSize, true)
    b = grow(b, x, 20 - T.titleAscent, x + w, 20 + T.titleDescent)
  }
  const vx = b.x1 - T.viewBoxPadding
  const vy = b.y1 - T.viewBoxPadding
  const shift = <O extends { x: number; y: number }>(o: O): O => ({
    ...o,
    x: o.x - vx,
    y: o.y - vy,
  })
  return {
    direction: tl.direction,
    width: b.x2 - b.x1 + 2 * T.viewBoxPadding,
    height: b.y2 - b.y1 + 2 * T.viewBoxPadding,
    ...(title ? { title: shift(title) } : {}),
    nodes: nodes.map(shift),
    connectors: connectors.map((c) => ({
      x1: c.x1 - vx,
      y1: c.y1 - vy,
      x2: c.x2 - vx,
      y2: c.y2 - vy,
    })),
    axis: {
      x1: axis.x1 - vx,
      y1: axis.y1 - vy,
      x2: axis.x2 - vx,
      y2: axis.y2 - vy,
    },
  }
}

/** Mermaid's vertical renderer constants (`timeline TD`). */
const TD = {
  nodeWidth: 200,
  padding: 5,
  eventWidth: 300,
  eventGap: 10,
  sectionTaskGap: 20,
  taskAxisGap: 20,
  taskVerticalGap: 30,
  eventAxisGap: 50,
  axisTopOffset: 32,
  axisBottomPadding: 28,
} as const

/** Lay out a top-to-bottom timeline (`timeline TD`). */
function layoutTD(tl: Timeline): PositionedTimeline {
  const { periods, sections } = tl
  const T = TIMELINE
  const nodes: PositionedTimelineNode[] = []
  const connectors: PositionedTimelineConnector[] = []
  const hasSections = sections.length > 0
  const nodeTotal = TD.nodeWidth + 2 * TD.padding
  const eventTotal = TD.eventWidth + 2 * TD.padding
  const leftWidth = nodeTotal + TD.taskAxisGap
  const rightWidth = eventTotal + TD.eventAxisGap
  const masterX = 50 + T.leftMargin
  const timelineX = masterX + leftWidth
  const sectionWidth = Math.max(50, leftWidth + rightWidth - 2 * TD.padding)
  const h = (text: string, width: number) => heightOf(text, width, TD.padding)

  let maxSectionHeight = 0
  for (const s of sections)
    maxSectionHeight = Math.max(maxSectionHeight, h(s, sectionWidth))
  // As in LR, the first pass measures the period object, not its label.
  const maxTaskHeight0 = periods.length > 0 ? rawHeight(1, TD.padding) : 0
  let maxEventStack = 0
  for (const p of periods) {
    let sum = 0
    for (const e of p.events) sum += h(e, TD.eventWidth)
    if (p.events.length > 0) sum += (p.events.length - 1) * TD.eventGap
    maxEventStack = Math.max(maxEventStack, sum)
  }
  const taskSpacing =
    Math.max(maxTaskHeight0, maxEventStack) + TD.taskVerticalGap

  const drawPeriods = (
    list: TimelinePeriod[],
    y0: number,
    firstColor: number,
    multicolor: boolean,
  ) => {
    let y = y0
    let color = firstColor
    let runningMax = maxTaskHeight0
    for (const p of list) {
      const lines = wrapTimelineText(p.label, TD.nodeWidth)
      const height = Math.max(
        rawHeight(spannedLines(lines), TD.padding),
        runningMax,
      )
      runningMax = Math.max(runningMax, height)
      nodes.push({
        kind: 'period',
        x: timelineX - TD.taskAxisGap - nodeTotal,
        y,
        width: nodeTotal,
        height,
        lines,
        colorClass: colorClass(color),
        padding: TD.padding,
      })
      let ey = y
      for (const e of p.events) {
        const el = wrapTimelineText(e, TD.eventWidth)
        const eh = rawHeight(spannedLines(el), TD.padding)
        const ex = timelineX + TD.eventAxisGap
        nodes.push({
          kind: 'event',
          x: ex,
          y: ey,
          width: eventTotal,
          height: eh,
          lines: el,
          colorClass: colorClass(color),
          padding: TD.padding,
        })
        connectors.push({
          x1: timelineX,
          y1: ey + eh / 2,
          x2: ex,
          y2: ey + eh / 2,
        })
        ey += eh + TD.eventGap
      }
      y += taskSpacing
      if (multicolor) color++
    }
  }

  let masterY = 50
  if (hasSections) {
    sections.forEach((name, i) => {
      const own = periods.filter((p) => p.section === name)
      const lines = wrapTimelineText(name, sectionWidth)
      const height = Math.max(
        rawHeight(spannedLines(lines), TD.padding),
        maxSectionHeight,
      )
      nodes.push({
        kind: 'section',
        x: timelineX - leftWidth,
        y: masterY,
        width: sectionWidth + 2 * TD.padding,
        height,
        lines,
        colorClass: colorClass(i),
        padding: TD.padding,
      })
      drawPeriods(own, masterY + height + TD.sectionTaskGap, i, false)
      masterY +=
        height +
        TD.sectionTaskGap +
        taskSpacing * Math.max(own.length, 1) -
        (own.length > 0 ? TD.taskVerticalGap * 2 : 0)
    })
  } else {
    drawPeriods(periods, masterY, 0, true)
  }

  let content: Bounds | undefined
  for (const n of nodes) {
    content = grow(content, n.x, n.y, n.x + n.width, n.y + n.height)
    for (const l of n.lines) {
      const w = textWidth(l)
      content = grow(
        content,
        n.x + n.width / 2 - w / 2,
        n.y,
        n.x + n.width / 2 + w / 2,
        n.y,
      )
    }
  }
  for (const c of connectors) content = grow(content, c.x1, c.y1, c.x2, c.y2)
  const boxWidth = content ? content.x2 - content.x1 : 0
  const bottom = content ? content.y2 : 0
  const axis = {
    x1: timelineX,
    y1: 50 - TD.axisTopOffset,
    x2: timelineX,
    y2: (content ? bottom : 0) + TD.axisBottomPadding,
  }
  return finish(tl, nodes, connectors, axis, boxWidth)
}

/** Lay out a parsed timeline. */
export function layoutTimeline(tl: Timeline): PositionedTimeline {
  return tl.direction === 'TD' ? layoutTD(tl) : layoutLR(tl)
}
