import type {
  PositionedC4Relationship,
  C4Element,
} from '@zombie-mermaid/mermaid-parser'
import { c4RelLabelLines } from '@zombie-mermaid/mermaid-parser'
import { C4, c4TextWidth } from '@zombie-mermaid/core'

// C4 geometry (config, text measurement, shape sizes) is shared with the ASCII
// renderer and lives in @zombie-mermaid/core; this file adds the SVG-only palette
// and label boxes.
export {
  C4,
  C4_TEXT_WIDTH,
  c4Config,
  wrapToWidth,
  c4PersonGeometry,
  c4TextBlockHeight,
  c4DescriptionHeight,
  c4CylinderCap,
  c4QueueCap,
  c4TextWidth,
  c4ShapeSize,
} from '@zombie-mermaid/core'
export type { C4ShapeSize } from '@zombie-mermaid/core'

/** Mermaid's C4 colours by kind and externality. */
export interface C4Palette {
  fill: string
  stroke: string
  text: string
}

export function c4Palette(el: Pick<C4Element, 'kind' | 'external'>): C4Palette {
  const text = '#ffffff'
  if (el.external) {
    switch (el.kind) {
      case 'person':
        return { fill: '#686868', stroke: '#8a8a8a', text }
      case 'system':
        return { fill: '#999999', stroke: '#8a8a8a', text }
      case 'container':
        return { fill: '#b3b3b3', stroke: '#a6a6a6', text }
      case 'component':
        return { fill: '#cccccc', stroke: '#bfbfbf', text }
    }
  }
  switch (el.kind) {
    case 'person':
      return { fill: '#08427b', stroke: '#073b6f', text }
    case 'system':
      return { fill: '#1168bd', stroke: '#3c7fc0', text }
    case 'container':
      return { fill: '#438dd5', stroke: '#3c7fc0', text }
    case 'component':
      return { fill: '#85bbf0', stroke: '#78a8d8', text }
  }
}

/** A relationship label line's box: centre x, centre y, width and height. */
export interface C4LabelBox {
  cx: number
  cy: number
  w: number
  h: number
}

/** Distance between the baselines of a relationship label's lines. */
export const C4_REL_LINE = C4.messageSize + 5

/** The text lines of a positioned relationship's label, wrapped or not. */
export function c4PositionedLabelLines(
  rel: PositionedC4Relationship,
): string[] {
  return rel.labelLines ?? c4RelLabelLines(rel)
}

/** The boxes a positioned relationship's label lines occupy, as drawn. */
export function c4RelLabelBoxes(rel: PositionedC4Relationship): C4LabelBox[] {
  const pos = rel.labelPosition
  if (!pos) return []
  return c4PositionedLabelLines(rel).map((line, i, all) => {
    const isTech = rel.technology !== undefined && i === all.length - 1
    return {
      cx: isTech && rel.technologyX !== undefined ? rel.technologyX : pos.x,
      cy: pos.y + i * C4_REL_LINE,
      w: c4TextWidth(line, C4.messageSize, 400),
      h: C4.messageSize,
    }
  })
}
