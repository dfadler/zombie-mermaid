// ============================================================================
// Use case diagram node geometry (mermaid@12.3.0, default look)
//
// Mermaid hands a usecase diagram to the flowchart's dagre layout with its own
// node shapes, sized as measured:
//   - a use case ellipse is 160px wide (the 120px label box plus 20px each side)
//     and 40px taller than its 12px label lines (18px each)
//   - a rectangular use case is the label box plus 32px, and 24px taller
//   - an actor is a 64px stick figure over a 14px label, 10px padding all
//     round: at least 76px wide, 121px tall
//   - a note is 120px of 16px label plus 20px each way
// A label wraps at 120px, as a flowchart label does.
// ============================================================================

import { FLOWCHART_WRAP_WIDTH } from '../layout-engine/wrap-label.ts'
import { textWidth as advance } from '../timeline/layout.ts'
import { trebuchetKerning } from '../requirement/kerning.ts'

/** Text width as Chromium measures it: Trebuchet MS advances plus kerning. */
const textWidth = (text: string, size: number): number =>
  advance(text, size) + trebuchetKerning(text, false) * (size / 16)

export const USECASE = {
  /** Font sizes of an actor's name, a use case's label and a note. */
  actorFont: 14,
  caseFont: 12,
  noteFont: 16,
  /** The label box is never narrower than this (`usecase.minNodeWidth`). */
  minLabelWidth: 120,
  actorMinWidth: 76,
  actorHeight: 121,
  actorPad: 10,
  /** Where the stick figure's parts sit below the node's top edge. */
  headY: 22,
  headR: 12,
  torsoTop: 34,
  torsoBottom: 54,
  armsY: 41,
  armsHalf: 17,
  legsHalf: 15,
  legsBottom: 74,
} as const

export function isUsecaseShape(shape: string): boolean {
  return (
    shape === 'usecase-actor' ||
    shape === 'usecase-ellipse' ||
    shape === 'usecase-rect' ||
    shape === 'usecase-note'
  )
}

/**
 * The label text of a use case node, wrapped at 120px as Mermaid wraps it:
 * greedy at word boundaries, a word wider than that stays whole.
 */
export function usecaseLabelText(shape: string, label: string): string {
  const size = fontOf(shape)
  const out: string[] = []
  for (const para of label.split('\n')) {
    let cur = ''
    for (const word of para.split(' ').filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word
      if (cur && textWidth(next, size) > FLOWCHART_WRAP_WIDTH) {
        out.push(cur)
        cur = word
      } else cur = next
    }
    out.push(cur)
  }
  return out.join('\n')
}

export function fontOf(shape: string): number {
  return shape === 'usecase-actor'
    ? USECASE.actorFont
    : shape === 'usecase-note'
      ? USECASE.noteFont
      : USECASE.caseFont
}

/** Line height of a label: the font size at 1.5. */
export const lineHeight = (shape: string): number => fontOf(shape) * 1.5

export function usecaseNodeSize(
  shape: string,
  label: string,
): { width: number; height: number } {
  const lines = usecaseLabelText(shape, label).split('\n')
  const font = fontOf(shape)
  let widest = Math.max(...lines.map((l) => textWidth(l, font)))
  // A wrapped label's box is the full wrapping width, as in a flowchart.
  if (lines.length > label.split('\n').length)
    widest = Math.max(widest, FLOWCHART_WRAP_WIDTH)
  const box = Math.max(widest, USECASE.minLabelWidth)
  const rows = lines.length * lineHeight(shape)
  switch (shape) {
    case 'usecase-ellipse':
      return { width: box + 40, height: rows + 40 }
    case 'usecase-note':
      return { width: box + 20, height: rows + 20 }
    case 'usecase-actor':
      return {
        width: Math.max(widest + 2 * USECASE.actorPad, USECASE.actorMinWidth),
        height: USECASE.actorHeight + (lines.length - 1) * lineHeight(shape),
      }
    default:
      return { width: box + 32, height: rows + 24 }
  }
}
