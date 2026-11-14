// ============================================================================
// Ishikawa SVG renderer
//
// Draws a PositionedIshikawa (see ./layout.ts) in Mermaid's structure: a
// `g.ishikawa` holding the arrow marker, the spine, the head group and the
// bones with their labels. Colours map onto this library's theme variables:
//
//   Mermaid                 here
//   lineColor               var(--_line)
//   mainBkg                 var(--_node-fill)
//   textColor               var(--_text)
//
// There is no hover or interactivity: Mermaid has none for this type, and the
// `handDrawn` look is not drawn.
// ============================================================================

import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { ISHIKAWA } from './layout.ts'
import type { IshikawaLine, PositionedIshikawa } from './layout.ts'

const r = (n: number): string => String(Math.round(n * 100) / 100)

const MARKER = 'ishikawa-arrow'

function tspans(lines: string[], x: number): string {
  return lines
    .map(
      (l, i) =>
        `<tspan x="${r(x)}" dy="${i === 0 ? 0 : r(ISHIKAWA.fontSize * 1.05)}">${escapeXml(l)}</tspan>`,
    )
    .join('')
}

const line = (l: IshikawaLine, marker: boolean): string =>
  `<line class="${l.cls}" x1="${r(l.x1)}" y1="${r(l.y1)}" x2="${r(l.x2)}" y2="${r(l.y2)}"${marker ? ` marker-start="url(#${MARKER})"` : ''}/>`

/** Render a positioned ishikawa diagram as an SVG string; `positioned` is absent for a diagram with no lines. */
export function renderIshikawaSvg(
  p: PositionedIshikawa | undefined,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const width = p?.width ?? 0
  const height = p?.height ?? 0
  const parts: string[] = [
    withDataSrc(
      svgOpenTag(
        width,
        height,
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
  .ishikawa-spine, .ishikawa-branch, .ishikawa-sub-branch { stroke: var(--_line); stroke-width: 2; fill: none; }
  .ishikawa-sub-branch { stroke-width: 1; }
  .ishikawa-arrow { fill: var(--_line); }
  .ishikawa-head, .ishikawa-label-box { fill: var(--_node-fill); stroke: var(--_node-stroke); stroke-width: 2; }
  .ishikawa text { fill: var(--_text); font-size: ${ISHIKAWA.fontSize}px; }
  .ishikawa-head-label { font-weight: 600; text-anchor: middle; dominant-baseline: middle; font-size: ${ISHIKAWA.headFontSize}px; }
  .ishikawa-label.cause { text-anchor: middle; dominant-baseline: middle; }
  .ishikawa-label.align { text-anchor: end; dominant-baseline: middle; }
  .ishikawa-label.up { text-anchor: end; dominant-baseline: baseline; }
  .ishikawa-label.down { text-anchor: end; dominant-baseline: hanging; }
</style>`,
  ]
  if (p) {
    const g: string[] = [
      '<g class="ishikawa">',
      `<defs><marker id="${MARKER}" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 10 0 L 0 5 L 10 10 Z" class="ishikawa-arrow"/></marker></defs>`,
      line(p.spine, false),
      `<g class="ishikawa-head-group" transform="translate(${r(p.head.x)},${r(p.head.y)})">` +
        `<path class="ishikawa-head" d="${p.head.d}"/>` +
        `<text class="ishikawa-head-label" x="${r(p.head.textX)}" y="${r(p.head.textY)}">${tspans(p.head.lines, p.head.textX)}</text></g>`,
    ]
    for (const it of p.items) {
      if (it.kind === 'line')
        g.push(line(it.line, it.line.cls !== 'ishikawa-spine'))
      else if (it.kind === 'box')
        g.push(
          `<rect class="ishikawa-label-box" x="${r(it.x)}" y="${r(it.y)}" width="${r(it.width)}" height="${r(it.height)}"/>`,
        )
      else
        g.push(
          `<text class="ishikawa-label ${it.text.cls}" x="${r(it.text.x)}" y="${r(it.text.y)}">${tspans(it.text.lines, it.text.x)}</text>`,
        )
    }
    g.push('</g>')
    parts.push(g.join('\n'))
  }
  parts.push('</svg>')
  return parts.join('\n')
}
