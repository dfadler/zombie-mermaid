/**
 * Break an edge where it crosses a subgraph's title text.
 *
 * Layout treats a subgraph's title bar as plain padding, so an edge that
 * enters a box from above can run straight over the title. mermaid.js draws
 * such an edge through the text as well; here the edge is simply not painted
 * over the text itself, and picks up again on the other side. The edge stays
 * one element with its geometry untouched: a `<mask>` hides the stroke inside
 * the text box (#1239).
 */

import { measureMultilineText } from '@zombie-mermaid/core'
import type {
  PositionedEdge,
  PositionedGroup,
  Point,
} from '@zombie-mermaid/core'
import type { FontSizes } from './styles.ts'
import { FONT_WEIGHTS } from './styles.ts'

/** Left inset of the title text inside the box, matching `renderGroup`. */
const TITLE_TEXT_INSET = 12

/** Space left clear around the title text, in px. */
const GAP_PADDING = 2

export interface TitleTextBox {
  x: number
  y: number
  width: number
  height: number
}

function flattenGroups(groups: PositionedGroup[]): PositionedGroup[] {
  return groups.flatMap((g) => [g, ...flattenGroups(g.children)])
}

/** The rectangle each subgraph's title text occupies, padded by `GAP_PADDING`. */
export function titleTextBoxes(
  groups: PositionedGroup[],
  fontSizes: FontSizes,
): TitleTextBox[] {
  const headerHeight = fontSizes.groupHeader + 16
  return flattenGroups(groups)
    .filter((g) => g.label !== '')
    .map((g) => {
      const text = measureMultilineText(
        g.label,
        fontSizes.groupHeader,
        FONT_WEIGHTS.groupHeader,
      )
      return {
        x: g.x + TITLE_TEXT_INSET - GAP_PADDING,
        y: g.y + headerHeight / 2 - text.height / 2 - GAP_PADDING,
        width: text.width + 2 * GAP_PADDING,
        height: text.height + 2 * GAP_PADDING,
      }
    })
}

/** Whether the segment a-b touches the rectangle (Liang-Barsky clipping). */
function segmentHitsBox(a: Point, b: Point, box: TitleTextBox): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const p = [-dx, dx, -dy, dy]
  const q = [
    a.x - box.x,
    box.x + box.width - a.x,
    a.y - box.y,
    box.y + box.height - a.y,
  ]
  let t0 = 0
  let t1 = 1
  for (let i = 0; i < 4; i++) {
    const pi = p[i]!
    const qi = q[i]!
    if (pi === 0) {
      if (qi < 0) return false
    } else {
      const t = qi / pi
      if (pi < 0) t0 = Math.max(t0, t)
      else t1 = Math.min(t1, t)
      if (t0 > t1) return false
    }
  }
  return true
}

/** The box without its `GAP_PADDING` clearance: the text itself. */
function textOnly(box: TitleTextBox): TitleTextBox {
  return {
    x: box.x + GAP_PADDING,
    y: box.y + GAP_PADDING,
    width: box.width - 2 * GAP_PADDING,
    height: box.height - 2 * GAP_PADDING,
  }
}

/**
 * Whether any segment of `edge` passes through the text of any of the `boxes`.
 * The padding only widens the hole that is cut; an edge that merely passes
 * through the clearance beside the text does not need a gap.
 */
export function edgeCrossesTitle(
  edge: PositionedEdge,
  boxes: TitleTextBox[],
): boolean {
  const pts = edge.points
  const texts = boxes.map(textOnly)
  for (let i = 0; i + 1 < pts.length; i++) {
    if (texts.some((box) => segmentHitsBox(pts[i]!, pts[i + 1]!, box))) {
      return true
    }
  }
  return false
}

/** Small stable hash (FNV-1a) for a mask id that is the same for the same boxes. */
function hashBoxes(boxes: TitleTextBox[]): string {
  let h = 0x811c9dc5
  for (const ch of boxes
    .map((b) => `${b.x},${b.y},${b.width},${b.height}`)
    .join(';')) {
    h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export interface TitleGapMask {
  id: string
  /** The `<mask>` element, for `<defs>`. */
  markup: string
}

/**
 * The mask that hides edge strokes inside `boxes`. The id comes from the box
 * positions, so two inline diagrams never share an id with different content.
 *
 * `maskUnits="userSpaceOnUse"` is required: the default bounding-box units
 * give a straight vertical or horizontal edge a zero-size box, which masks the
 * whole edge away.
 */
export function titleGapMask(
  boxes: TitleTextBox[],
  width: number,
  height: number,
): TitleGapMask {
  const id = `zm-title-gap-${hashBoxes(boxes)}`
  const holes = boxes
    .map(
      (b) =>
        `    <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#000" />`,
    )
    .join('\n')
  const markup =
    `  <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">\n` +
    `    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff" />\n` +
    `${holes}\n` +
    `  </mask>`
  return { id, markup }
}
