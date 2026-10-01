import type { C4Element } from '@zombie-mermaid/mermaid-parser'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// C4 SVG geometry, shared by the layout (which sizes and places shapes) and
// the renderer (which draws text and glyphs inside them), so the two can't
// drift.
//
// The numbers follow Mermaid 11.17's C4 renderer: its default `c4` config for
// spacing, and sizes fitted to what it draws for each shape (a fixed 216px
// width, 20px padding, a 14px name, a 0.75em type line and a 0.82em
// description). Text is measured with this package's own width estimate
// instead of the browser, so sizes agree with Mermaid's to within a few pixels.
// ============================================================================

export const C4 = {
  // Mermaid's default `c4` config.
  width: 216,
  diagramMarginX: 50,
  diagramMarginY: 10,
  shapeMargin: 50,
  shapePadding: 20,
  shapeInRow: 4,
  boundaryInRow: 2,
  nextLinePaddingX: 0,
  /**
   * Mermaid limits a row to the browser's `screen.availWidth`, which a server
   * cannot know; a common desktop width keeps the output stable.
   */
  screenWidth: 1440,
  // Text.
  nameSize: 14,
  typeSize: 10.5,
  descrSize: 11.5,
  messageSize: 12,
  boundarySize: 14,
  // Line heights fitted to Mermaid: one more name line adds 15.35px, and a
  // name plus its type line make 31.07px; each description line adds 17.1px.
  nameLine: 15.35,
  typeLine: 15.72,
  descrLine: 17.1,
  /** Each wrapped description line after the first (one `1.1em` row). */
  descrExtraLine: 12.48,
  /**
   * Mermaid's text is about 8% narrower than this package's width estimate
   * (its font is Open Sans, this package's is Inter); fitted on a measured
   * name.
   */
  textScale: 0.922,
  // Heights Mermaid measures for a boundary's heading text (fitted): the
  // title at 16px bold, the `[type]` at 14px, a description at 12px.
  boundaryLabelHeight: 18,
  boundaryTypeHeight: 16.1,
  boundaryDescrHeight: 14.4,
  /** Height Mermaid reserves for the unnamed root boundary's heading. */
  rootHeadingHeight: 47,
  /** Extra height added to a diagram with a title (Mermaid's `extraVertForTitle`). */
  titleExtra: 60,
  // Shapes.
  cornerRadius: 12,
  strokeWidth: 2,
  /**
   * Person proportions at the standard width (Mermaid scales the pill's
   * corners and head with the width, and the head's rise a little faster).
   */
  personRx: 38.232,
  personHeadRadius: 49.68,
  /** Distance from the top of a person to the top of its pill (under the head). */
  personPillTop: 85.946,
  personPillTopPerExtraWidth: 0.4,
  /** Cylinder height lost where its text block meets the lower ellipse. */
  dbTrim: 3.91,
  /** Queue height over its text block. */
  queueExtra: 10,
} as const

/**
 * Width the text of an element wraps to. Fitted to Mermaid: a 173px name
 * stays on one line and a 231px one wraps, and a 188px name stays on one.
 */
export const C4_TEXT_WIDTH = C4.width - C4.shapePadding

/** Greedy word wrap by estimated pixel width. */
export function wrapToWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
  weight: number,
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let cur = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word
      if (
        cur &&
        estimateTextWidth(next, fontSize, weight) * C4.textScale > maxWidth
      ) {
        lines.push(cur)
        cur = word
      } else {
        cur = next
      }
    }
    lines.push(cur)
  }
  return lines
}

/** A person's pill corner, head radius and pill top for a box of this width. */
export function c4PersonGeometry(width: number): {
  rx: number
  headRadius: number
  pillTop: number
  /** How far the whole figure is drawn below its layout box. */
  drop: number
} {
  const scale = width / C4.width
  return {
    rx: C4.personRx * scale,
    headRadius: C4.personHeadRadius * scale,
    pillTop:
      C4.personPillTop + C4.personPillTopPerExtraWidth * (width - C4.width),
    drop: (C4.personPillTopPerExtraWidth * (width - C4.width)) / 2,
  }
}

export interface C4ShapeSize {
  width: number
  height: number
  /** Height of the text block (name, type, description lines). */
  textHeight: number
}

/** Height of an element's text block for its wrapped lines. */
export function c4TextBlockHeight(
  nameLines: number,
  descriptionLines: number,
): number {
  return (
    nameLines * C4.nameLine +
    C4.typeLine +
    c4DescriptionHeight(descriptionLines)
  )
}

/** Height of a description wrapped to this many lines. */
export function c4DescriptionHeight(lines: number): number {
  return lines === 0 ? 0 : C4.descrLine + (lines - 1) * C4.descrExtraLine
}

/** Cylinder cap radii for a box of this width: `rx` across, `ry` down. */
export function c4CylinderCap(width: number): { rx: number; ry: number } {
  const rx = width / 2
  return { rx, ry: rx / (2.5 + width / 50) }
}

/** Queue cap radii for a pipe of this height: `rx` across, `ry` down. */
export function c4QueueCap(height: number): { rx: number; ry: number } {
  const ry = height / 2
  return { rx: ry / (2.5 + height / 50), ry }
}

/** Estimated width of a text line as Mermaid would measure it. */
export function c4TextWidth(
  text: string,
  fontSize: number,
  weight: number,
): number {
  return estimateTextWidth(text, fontSize, weight) * C4.textScale
}

/**
 * The size Mermaid gives an element: the standard width unless its text is
 * wider (then the text plus padding both sides), and a height that follows
 * its wrapped text lines.
 */
export function c4ShapeSize(
  el: Pick<C4Element, 'kind' | 'shape'>,
  nameLines: number,
  descriptionLines: number,
  textWidth: number,
): C4ShapeSize {
  const textHeight = c4TextBlockHeight(nameLines, descriptionLines)
  const boxHeight = textHeight + 2 * C4.shapePadding
  const width = Math.max(C4.width, textWidth + 2 * C4.shapePadding)
  if (el.kind === 'person') {
    return {
      width,
      // Mermaid lays rows out with the standard rise; a wider person is only
      // drawn a little lower (see `c4PersonGeometry`).
      height: C4.personPillTop + boxHeight,
      textHeight,
    }
  }
  if (el.shape === 'db') {
    const { ry } = c4CylinderCap(width)
    return { width, height: boxHeight + 2 * ry - C4.dbTrim, textHeight }
  }
  if (el.shape === 'queue') {
    const height = textHeight + C4.queueExtra
    const { rx } = c4QueueCap(height)
    return { width: width + 3 * rx, height, textHeight }
  }
  return { width, height: boxHeight, textHeight }
}

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
