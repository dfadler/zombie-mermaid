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
import {
  FONT_SIZES,
  FONT_WEIGHTS,
  STROKE_WIDTHS,
  estimateTextWidth,
  TEXT_BASELINE_SHIFT,
} from '../styles.ts'
import type { FontSizes } from '../styles.ts'
import { C4, c4Palette, c4TextSizes, c4TextTopInset } from './metrics.ts'
import type { C4Palette } from './metrics.ts'

// ============================================================================
// C4 diagram SVG renderer
//
// Render order:
//   1. Title
//   2. Boundaries (outer first, dashed, title top-left)
//   3. Relationship lines with arrowheads
//   4. Elements (person glyph, cylinder, queue, box), on top of the lines
//   5. Relationship labels (name + [technology]) on a background pill
//
// Element fills use the standard C4 palette (c4model.com) and stay fixed
// across themes, as C4 colors carry meaning; everything else (boundaries,
// lines, labels) follows the theme's CSS variables.
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
  fontSizes: FontSizes = FONT_SIZES,
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
    parts.push(
      f`<text class="c4-title" x="${diagram.titlePosition.x}" y="${diagram.titlePosition.y}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
        f`font-size="${fontSizes.nodeLabel + 4}" font-weight="700" fill="var(--_text)">${escapeXml(diagram.title)}</text>`,
    )
  }

  for (const b of diagram.boundaries) parts.push(renderBoundary(b, fontSizes))
  for (const r of diagram.relationships) parts.push(renderRelationshipLine(r))
  for (const el of diagram.elements) parts.push(renderElement(el, fontSizes))
  for (const r of diagram.relationships) {
    parts.push(renderRelationshipLabel(r, fontSizes))
  }

  parts.push('</svg>')
  return parts.filter(Boolean).join('\n')
}

// ---------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------

function renderBoundary(b: PositionedC4Boundary, fontSizes: FontSizes): string {
  const parts: string[] = []
  parts.push(
    f`<g class="c4-boundary" data-id="${escapeAttr(b.alias)}" data-label="${escapeAttr(b.label)}" data-depth="${b.depth}">`,
  )
  parts.push(
    f`  <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="10" ry="10" ` +
      f`fill="var(--_group-fill)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" stroke-dasharray="7 5" />`,
  )
  const tx = b.x + 14
  parts.push(
    f`  <text x="${tx}" y="${b.y + 20}" dy="${TEXT_BASELINE_SHIFT}" font-size="${fontSizes.groupHeader}" ` +
      f`font-weight="${FONT_WEIGHTS.groupHeader}" fill="var(--_text-sec)">${escapeXml(b.label)}</text>`,
  )
  const typeLine = c4BoundaryTypeLine({
    alias: b.alias,
    label: b.label,
    ...(b.type ? { type: b.type } : {}),
    elementAliases: [],
    children: [],
  })
  if (typeLine) {
    parts.push(
      f`  <text x="${tx}" y="${b.y + 20 + fontSizes.groupHeader * 1.4}" dy="${TEXT_BASELINE_SHIFT}" font-size="${fontSizes.edgeLabel}" ` +
        f`fill="var(--_text-muted)">${escapeXml(typeLine)}</text>`,
    )
  }
  parts.push('</g>')
  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

function renderElement(el: PositionedC4Element, fontSizes: FontSizes): string {
  const pal = c4Palette(el)
  const t = c4TextSizes(fontSizes)
  const { x, y, width: w, height: h } = el
  const parts: string[] = []
  parts.push(
    f`<g class="c4-element" data-id="${escapeAttr(el.alias)}" data-kind="${el.kind}" data-shape="${el.shape}" ` +
      f`data-external="${el.external}" data-label="${escapeAttr(el.label)}">`,
  )

  // Text area: the horizontal span the text is centred in.
  let textX0 = x
  let textX1 = x + w
  if (el.shape === 'db') {
    parts.push(...cylinderShape(el, pal))
  } else if (el.shape === 'queue') {
    parts.push(...queueShape(el, pal))
    textX0 = x + C4.queueCap
    textX1 = x + w - C4.queueCap
  } else {
    parts.push(
      f`  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ry="8" fill="${pal.fill}" ` +
        f`stroke="${pal.stroke}" stroke-width="${STROKE_WIDTHS.outerBox + 0.5}" />`,
    )
  }
  const cx = (textX0 + textX1) / 2

  if (el.kind === 'person') parts.push(personGlyph(el, pal))

  let cursor = y + c4TextTopInset(el)
  for (const line of el.nameLines) {
    parts.push(
      f`  <text x="${cx}" y="${cursor + t.nameLine / 2}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
        f`font-size="${t.name}" font-weight="700" fill="${pal.text}">${escapeXml(line)}</text>`,
    )
    cursor += t.nameLine
  }
  parts.push(
    f`  <text x="${cx}" y="${cursor + t.typeLine / 2}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
      f`font-size="${t.type}" font-style="italic" fill="${pal.text}" fill-opacity="0.85">${escapeXml(c4TypeLine(el))}</text>`,
  )
  cursor += t.typeLine
  if (el.descriptionLines.length > 0) {
    cursor += C4.descGap
    for (const line of el.descriptionLines) {
      parts.push(
        f`  <text x="${cx}" y="${cursor + t.descLine / 2}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
          f`font-size="${t.desc}" fill="${pal.text}">${escapeXml(line)}</text>`,
      )
      cursor += t.descLine
    }
  }
  parts.push('</g>')
  return parts.join('\n')
}

/** Head-and-shoulders person icon, centred at the top of a person box. */
function personGlyph(el: PositionedC4Element, pal: C4Palette): string {
  const cx = el.x + el.width / 2
  const top = el.y + C4.padY
  const headR = 10
  const headCy = top + headR + 1
  const shoulderTop = headCy + headR + 3
  const bottom = top + C4.personGlyphHeight - 6
  const halfW = 19
  // Shoulders: a rounded-top block whose top edge sits just under the head.
  const path =
    f`M ${cx - halfW} ${bottom} ` +
    f`C ${cx - halfW} ${shoulderTop + 2}, ${cx - halfW * 0.55} ${shoulderTop}, ${cx} ${shoulderTop} ` +
    f`C ${cx + halfW * 0.55} ${shoulderTop}, ${cx + halfW} ${shoulderTop + 2}, ${cx + halfW} ${bottom} Z`
  return (
    f`  <g class="c4-person-glyph" fill="${pal.text}" fill-opacity="0.92">` +
    f`<circle cx="${cx}" cy="${headCy}" r="${headR}" />` +
    `<path d="${path}" /></g>`
  )
}

function cylinderShape(el: PositionedC4Element, pal: C4Palette): string[] {
  const { x, y, width: w, height: h } = el
  const rx = w / 2
  const ry = C4.dbCap
  const sw = STROKE_WIDTHS.outerBox + 0.5
  return [
    f`  <path d="M ${x} ${y + ry} L ${x} ${y + h - ry} A ${rx} ${ry} 0 0 0 ${x + w} ${y + h - ry} L ${x + w} ${y + ry} Z" ` +
      f`fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="${sw}" />`,
    f`  <ellipse cx="${x + rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" fill="${pal.fill}" ` +
      f`stroke="${pal.stroke}" stroke-width="${sw}" />`,
  ]
}

/**
 * A pipe on its side, as Mermaid draws it: rounded at the left, with the
 * ellipse face showing at the right end.
 */
function queueShape(el: PositionedC4Element, pal: C4Palette): string[] {
  const { x, y, width: w, height: h } = el
  const rx = C4.queueCap
  const ry = h / 2
  const sw = STROKE_WIDTHS.outerBox + 0.5
  return [
    f`  <path d="M ${x + w - rx} ${y} H ${x + rx} A ${rx} ${ry} 0 0 0 ${x + rx} ${y + h} H ${x + w - rx} Z" ` +
      f`fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="${sw}" />`,
    f`  <ellipse cx="${x + w - rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" fill="${pal.fill}" ` +
      f`stroke="${pal.stroke}" stroke-width="${sw}" />`,
  ]
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

function arrowHead(tip: Point, from: Point): string {
  const dx = tip.x - from.x
  const dy = tip.y - from.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return ''
  const ux = dx / len
  const uy = dy / len
  const L = 10
  const W = 4.5
  const bx = tip.x - ux * L
  const by = tip.y - uy * L
  return (
    f`<polygon points="${tip.x},${tip.y} ${bx - uy * W},${by + ux * W} ${bx + uy * W},${by - ux * W}" ` +
    `fill="var(--_arrow)" />`
  )
}

function renderRelationshipLine(rel: PositionedC4Relationship): string {
  const pts = rel.points
  if (pts.length < 2) return ''
  const attrs = [
    'class="c4-relationship"',
    f`data-from="${escapeAttr(rel.from)}"`,
    f`data-to="${escapeAttr(rel.to)}"`,
  ]
  if (rel.label) attrs.push(f`data-label="${escapeAttr(rel.label)}"`)
  if (rel.technology) {
    attrs.push(f`data-technology="${escapeAttr(rel.technology)}"`)
  }
  const line =
    f`<polyline ${attrs.join(' ')} points="${pts.map((p) => f`${p.x},${p.y}`).join(' ')}" fill="none" ` +
    f`stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector + 0.25}" stroke-linejoin="round" />`
  const endHead = arrowHead(pts[pts.length - 1]!, pts[pts.length - 2]!)
  const startHead = arrowHead(pts[0]!, pts[1]!)
  const heads = rel.bidirectional
    ? [endHead, startHead]
    : [rel.reversed ? startHead : endHead]
  return [line, ...heads].filter(Boolean).join('\n')
}

function renderRelationshipLabel(
  rel: PositionedC4Relationship,
  fontSizes: FontSizes,
): string {
  const lines = c4RelLabelLines(rel)
  if (lines.length === 0 || !rel.labelPosition) return ''
  const size = fontSizes.edgeLabel
  const lineH = size * 1.35
  const widths = lines.map((l, i) =>
    estimateTextWidth(l, i === 0 ? size : size - 1, FONT_WEIGHTS.edgeLabel),
  )
  const bgW = Math.max(...widths) + 10
  const bgH = lines.length * lineH + 6
  const { x, y } = rel.labelPosition
  const parts = [
    f`<g class="c4-relationship-label" data-from="${escapeAttr(rel.from)}" data-to="${escapeAttr(rel.to)}">`,
    f`  <rect x="${x - bgW / 2}" y="${y - bgH / 2}" width="${bgW}" height="${bgH}" rx="3" ry="3" ` +
      f`fill="var(--bg)" fill-opacity="0.92" stroke="var(--_inner-stroke)" stroke-width="0.5" />`,
  ]
  lines.forEach((line, i) => {
    const isTech = rel.technology !== undefined && i === lines.length - 1
    const cy = y - bgH / 2 + 3 + lineH * i + lineH / 2
    parts.push(
      f`  <text x="${x}" y="${cy}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" font-size="${isTech ? size - 1 : size}" ` +
        (isTech
          ? `font-style="italic" fill="var(--_text-muted)"`
          : f`font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-sec)"`) +
        f`>${escapeXml(line)}</text>`,
    )
  })
  parts.push('</g>')
  return parts.join('\n')
}
