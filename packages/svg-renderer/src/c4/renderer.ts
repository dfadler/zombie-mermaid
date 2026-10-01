import type {
  PositionedC4Boundary,
  PositionedC4Diagram,
  PositionedC4Element,
  PositionedC4Relationship,
} from '@zombie-mermaid/mermaid-parser'
import {
  c4BoundaryTypeLine,
  c4RelLabelLines,
  c4TypeLine,
} from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, Point, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  escapeXml,
  escapeAttr,
  f,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { FONT_SIZES, TEXT_BASELINE_SHIFT } from '../styles.ts'
import type { FontSizes } from '../styles.ts'
import {
  C4,
  c4CylinderCap,
  c4DescriptionHeight,
  c4Palette,
  c4PersonGeometry,
  c4QueueCap,
  c4TextBlockHeight,
} from './metrics.ts'
import type { C4Palette } from './metrics.ts'

// ============================================================================
// C4 diagram SVG renderer, drawn the way Mermaid draws C4.
//
// Render order (as in Mermaid): boundaries, elements, then relationships,
// each with its label on top. Elements use Mermaid's C4 colours and stay
// fixed across themes, as C4 colours carry meaning; boundaries, lines and
// labels follow the theme's CSS variables.
// ============================================================================

/**
 * Render a positioned C4 diagram as an SVG string. Parameters mirror
 * `renderErSvg`; see there for the `embedSource` / `title` / `decorative` /
 * `emit` contract.
 */
export function renderC4Svg(
  diagram: PositionedC4Diagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  _fontSizes: FontSizes = FONT_SIZES,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []
  parts.push(
    withDataSrc(
      svgOpenTag(
        diagram.width,
        diagram.height,
        colors,
        transparent,
        title ?? diagram.title,
        decorative,
        undefined,
        emit.styleAttribute,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, false, emit.nonce))

  if (diagram.title && diagram.titlePosition) {
    // Mermaid sets the title as plain text at its start point.
    parts.push(
      f`<text class="c4-title" x="${diagram.titlePosition.x}" y="${diagram.titlePosition.y}" dy="${TEXT_BASELINE_SHIFT}" ` +
        f`font-size="16" fill="var(--_text)">${escapeXml(diagram.title)}</text>`,
    )
  }

  for (const b of diagram.boundaries) parts.push(renderBoundary(b))
  for (const el of diagram.elements) parts.push(renderElement(el))
  for (const r of diagram.relationships) {
    parts.push(renderRelationshipLine(r))
    parts.push(renderRelationshipLabel(r))
  }

  parts.push('</svg>')
  return parts.filter(Boolean).join('\n')
}

// ---------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------

/** One centred line of text. */
function centred(
  text: string,
  x: number,
  y: number,
  size: number,
  extra: string,
): string {
  return (
    f`  <text x="${x}" y="${y}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" font-size="${size}" ` +
    f`${extra}>${escapeXml(text)}</text>`
  )
}

function renderBoundary(b: PositionedC4Boundary): string {
  const parts: string[] = []
  parts.push(
    f`<g class="c4-boundary" data-id="${escapeAttr(b.alias)}" data-label="${escapeAttr(b.label)}" data-depth="${b.depth}">`,
  )
  // A dashed square-cornered frame with no fill, as Mermaid draws it.
  parts.push(
    f`  <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="2.5" ry="2.5" ` +
      `fill="none" stroke="var(--_text)" stroke-width="1" stroke-dasharray="7,7" />`,
  )
  const cx = b.x + b.width / 2
  parts.push(
    centred(
      b.label,
      cx,
      b.y + (b.labelY ?? 8),
      C4.boundarySize + 2,
      'font-weight="700" fill="var(--_text)"',
    ),
  )
  const typeLine = c4BoundaryTypeLine({
    alias: b.alias,
    label: b.label,
    ...(b.type ? { type: b.type } : {}),
    elementAliases: [],
    children: [],
  })
  if (typeLine && b.typeY !== undefined) {
    parts.push(
      centred(
        typeLine,
        cx,
        b.y + b.typeY,
        C4.boundarySize,
        'fill="var(--_text)"',
      ),
    )
  }
  if (b.description && b.descrY !== undefined) {
    parts.push(
      centred(
        b.description,
        cx,
        b.y + b.descrY,
        C4.boundarySize - 2,
        'fill="var(--_text)"',
      ),
    )
  }
  parts.push('</g>')
  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

function renderElement(el: PositionedC4Element): string {
  const pal = c4Palette(el)
  const { x, y, width: w, height: h } = el
  const cx = x + w / 2
  const textH = c4TextBlockHeight(
    el.nameLines.length,
    el.descriptionLines.length,
  )
  const parts: string[] = []
  parts.push(
    f`<g class="c4-element" data-id="${escapeAttr(el.alias)}" data-kind="${el.kind}" data-shape="${el.shape}" ` +
      f`data-external="${el.external}" data-label="${escapeAttr(el.label)}">`,
  )

  // Where the text block starts, and the x it is centred on.
  let top: number
  let textCx = cx
  if (el.kind === 'person') {
    parts.push(...personShape(el, pal))
    const g = c4PersonGeometry(w)
    top = y + g.drop + g.pillTop + C4.shapePadding
  } else if (el.shape === 'db') {
    parts.push(...cylinderShape(el, pal))
    const { ry } = c4CylinderCap(w)
    // Centred in the body below the upper ellipse.
    top = y + (2 * ry + h) / 2 - textH / 2
  } else if (el.shape === 'queue') {
    parts.push(...queueShape(el, pal))
    const { rx } = c4QueueCap(h)
    // Mermaid centres the text one cap radius left of the pipe's centre.
    textCx = cx - rx
    top = y + h / 2 - textH / 2
  } else {
    parts.push(
      f`  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${C4.cornerRadius}" ry="${C4.cornerRadius}" ` +
        f`fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="${C4.strokeWidth}" />`,
    )
    top = y + C4.shapePadding
  }

  let cursor = top
  for (const line of el.nameLines) {
    parts.push(
      centred(
        line,
        textCx,
        cursor + C4.nameLine / 2,
        C4.nameSize,
        f`font-weight="700" fill="${pal.text}"`,
      ),
    )
    cursor += C4.nameLine
  }
  parts.push(
    centred(
      c4TypeLine(el),
      textCx,
      cursor + C4.typeLine / 2,
      C4.typeSize,
      f`fill="${pal.text}"`,
    ),
  )
  cursor += C4.typeLine
  el.descriptionLines.forEach((line, i) => {
    // The first line is as tall as Mermaid measures a one-line text; each
    // wrapped line after it is one `1.1em` row.
    parts.push(
      centred(
        line,
        textCx,
        cursor + C4.descrLine / 2 + i * C4.descrExtraLine,
        C4.descrSize,
        f`fill="${pal.text}"`,
      ),
    )
  })
  cursor += c4DescriptionHeight(el.descriptionLines.length)
  parts.push('</g>')
  return parts.join('\n')
}

/** A rounded pill with a round head rising out of its top, as Mermaid draws a person. */
function personShape(el: PositionedC4Element, pal: C4Palette): string[] {
  const { x, width: w } = el
  const { rx, headRadius, pillTop: rise, drop } = c4PersonGeometry(w)
  const y = el.y + drop
  const cx = x + w / 2
  const pillTop = y + rise
  const pillHeight = el.y + el.height - pillTop
  const style = f`fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="${C4.strokeWidth}"`
  return [
    f`  <rect x="${x}" y="${pillTop}" width="${w}" height="${pillHeight}" rx="${rx}" ry="${rx}" ${style} />`,
    f`  <circle cx="${cx}" cy="${y + headRadius}" r="${headRadius}" ${style} />`,
  ]
}

function cylinderShape(el: PositionedC4Element, pal: C4Palette): string[] {
  const { x, y, width: w, height: h } = el
  const { rx, ry } = c4CylinderCap(w)
  const style = f`fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="${C4.strokeWidth}"`
  return [
    f`  <path d="M ${x} ${y + ry} L ${x} ${y + h - ry} A ${rx} ${ry} 0 0 0 ${x + w} ${y + h - ry} L ${x + w} ${y + ry} Z" ${style} />`,
    f`  <ellipse cx="${x + rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" ${style} />`,
  ]
}

/**
 * A pipe on its side, as Mermaid draws it: rounded at the left, with the
 * ellipse face showing at the right end.
 */
function queueShape(el: PositionedC4Element, pal: C4Palette): string[] {
  const { x, y, width: w, height: h } = el
  const { rx, ry } = c4QueueCap(h)
  const style = f`fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="${C4.strokeWidth}"`
  return [
    f`  <path d="M ${x + w - rx} ${y} H ${x + rx} A ${rx} ${ry} 0 0 0 ${x + rx} ${y + h} H ${x + w - rx} Z" ${style} />`,
    f`  <ellipse cx="${x + w - rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" ${style} />`,
  ]
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

/** Mermaid's arrowhead: a 10 by 10 triangle whose tip sits on the line's end. */
function arrowHead(tip: Point, from: Point): string {
  const dx = tip.x - from.x
  const dy = tip.y - from.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return ''
  const ux = dx / len
  const uy = dy / len
  const L = 10
  const W = 5
  const bx = tip.x - ux * L
  const by = tip.y - uy * L
  return (
    f`<polygon class="c4-arrowhead" points="${tip.x},${tip.y} ${bx - uy * W},${by + ux * W} ${bx + uy * W},${by - ux * W}" ` +
    `fill="var(--_text)" />`
  )
}

function renderRelationshipLine(rel: PositionedC4Relationship): string {
  const [start, end] = [rel.points[0], rel.points[rel.points.length - 1]]
  if (!start || !end || start === end) return ''
  const attrs = [
    'class="c4-relationship"',
    f`data-from="${escapeAttr(rel.from)}"`,
    f`data-to="${escapeAttr(rel.to)}"`,
  ]
  if (rel.label) attrs.push(f`data-label="${escapeAttr(rel.label)}"`)
  if (rel.technology) {
    attrs.push(f`data-technology="${escapeAttr(rel.technology)}"`)
  }
  const d = rel.curve
    ? f`M ${start.x},${start.y} Q ${rel.curve.x},${rel.curve.y} ${end.x},${end.y}`
    : f`M ${start.x},${start.y} L ${end.x},${end.y}`
  const line = f`<path ${attrs.join(' ')} d="${d}" fill="none" stroke="var(--_text)" stroke-width="1" />`
  // A curve leaves and arrives along its control point.
  const beforeEnd = rel.curve ?? start
  const afterStart = rel.curve ?? end
  const endHead = arrowHead(end, beforeEnd)
  const startHead = arrowHead(start, afterStart)
  const heads = rel.bidirectional
    ? [endHead, startHead]
    : [rel.reversed ? startHead : endHead]
  return [line, ...heads].filter(Boolean).join('\n')
}

/** Plain text at the middle of the chord: the label, then `[technology]` below. */
function renderRelationshipLabel(rel: PositionedC4Relationship): string {
  const lines = c4RelLabelLines(rel)
  if (lines.length === 0 || !rel.labelPosition) return ''
  const { x, y } = rel.labelPosition
  const parts = [
    f`<g class="c4-relationship-label" data-from="${escapeAttr(rel.from)}" data-to="${escapeAttr(rel.to)}">`,
  ]
  lines.forEach((line, i) => {
    const isTech = rel.technology !== undefined && i === lines.length - 1
    // Mermaid puts the technology one font size plus 5px below the label.
    const cy = y + (i === 0 ? 0 : C4.messageSize + 5)
    parts.push(
      centred(
        line,
        isTech && rel.technologyX !== undefined ? rel.technologyX : x,
        cy,
        C4.messageSize,
        isTech
          ? 'font-style="italic" fill="var(--_text)"'
          : 'fill="var(--_text)"',
      ),
    )
  })
  parts.push('</g>')
  return parts.join('\n')
}
