// ============================================================================
// Event modeling layout
//
// Turns a parsed EventModeling into Mermaid 12.3.0's geometry (packages/
// mermaid/src/diagrams/eventmodeling/db.ts), step for step:
//
//   - a frame goes in the swimlane its type and namespace pick: UI and
//     processors on top (index 0), commands and read models next (100),
//     events last (200); a namespaced frame opens a lane of its own, labelled
//     "UI/A: ns", "C/RM: ns" or "Stream: ns" (Mermaid never finds an existing
//     lane by namespace, so two frames of one namespace get two lanes)
//   - a box is its text size + 20px of padding, kept between 80 and 450px wide
//     and 80 and 750px high, then + 20px; boxes start at x = 250
//   - a box follows the one before it, overlapping its right edge by 90px less
//     the 10px gap, or follows the last box of its own lane
//   - a lane is 70px high at the least, 30px more than its tallest box, with
//     10px between lanes; every lane is as wide as the rightmost box + 15px
//   - an arrow goes from the box 2/3 along its source to 1/3 along its
//     target, bottom to top (or top to bottom going up); a frame points at
//     the nearest earlier frame of another lane unless it is a reset frame, or
//     at every frame it names after `->>`
//   - the viewBox is the drawing plus 30px all round
//
// Mermaid measures `<b>Name</b><br/><br/><code>data</code>` as text in the
// browser; text widths here are Trebuchet MS bold advances plus kerning (the
// measured string is literal, tags and `&nbsp;` included) and every line is
// 19px high. Mermaid's colours do not carry over (see ./renderer.ts).
// ============================================================================

import type {
  EventModeling,
  EventModelingFrame,
  PositionedEventModeling,
  PositionedEventModelingBox,
  PositionedEventModelingLane,
  PositionedEventModelingRelation,
} from '@zombie-mermaid/mermaid-parser'
import { textWidth as advanceWidth } from '../timeline/layout.ts'
import { trebuchetKerning } from '../requirement/kerning.ts'

/** Mermaid's `diagramProps`. */
export const EVENTMODELING = {
  swimlaneMinHeight: 70,
  swimlanePadding: 15,
  swimlaneGap: 10,
  boxPadding: 10,
  boxOverlap: 90,
  boxMinWidth: 80,
  boxMaxWidth: 450,
  boxMinHeight: 80,
  boxMaxHeight: 750,
  contentStartX: 250,
  textMaxWidth: 430,
  /** Height of one measured line of 16px bold text. */
  lineHeight: 19,
  viewBoxPadding: 30,
  labelUiAutomation: 'UI/Automation',
  labelUiAutomationPrefix: 'UI/A: ',
  labelCommandReadModel: 'Command/Read Model',
  labelCommandReadModelPrefix: 'C/RM: ',
  labelEvents: 'Events',
  labelEventsPrefix: 'Stream: ',
} as const

/** Width of `text` as the browser measures it: bold 16px, rounded, spaces collapsed. */
export function measure(text: string): number {
  const t = text.replace(/\s+/g, ' ').trim()
  return Math.round(advanceWidth(t, 16, true) + trebuchetKerning(t, true))
}

/** Mermaid's `breakString`: cut a word into hyphenated pieces under `maxWidth`. */
function breakString(
  word: string,
  maxWidth: number,
): { pieces: string[]; rest: string } {
  const chars = [...word]
  const pieces: string[] = []
  let line = ''
  chars.forEach((ch, i) => {
    const next = line + ch
    if (measure(next) >= maxWidth) {
      pieces.push(i + 1 === chars.length ? next : `${next}-`)
      line = ''
    } else line = next
  })
  return { pieces, rest: line }
}

/** Mermaid's `wrapLabel` (joined with `<br/>`); text that holds a break is left alone. */
export function wrapLabel(label: string, maxWidth: number): string {
  if (!label || /<br\s*\/?>/i.test(label)) return label
  const words = label.split(' ').filter(Boolean)
  const done: string[] = []
  let next = ''
  words.forEach((word, i) => {
    const wordLength = measure(`${word} `)
    if (wordLength > maxWidth) {
      const { pieces, rest } = breakString(word, maxWidth)
      done.push(next, ...pieces)
      next = rest
    } else if (measure(next) + wordLength >= maxWidth) {
      done.push(next)
      next = word
    } else next = [next, word].filter(Boolean).join(' ')
    if (i + 1 === words.length) done.push(next)
  })
  return done.filter((l) => l !== '').join('<br/>')
}

/** The text of a frame's data as Mermaid builds it, or undefined for a frame with none. */
function dataHtml(
  frame: EventModelingFrame,
  diagram: EventModeling,
): string | undefined {
  const cut = (s: string, from: number): string => {
    const rest = s.slice(from)
    return rest.slice(0, Math.max(0, rest.lastIndexOf('}') - 1))
  }
  const finish = (s: string): string =>
    wrapLabel(s, EVENTMODELING.textMaxWidth).replaceAll(' ', '&nbsp;')
  let html: string | undefined
  if (frame.dataInline !== undefined)
    html = finish(cut(frame.dataInline, frame.dataInline.indexOf('{') + 1))
  const block = diagram.dataBlocks.find((b) => b.name === frame.dataRef)
  if (block !== undefined)
    html = `${finish(cut(block.value, block.value.indexOf('{\n') + 2))}<br/>`
  return html
}

interface Lane extends PositionedEventModelingLane {
  /** Right edge of its last box. */
  r: number
  maxHeight: number
}

interface Box {
  frame: EventModelingFrame
  x: number
  r: number
  width: number
  height: number
  lane: Lane
  nameLines: string[]
  dataLines: string[]
}

function laneProps(
  frame: EventModelingFrame,
  lanes: Record<number, Lane>,
): { index: number; label: string } {
  const E = EVENTMODELING
  const next = (min: number, max: number): number =>
    Math.max(
      min,
      ...Object.keys(lanes)
        .map(Number)
        .filter((k) => k > min && k < max),
    ) + 1
  const ns = frame.namespace
  switch (frame.entityType) {
    case 'ui':
    case 'processor':
      return ns
        ? { index: next(0, 100), label: E.labelUiAutomationPrefix + ns }
        : { index: 0, label: E.labelUiAutomation }
    case 'readmodel':
    case 'command':
      return ns
        ? { index: next(100, 200), label: E.labelCommandReadModelPrefix + ns }
        : { index: 100, label: E.labelCommandReadModel }
    default:
      return ns
        ? { index: next(200, 300), label: E.labelEventsPrefix + ns }
        : { index: 200, label: E.labelEvents }
  }
}

/** Lay out a diagram as Mermaid does. */
export function layoutEventModeling(
  diagram: EventModeling,
): PositionedEventModeling {
  const E = EVENTMODELING
  const lanes: Record<number, Lane> = {}
  const boxes: Box[] = []
  const relations: PositionedEventModelingRelation[] = []
  let previous: Lane | undefined
  let maxR = 0
  const sorted = (): Lane[] =>
    Object.values(lanes).sort((a, b) => a.index - b.index)

  diagram.frames.forEach((frame, index) => {
    // Text, as Mermaid's calculateTextProps measures it.
    const name = wrapLabel(frame.name, E.textMaxWidth)
    const data = dataHtml(frame, diagram)
    let content = `<b>${name}</b>`
    if (data !== undefined)
      content += `<br/><br/><code style="text-align: left; display: block;max-width:${E.textMaxWidth}px">${data}</code>`
    const lines = content.split(/<br\s*\/?>/i)
    const textWidth = Math.max(...lines.map(measure))
    const textHeight = lines.length * E.lineHeight
    const boxWidth =
      Math.max(
        E.boxMinWidth,
        Math.min(
          E.boxMaxWidth,
          (data !== undefined ? textWidth / 3 : textWidth) + 2 * E.boxPadding,
        ),
      ) +
      2 * E.boxPadding
    const boxHeight =
      Math.max(
        E.boxMinHeight,
        Math.min(E.boxMaxHeight, textHeight + 2 * E.boxPadding),
      ) +
      2 * E.boxPadding

    const props = laneProps(frame, lanes)
    const lane: Lane = lanes[props.index] ?? {
      index: props.index,
      label: props.label,
      y: props.index * E.swimlaneMinHeight + E.swimlaneGap,
      height: E.swimlaneMinHeight,
      r: 0,
      maxHeight: E.swimlaneMinHeight,
    }
    const last = boxes[boxes.length - 1]
    let x = E.contentStartX
    if (previous !== undefined) {
      if (previous.index === lane.index && lane.r) x = lane.r + E.boxPadding
      else if (last !== undefined) x = last.r - E.boxOverlap + E.boxPadding
    }
    const r = x + boxWidth + E.boxPadding
    lanes[lane.index] = lane
    maxR = Math.max(...sorted().map((l) => l.r), r)
    lane.r = x + boxWidth
    lane.maxHeight = Math.max(lane.maxHeight, boxHeight)
    lane.height =
      Math.max(E.swimlaneMinHeight, lane.maxHeight) + 2 * E.swimlanePadding
    previous = lane

    // Drawn data keeps its spaces unbreakable (non-breaking), as the HTML does.
    const shown = data?.replace(/<br\/>$/, '')
    const dataLines =
      shown === undefined || shown === ''
        ? []
        : shown
            .split('<br/>')
            .map((l) => l.replace(/\s+/g, ' ').replaceAll('&nbsp;', '\u00a0'))
    boxes.push({
      frame,
      x,
      r,
      width: boxWidth,
      height: boxHeight,
      lane,
      nameLines: name.split('<br/>'),
      dataLines,
    })

    // Lanes stack in index order from the top.
    const all = sorted()
    all[0]!.y = 0
    for (let i = 1; i < all.length; i++)
      all[i]!.y = all[i - 1]!.y + all[i - 1]!.height + E.swimlaneGap

    // Arrows into this box, from boxes that exist by now.
    const target = boxes[index]!
    const arrow = (source: Box | undefined): void => {
      if (source !== undefined)
        relations.push({
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
          from: boxes.indexOf(source),
          to: index,
        })
    }
    if (frame.sources.length > 0) {
      for (const f of diagram.frames)
        if (frame.sources.includes(f.id))
          arrow(boxes.find((b) => b.frame === f))
    } else if (!frame.reset && index > 0) {
      for (let i = index - 1; i >= 0; i--)
        if (boxes[i]!.lane.index !== target.lane.index) {
          arrow(boxes[i])
          break
        }
    }
  })

  const ordered = sorted()
  const E2 = EVENTMODELING
  const laneIndex = new Map(ordered.map((l, i) => [l, i]))
  const positioned: PositionedEventModelingBox[] = boxes.map((b) => ({
    frame: b.frame,
    x: b.x,
    y: b.lane.y + E2.swimlanePadding,
    width: b.width,
    height: b.height,
    lane: laneIndex.get(b.lane)!,
    nameLines: b.nameLines,
    dataLines: b.dataLines,
  }))
  for (const rel of relations) {
    const s = positioned[rel.from]!
    const t = positioned[rel.to]!
    const up = s.y > t.y
    rel.x1 = s.x + (s.width * 2) / 3
    rel.x2 = t.x + t.width / 3
    rel.y1 = up ? s.y : s.y + s.height
    rel.y2 = up ? t.y + t.height : t.y
  }
  const bottom = ordered.length
    ? ordered[ordered.length - 1]!.y + ordered[ordered.length - 1]!.height
    : 0
  const laneWidth = ordered.length ? maxR + E2.swimlanePadding : 0
  const pad = E2.viewBoxPadding
  return {
    viewBox: {
      x: -pad,
      y: -pad,
      width: laneWidth + 2 * pad,
      height: bottom + 2 * pad,
    },
    lanes: ordered.map(({ index, label, y, height }) => ({
      index,
      label,
      y,
      height,
    })),
    laneWidth,
    boxes: positioned,
    relations,
  }
}
