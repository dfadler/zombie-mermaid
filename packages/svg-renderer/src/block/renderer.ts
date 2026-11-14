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
  .node rect.composite { fill: color-mix(in srgb, var(--_node-stroke) 8%, var(--bg)); stroke: color-mix(in srgb, var(--_node-stroke) 40%, var(--bg)); }
</style>`
}

function nodeSvg(n: PositionedBlockNode): string {
  const x = n.x - n.width / 2
  const y = n.y - n.height / 2
  const rad = n.shape === 'round' ? BLOCK.cornerRadius : 0
  const cls = n.type === 'composite' ? 'composite ' : ''
  let out =
    `<g class="node${n.type === 'composite' ? ' composite' : ''}">` +
    `<rect class="${cls}label-container" rx="${rad}" ry="${rad}" x="${r(x)}" y="${r(y)}" width="${r(n.width)}" height="${r(n.height)}"/>`
  const lines = n.text.lines
  lines.forEach((line, k) => {
    const ly = n.y + (k - (lines.length - 1) / 2) * BLOCK.lineHeight
    out += `<text class="block-label" x="${r(n.x)}" y="${r(ly)}" dy="0.35em" xml:space="preserve">${escapeXml(line)}</text>`
  })
  return out + '</g>'
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
  parts.push(`<g transform="translate(${r(-vb.x)}, ${r(-vb.y)})">`)
  parts.push('<g class="block">')
  for (const n of diagram.nodes) parts.push(nodeSvg(n))
  parts.push('</g></g></svg>')
  return parts.join('\n')
}
