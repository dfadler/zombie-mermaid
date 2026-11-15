// ============================================================================
// Block diagram SVG renderer
//
// Draws a PositionedBlockDiagram (see ./layout.ts) in Mermaid's structure: a `block`
// group of `node` groups, each a rectangle (5px corners for a round block) and
// its label, a group (`block ... end`) being a rectangle of class `composite`
// drawn before its children. Styling follows Mermaid's block styles.ts, mapped
// onto this library's CSS custom properties so every theme applies:
//
//   Mermaid                          here
//   node fill / border               --_node-fill / --_node-stroke
//   composite fill / border          a light mix of --_node-stroke into --bg
//   labels (HTML, 16px)              <text>, 16px, one per label line
//
// Mermaid fills with its own hsl colours; here the colours follow the theme (a
// documented difference).
// ============================================================================

import type {
  PositionedBlockDiagram,
  PositionedBlockEdge,
  PositionedBlockNode,
} from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { BLOCK } from './layout.ts'

const r = (n: number): string => String(Math.round(n * 100) / 100)

function blockStyles(nonce?: string): string {
  return `${styleOpenTag(nonce)}
  .block-label { fill: var(--_text); font-size: ${BLOCK.fontSize}px; text-anchor: middle; }
  .node rect { fill: var(--_node-fill); stroke: var(--_node-stroke); stroke-width: 1px; }
  .edge-path { fill: none; stroke: var(--_line); stroke-width: 1px; }
  .edge-path.thick { stroke-width: 3.5px; }
  .edge-path.dotted { stroke-dasharray: 2; }
  .block-marker { fill: var(--_arrow); stroke: var(--_arrow); }
  .block-marker.cross { fill: none; }
  .edge-label-bg { fill: var(--bg); opacity: 0.5; }
  .node rect.composite { fill: color-mix(in srgb, var(--_node-stroke) 8%, var(--bg)); stroke: color-mix(in srgb, var(--_node-stroke) 40%, var(--bg)); }
</style>`
}

/**
 * Mermaid's inline styles: a block's rect gets every property but `color` as
 * `name:value !important`, the label gets `color`; a group's rect gets them
 * plain and `;`-terminated.
 */
function nodeStyle(n: PositionedBlockNode): { rect: string; color?: string } {
  const own = n.css.filter(([k]) => k !== 'color')
  const color = n.css.find(([k]) => k === 'color')?.[1]
  const rect =
    n.type === 'composite'
      ? own.map(([k, v]) => `${k}:${v};`).join('')
      : own.map(([k, v]) => `${k}:${v} !important`).join(';')
  return color === undefined ? { rect } : { rect, color }
}

function nodeSvg(n: PositionedBlockNode): string {
  const x = n.x - n.width / 2
  const y = n.y - n.height / 2
  const rad = n.shape === 'round' ? BLOCK.cornerRadius : 0
  const cls = n.type === 'composite' ? 'composite ' : ''
  const { rect, color } = nodeStyle(n)
  const classes = [
    ...(n.type === 'composite' ? ['composite'] : []),
    ...n.classes,
  ]
    .map((c) => ` ${escapeXml(c)}`)
    .join('')
  let out =
    `<g class="node${classes}">` +
    `<rect class="${cls}label-container"${rect ? ` style="${escapeXml(rect)}"` : ''} rx="${rad}" ry="${rad}" x="${r(x)}" y="${r(y)}" width="${r(n.width)}" height="${r(n.height)}"/>`
  const lines = n.text.lines
  lines.forEach((line, k) => {
    const ly = n.y + (k - (lines.length - 1) / 2) * BLOCK.lineHeight
    out += `<text class="block-label"${color === undefined ? '' : ` style="fill:${escapeXml(color)}"`} x="${r(n.x)}" y="${r(ly)}" dy="0.35em" xml:space="preserve">${escapeXml(line)}</text>`
  })
  return out + '</g>'
}

/** Mermaid's block markers (`markers.js`), `userSpaceOnUse`, one pair per kind. */
const MARKERS = `<defs>
<marker id="block-pointEnd" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path class="block-marker" d="M 0 0 L 10 5 L 0 10 z"/></marker>
<marker id="block-pointStart" viewBox="0 0 10 10" refX="4.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path class="block-marker" d="M 0 5 L 10 10 L 10 0 z"/></marker>
<marker id="block-circleEnd" viewBox="0 0 10 10" refX="11" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle class="block-marker" cx="5" cy="5" r="5"/></marker>
<marker id="block-circleStart" viewBox="0 0 10 10" refX="-1" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle class="block-marker" cx="5" cy="5" r="5"/></marker>
<marker id="block-crossEnd" viewBox="0 0 11 11" refX="12" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path class="block-marker cross" stroke-width="2" d="M 1,1 l 9,9 M 10,1 l -9,9"/></marker>
<marker id="block-crossStart" viewBox="0 0 11 11" refX="-1" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path class="block-marker cross" stroke-width="2" d="M 1,1 l 9,9 M 10,1 l -9,9"/></marker>
</defs>`

const KIND: Record<string, string> = {
  arrow_point: 'point',
  arrow_circle: 'circle',
  arrow_cross: 'cross',
}

function edgeSvg(e: PositionedBlockEdge): string {
  const cls = `edge-path${e.thickness === 'thick' ? ' thick' : ''}${e.pattern === 'dotted' ? ' dotted' : ''}`
  const start = KIND[e.arrowTypeStart]
  const end = KIND[e.arrowTypeEnd]
  let out =
    `<path class="${cls}" d="${e.path}"` +
    (start ? ` marker-start="url(#block-${start}Start)"` : '') +
    (end ? ` marker-end="url(#block-${end}End)"` : '') +
    '/>'
  if (e.label) {
    const h = BLOCK.lineHeight
    out +=
      `<g class="edge-label"><rect class="edge-label-bg" x="${r(e.labelX - e.labelWidth / 2)}" y="${r(e.labelY - h / 2)}" width="${r(e.labelWidth)}" height="${h}"/>` +
      `<text class="block-label" x="${r(e.labelX)}" y="${r(e.labelY)}" dy="0.35em" xml:space="preserve">${escapeXml(e.label)}</text></g>`
  }
  return out
}

/**
 * Render a positioned block diagram as an SVG string.
 *
 * The accessible name is `title` (from `options.title`) when given; a block
 * diagram has no title statement of its own. Both are dropped when
 * `decorative` is set, see svgOpenTag() in packages/core/src/theme.ts.
 */
export function renderBlockSvg(
  diagram: PositionedBlockDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const vb = diagram.viewBox
  const parts: string[] = []
  parts.push(
    withDataSrc(
      svgOpenTag(
        vb.width,
        vb.height,
        colors,
        transparent,
        title,
        decorative,
        false,
        emit.styleAttribute,
        emit.description,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, false, emit.nonce, emit.bodyFont))
  parts.push(blockStyles(emit.nonce))
  if (diagram.edges.length > 0) parts.push(MARKERS)
  parts.push(`<g transform="translate(${r(-vb.x)}, ${r(-vb.y)})">`)
  parts.push('<g class="block">')
  for (const n of diagram.nodes) parts.push(nodeSvg(n))
  for (const e of diagram.edges) parts.push(edgeSvg(e))
  parts.push('</g></g></svg>')
  return parts.join('\n')
}
