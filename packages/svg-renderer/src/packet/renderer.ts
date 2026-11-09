// ============================================================================
// Packet SVG renderer
//
// Draws a PositionedPacket (see ./layout.ts) in Mermaid's structure: one `<g>`
// per row holding, for each field, a `packetBlock` rect, a `packetLabel` text
// and the `packetByte start` / `packetByte end` bit numbers, then the
// `packetTitle` text. Font sizes and stroke width are Mermaid's; colours map
// onto this library's theme variables so every theme applies:
//
//   Mermaid                    here
//   blockFillColor #efefef     var(--_node-fill)
//   blockStrokeColor black     var(--_node-stroke)
//   label / title black        var(--_text)
//   bit numbers black          var(--_text-muted)
//
// There is no hover or interactivity: Mermaid has none for this type.
// ============================================================================

import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { PACKET } from './layout.ts'
import type { PositionedPacket } from './layout.ts'

function r(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/**
 * Render a positioned packet diagram as an SVG string.
 *
 * The accessible name is `title` (from `options.title`, or the diagram's own
 * `accTitle` via the front door), as for every type but C4; the visible
 * `title` is not used. It is dropped when `decorative` is set — see svgOpenTag() in
 * packages/core/src/theme.ts.
 */
export function renderPacketSvg(
  p: PositionedPacket,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = [
    withDataSrc(
      svgOpenTag(
        p.width,
        p.height,
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
    buildStyleBlock(font, false, emit.nonce, emit.bodyFont),
    `${styleOpenTag(emit.nonce)}
  .packetBlock { fill: var(--_node-fill); stroke: var(--_node-stroke); stroke-width: 1; }
  .packetLabel { fill: var(--_text); font-size: ${PACKET.labelFontSize}px; }
  .packetByte { fill: var(--_text-muted); font-size: ${PACKET.byteFontSize}px; }
  .packetTitle { fill: var(--_text); font-size: ${PACKET.titleFontSize}px; }
</style>`,
  ]
  for (const row of p.rows) {
    const g: string[] = ['<g>']
    for (const b of row) {
      g.push(
        `<rect x="${r(b.x)}" y="${r(b.y)}" width="${r(b.width)}" height="${r(b.height)}" class="packetBlock"/>`,
        `<text x="${r(b.labelX)}" y="${r(b.labelY)}" class="packetLabel" dominant-baseline="middle" text-anchor="middle">${escapeXml(b.label)}</text>`,
      )
      for (const [i, n] of (b.bits ?? []).entries()) {
        g.push(
          `<text x="${r(n.x)}" y="${r(n.y)}" class="packetByte ${i === 0 ? 'start' : 'end'}" dominant-baseline="auto" text-anchor="${n.anchor}">${n.text}</text>`,
        )
      }
    }
    g.push('</g>')
    parts.push(g.join(''))
  }
  if (p.title) {
    parts.push(
      `<text x="${r(p.title.x)}" y="${r(p.title.y)}" class="packetTitle" dominant-baseline="middle" text-anchor="middle">${escapeXml(p.title.text)}</text>`,
    )
  }
  parts.push('</svg>')
  return parts.join('\n')
}
