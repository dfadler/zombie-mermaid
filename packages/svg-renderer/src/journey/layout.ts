import type {
  Journey,
  PositionedJourney,
  PositionedJourneyTask,
} from '@zombie-mermaid/mermaid-parser'
import { textWidth } from '../timeline/layout.ts'

// ============================================================================
// Journey layout
//
// A port of Mermaid's user-journey renderer (journeyRenderer.ts, svgDraw.js,
// mermaid@12.3.0) with its default `journey` config. All geometry is fixed:
//
//   - the actor legend sits at x=20, rows 20px apart from y=60; its labels
//     wrap at `maxLabelWidth` (360), and the widest line over 75px pushes
//     `leftMargin` (150) right
//   - task `i` is a 150x50 box at x = leftMargin + i * 200, y = 110; its
//     section bar (y = 50) spans the section's tasks
//   - a dashed line runs from each task down to y = 450 with a face on it at
//     y = 300 + (5 - score) * 30
//   - the canvas is `leftMargin + stopx + 100` wide (leftMargin counts twice,
//     as in Mermaid) and `470` tall, +70 under a title; the viewBox starts at
//     y = -25, which is shifted away here so every y is relative to the top.
//
// Text widths come from the Trebuchet table the timeline layout uses (the
// legend measures at the SVG's 16px default font).
// ============================================================================

export const JOURNEY = {
  width: 150,
  height: 50,
  diagramMarginX: 50,
  diagramMarginY: 10,
  leftMargin: 150,
  maxLabelWidth: 360,
  taskMargin: 50,
  legendTop: 60,
  sectionY: 50,
  taskTop: 110,
  lineEnd: 450,
  sections: 7,
  actors: 6,
  /** Mermaid's viewBox starts at y = -25. */
  originY: 25,
} as const

/** Break an actor name into legend lines as Mermaid's `drawActorLegend` does. */
export function wrapLegendLabel(person: string): string[] {
  const max = JOURNEY.maxLabelWidth
  if (textWidth(person) <= max) return [person]
  const lines: string[] = []
  let current = ''
  for (const word of person.split(' ')) {
    const test = current ? `${current} ${word}` : word
    if (textWidth(test) > max) {
      if (current) lines.push(current)
      current = word
      if (textWidth(word) > max) {
        let broken = ''
        for (const ch of word) {
          broken += ch
          if (textWidth(broken + '-') > max) {
            lines.push(broken.slice(0, -1) + '-')
            broken = ch
          }
        }
        current = broken
      }
    } else current = test
  }
  if (current) lines.push(current)
  return lines
}

/** Wrap a task label to the 150px box (the browser wraps Mermaid's HTML label); `<br>` breaks. */
export function wrapTaskLabel(label: string): string[] {
  const lines: string[] = []
  for (const part of label.split(/<br\s*\/?>/i)) {
    let cur = ''
    for (const word of part.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word
      if (cur && textWidth(next) > JOURNEY.width) {
        lines.push(cur)
        cur = word
      } else cur = next
    }
    lines.push(cur)
  }
  return lines
}

export function layoutJourney(journey: Journey): PositionedJourney {
  const J = JOURNEY
  const y0 = J.originY

  // Legend
  const legend: PositionedJourney['legend'] = []
  let maxWidth = 0
  let yPos = J.legendTop
  journey.actors.forEach((actor, pos) => {
    const lines = wrapLegendLabel(actor).map((text, i) => {
      const w = textWidth(text)
      if (w > maxWidth && w > J.leftMargin - w) maxWidth = w
      return { text, x: 50, y: yPos + 7 + i * 20 + y0 }
    })
    legend.push({ cx: 20, cy: yPos + y0, pos, lines })
    yPos += Math.max(20, lines.length * 20)
  })
  const leftMargin = J.leftMargin + maxWidth

  const sections: PositionedJourney['sections'] = []
  const tasks: PositionedJourneyTask[] = []
  let lastSection = ''
  let sectionNumber = 0
  let num = 0
  let stopx = leftMargin
  let stopy = journey.actors.length * 50
  journey.tasks.forEach((task, i) => {
    const x = i * J.taskMargin + i * J.width + leftMargin
    // Mermaid compares against '' initially, so a first task with no
    // section draws no bar.
    if (lastSection !== task.section) {
      num = sectionNumber % J.sections
      let count = 0
      for (let k = i; k < journey.tasks.length; k++) {
        if (journey.tasks[k]!.section === task.section) count++
        else break
      }
      sections.push({
        x,
        y: J.sectionY + y0,
        width: J.width * count + J.diagramMarginX * (count - 1),
        height: J.height,
        text: task.section,
        num,
      })
      lastSection = task.section
      sectionNumber++
    }
    const dots = task.actors.map((actor, k) => ({
      cx: x + 14 + k * 10,
      cy: J.taskTop + y0,
      actor,
      pos: journey.actors.indexOf(actor) % J.actors,
    }))
    tasks.push({
      x,
      y: J.taskTop + y0,
      width: J.width,
      height: J.height,
      lines: wrapTaskLabel(task.name),
      score: task.score,
      num,
      faceY: 300 + (5 - task.score) * 30 + y0,
      lineEndY: J.lineEnd + y0,
      dots,
    })
    stopx = Math.max(stopx, x + J.diagramMarginX + J.taskMargin)
    stopy = Math.max(stopy, J.lineEnd)
  })

  const height = stopy + 2 * J.diagramMarginY
  const width = leftMargin + stopx + 2 * J.diagramMarginX
  const extra = journey.title ? 70 : 0
  return {
    width,
    height: height + extra,
    title: journey.title
      ? { text: journey.title, x: leftMargin, y: 25 + y0 }
      : undefined,
    legend,
    sections,
    tasks,
    axis: {
      x1: leftMargin,
      y1: J.height * 4 + y0,
      x2: width - leftMargin - 4,
      y2: J.height * 4 + y0,
    },
  }
}
