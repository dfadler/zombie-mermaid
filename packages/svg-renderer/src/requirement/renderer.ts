import type {
  PositionedRequirementDiagram,
  PositionedRequirementEdge,
  PositionedRequirementNode,
} from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  sanitizeClassName,
  renderMultilineText,
  escapeAttr,
  f,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { REQUIREMENT } from './layout.ts'
import {
  buildSvgStyleBlock,
  FONT_SIZES,
  FONT_WEIGHTS,
  STROKE_WIDTHS,
} from '../styles.ts'
import type { FontSizes } from '../styles.ts'

// ============================================================================
// Requirement diagram SVG renderer
//
// Render order: relationship lines (behind the boxes), boxes, then the
// relationship labels. All colours are CSS custom properties from the theme.
//
// Markers are drawn inline, to Mermaid's geometry:
//   - `contains`: a 9px circle with a plus in it at the container's end of a
//     solid line, centred 10px from the box
//   - every other relationship: a dashed line ending in an open arrow whose
//     arms are 16px long and 8px either side
// ============================================================================

/** Dash pattern of every relationship but `contains` (Mermaid: `10,7`). */
const DASH = '10 7'
const CIRCLE_RADIUS = 9
const ARROW_LENGTH = 16
const ARROW_HALF = 8

/** Render a positioned requirement diagram as an SVG string. */
export function renderRequirementSvg(
  diagram: PositionedRequirementDiagram,
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
        title,
        decorative,
        undefined,
        emit.styleAttribute,
        emit.description,
      ),
      embedSource,
    ),
  )
  parts.push(buildSvgStyleBlock(font, true, emit.nonce, emit.bodyFont))

  for (const edge of diagram.edges) parts.push(renderEdge(edge))
  for (const node of diagram.nodes) parts.push(renderNode(node, fontSizes))
  for (const edge of diagram.edges) parts.push(renderEdgeLabel(edge, fontSizes))

  parts.push('</svg>')
  return parts.join('\n')
}

function renderNode(node: PositionedRequirementNode, fontSizes: FontSizes) {
  const { x, y, width, height, inlineStyle } = node
  const fill = escapeAttr(inlineStyle?.fill ?? 'var(--_node-fill)')
  const stroke = escapeAttr(inlineStyle?.stroke ?? 'var(--_node-stroke)')
  const strokeWidth = escapeAttr(
    inlineStyle?.['stroke-width'] ?? String(STROKE_WIDTHS.outerBox),
  )
  const textColor = inlineStyle?.color
    ? escapeAttr(inlineStyle.color)
    : undefined
  const safe = (node.classNames ?? []).flatMap(
    (c) => sanitizeClassName(c) ?? [],
  )
  const cls = ['requirement-node', ...safe].join(' ')
  const parts: string[] = [
    f`<g class="${cls}" data-id="${escapeAttr(node.id)}" data-kind="${node.kind}">`,
    f`  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="0" ry="0" ` +
      f`fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
  ]
  const cx = x + width / 2
  const rowH = REQUIREMENT.rowHeight
  const top = y + REQUIREMENT.textTop
  const text = (
    s: string,
    tx: number,
    cy: number,
    attrs: string,
    tone: string,
  ) =>
    '  ' +
    renderMultilineText(
      s,
      tx,
      cy,
      fontSizes.nodeLabel,
      f`${attrs} font-size="${fontSizes.nodeLabel}" fill="${textColor ?? tone}"`,
    )
  parts.push(
    text(
      node.typeText,
      cx,
      top + rowH / 2,
      'text-anchor="middle"',
      'var(--_text-sec)',
    ),
    text(
      node.name,
      cx,
      top + rowH * 1.5,
      f`text-anchor="middle" font-weight="700"`,
      'var(--_text)',
    ),
  )
  if (node.dividerY !== undefined) {
    parts.push(
      f`  <line x1="${x}" y1="${node.dividerY}" x2="${x + width}" y2="${node.dividerY}" ` +
        f`stroke="${stroke}" stroke-width="${STROKE_WIDTHS.innerBox}" />`,
    )
    for (const [i, row] of node.rows.entries()) {
      parts.push(
        text(
          row,
          x + REQUIREMENT.rowInset,
          top + rowH * 2 + REQUIREMENT.bodyGap + rowH * (i + 0.5),
          'text-anchor="start"',
          'var(--_text-sec)',
        ),
      )
    }
  }
  parts.push('</g>')
  return parts.join('\n')
}

type Pt = { x: number; y: number }

/** Unit vector from `a` to `b` (zero when they coincide). */
function unit(a: Pt, b: Pt): Pt {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  return len === 0
    ? { x: 0, y: 0 }
    : { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
}

/** How far a rounded bend starts before its corner (Mermaid: ~7.07, a radius-10 arc's chord inset). */
const CORNER = 5 * Math.SQRT2

/** `M..L..Q..` through `pts`: straight runs, each interior corner a quadratic curve. */
function roundedPath(pts: Pt[]): string {
  const last = pts.length - 1
  let d = f`M${pts[0]!.x},${pts[0]!.y}`
  for (let i = 1; i < last; i++) {
    const p = pts[i]!
    const a = pts[i - 1]!
    const b = pts[i + 1]!
    const ua = unit(p, a)
    const ub = unit(p, b)
    const ra = Math.min(CORNER, Math.hypot(a.x - p.x, a.y - p.y) / 2)
    const rb = Math.min(CORNER, Math.hypot(b.x - p.x, b.y - p.y) / 2)
    d +=
      f`L${p.x + ua.x * ra},${p.y + ua.y * ra}` +
      f`Q${p.x},${p.y} ${p.x + ub.x * rb},${p.y + ub.y * rb}`
  }
  return d + f`L${pts[last]!.x},${pts[last]!.y}`
}

function renderEdge(edge: PositionedRequirementEdge): string {
  const pts = edge.points
  if (pts.length < 2) return ''
  const contains = edge.type === 'contains'
  const sw = STROKE_WIDTHS.connector
  const attrs = [
    'class="requirement-relationship"',
    f`data-type="${edge.type}"`,
    f`data-src="${escapeAttr(edge.src)}"`,
    f`data-dst="${escapeAttr(edge.dst)}"`,
  ].join(' ')
  const line =
    f`<path ${attrs} d="${roundedPath(pts)}" fill="none" ` +
    f`stroke="var(--_line)" stroke-width="${sw}"${contains ? '' : f` stroke-dasharray="${DASH}"`} />`
  if (contains) {
    // Circle-plus centred 10px along the line from the container's edge.
    const p = pts[0]!
    const u = unit(p, pts[1]!)
    const c = { x: p.x + u.x * 10, y: p.y + u.y * 10 }
    const r = CIRCLE_RADIUS
    const mark = (x1: number, y1: number, x2: number, y2: number) =>
      f`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--_line)" stroke-width="${sw}" />`
    return [
      line,
      f`<circle cx="${c.x}" cy="${c.y}" r="${r}" fill="var(--bg)" stroke="var(--_line)" stroke-width="${sw}" />`,
      mark(c.x - r, c.y, c.x + r, c.y),
      mark(c.x, c.y - r, c.x, c.y + r),
    ].join('\n')
  }
  // Open arrow at the target end.
  const tip = pts[pts.length - 1]!
  const u = unit(pts[pts.length - 2]!, tip)
  const back = { x: tip.x - u.x * ARROW_LENGTH, y: tip.y - u.y * ARROW_LENGTH }
  const l = { x: back.x - u.y * ARROW_HALF, y: back.y + u.x * ARROW_HALF }
  const r = { x: back.x + u.y * ARROW_HALF, y: back.y - u.x * ARROW_HALF }
  return [
    line,
    f`<polyline points="${l.x},${l.y} ${tip.x},${tip.y} ${r.x},${r.y}" fill="none" stroke="var(--_line)" stroke-width="${sw}" stroke-linejoin="miter" />`,
  ].join('\n')
}

function renderEdgeLabel(
  edge: PositionedRequirementEdge,
  fontSizes: FontSizes,
): string {
  const { labelPoint: mid, labelWidth: w, labelHeight: h } = edge
  return (
    f`<rect x="${mid.x - w / 2}" y="${mid.y - h / 2}" width="${w}" height="${h}" rx="2" ry="2" ` +
    `fill="var(--bg)" stroke="none" />` +
    f`\n${renderMultilineText(
      edge.label,
      mid.x,
      mid.y,
      fontSizes.edgeLabel,
      f`text-anchor="middle" font-size="${fontSizes.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="color-mix(in srgb, var(--fg) 70%, var(--bg))"`,
    )}`
  )
}
