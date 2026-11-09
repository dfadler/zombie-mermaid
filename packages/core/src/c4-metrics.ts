import { arialAdvance } from './c4-arial-widths.ts'
import { measureTextWidth } from './text-metrics.ts'

// ============================================================================
// C4 geometry shared by the SVG and ASCII renderers: Mermaid's `c4` config,
// text measurement, and each shape's size. The SVG layout places shapes with
// it, and the ASCII row breaker (`c4-rows.ts`) needs the same widths to wrap
// rows where Mermaid does.
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
   * For text outside printable ASCII, which has no Arial advance table:
   * Arial is about 8% narrower than this package's width estimate (Inter).
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
   * Person proportions, from Mermaid's person shape: the pill's corner is
   * 17.7% of the width (at most 45% of the pill's height), the head's radius
   * is 23% of the width clamped to 16..56, and the head overlaps the pill by
   * 27% of its radius.
   */
  personRx: 0.177,
  personRxMaxOfHeight: 0.45,
  personHeadRatio: 0.23,
  personHeadMin: 16,
  personHeadMax: 56,
  personHeadOverlap: 0.27,
  /** Cylinder height lost where its text block meets the lower ellipse. */
  dbTrim: 3.91,
  /** Queue height over its text block. */
  queueExtra: 10,
} as const

/**
 * `%%{init: {"c4": {...}}}%%` keys that change mermaid 12.3.0's output, in its
 * own units: `diagramMarginX/Y`, `c4ShapeMargin` (as `shapeMargin`),
 * `c4ShapePadding` (as `shapePadding`), `width` (a shape's minimum width),
 * `nextLinePaddingX` and `wrap` (false stops names, descriptions and
 * relationship labels from wrapping).
 */
export interface C4InitLayout {
  diagramMarginX?: number
  diagramMarginY?: number
  shapeMargin?: number
  shapePadding?: number
  width?: number
  nextLinePaddingX?: number
  wrap?: boolean
}

/** {@link C4} with a diagram's `c4` init keys applied. */
export type C4Config = { -readonly [K in keyof typeof C4]: number } & {
  wrap: boolean
  /** Width element text wraps to: `width` less the padding both sides. */
  textWidth: number
}

/** The C4 geometry for a diagram: the defaults, then its init keys. */
export function c4Config(layout?: C4InitLayout): C4Config {
  const cfg = { ...C4, wrap: true, ...layout } as C4Config
  cfg.textWidth = cfg.width - 2 * cfg.shapePadding
  return cfg
}

/**
 * Width the text of an element wraps to: the shape's width less its padding
 * on both sides (Mermaid's `c4LabelHelper`).
 */
export const C4_TEXT_WIDTH = C4.width - 2 * C4.shapePadding

/**
 * Greedy word wrap by estimated pixel width. Mermaid decides where to break
 * with the text at regular weight and draws a name in bold afterwards, so a
 * bold name can come out wider than the limit.
 */
export function wrapToWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let cur = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word
      if (cur && c4TextWidth(next, fontSize, 400) > maxWidth) {
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

/**
 * A person's pill corner, head radius and pill top for a box of this width
 * (and, when known, this height: a short pill gets smaller corners).
 */
export function c4PersonGeometry(
  width: number,
  height?: number,
): {
  rx: number
  headRadius: number
  pillTop: number
} {
  const headRadius = Math.min(
    Math.max(width * C4.personHeadRatio, C4.personHeadMin),
    C4.personHeadMax,
  )
  // The head's diameter less the part that overlaps the pill.
  const pillTop = headRadius * (2 - C4.personHeadOverlap)
  const pillHeight = height === undefined ? Infinity : height - pillTop
  return {
    rx: Math.min(width * C4.personRx, pillHeight * C4.personRxMaxOfHeight),
    headRadius,
    pillTop,
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

/**
 * Estimated width of a text line as Mermaid would measure it: sans-serif
 * advances for printable ASCII, this package's own estimate (scaled to match)
 * for anything else.
 */
export function c4TextWidth(
  text: string,
  fontSize: number,
  weight: number,
): number {
  let width = 0
  for (const ch of text) {
    const em = arialAdvance(ch, weight >= 600)
    width +=
      em === undefined
        ? measureTextWidth(ch, fontSize, weight) * C4.textScale
        : em * fontSize
  }
  return width
}

/**
 * The size Mermaid gives an element: the standard width unless its text is
 * wider (then the text plus padding both sides), and a height that follows
 * its wrapped text lines.
 */
export function c4ShapeSize(
  el: { kind: string; shape?: string },
  nameLines: number,
  descriptionLines: number,
  textWidth: number,
  cfg: C4Config = c4Config(),
): C4ShapeSize {
  const textHeight = c4TextBlockHeight(nameLines, descriptionLines)
  const boxHeight = textHeight + 2 * cfg.shapePadding
  const width = Math.max(cfg.width, textWidth + 2 * cfg.shapePadding)
  if (el.kind === 'person') {
    return {
      width,
      // The head rises above the pill, which is as tall as the text needs.
      height: c4PersonGeometry(width).pillTop + boxHeight,
      textHeight,
    }
  }
  if (el.shape === 'db') {
    const { ry } = c4CylinderCap(width)
    // Measured in mermaid 12.3.0: a db grows by 1px per px of padding (not 2),
    // and a queue by half a px, so each is scaled against the default.
    const height = textHeight + cfg.shapePadding + 20 + 2 * ry - C4.dbTrim
    return { width, height, textHeight }
  }
  if (el.shape === 'queue') {
    const height =
      textHeight + C4.queueExtra + (cfg.shapePadding - C4.shapePadding) / 2
    const { rx } = c4QueueCap(height)
    return { width: width + 3 * rx, height, textHeight }
  }
  return { width, height: boxHeight, textHeight }
}
