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
// There is no hover or interactivity: Mermaid has none for this type. The
// `handDrawn` look draws the lines, arrowheads, label boxes and head with the
// rough.js subset in ../rough.ts, minus the hachure fill of the boxes and head
// (see docs/known-differences.md).
// ============================================================================

import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import {
  roughLine,
  roughPathOutline,
  roughPathSolid,
  roughRectOutline,
} from '../rough.ts'
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

const strokePath = (d: string, width: number): string =>
  `<path d="${d}" stroke="var(--_line)" stroke-width="${width}" fill="none"/>`

/** Mermaid's `drawArrowMarker`: a solid rough triangle whose tip sits at (x, y), pointing along (dx, dy) backwards. */
function roughArrow(
  x: number,
  y: number,
  dx: number,
  dy: number,
  seed: number,
): string {
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return ''
  const ux = dx / len
  const uy = dy / len
  const s = 6
  const px = -uy * s
  const py = ux * s
  const d = `M ${x} ${y} L ${x - ux * s * 2 + px} ${y - uy * s * 2 + py} L ${x - ux * s * 2 - px} ${y - uy * s * 2 - py} Z`
  const { fill, outline } = roughPathSolid(d, 1, seed)
  return (
    `<g><path d="${fill}" stroke="none" stroke-width="0" fill="var(--_line)"/>` +
    `${strokePath(outline, 1)}</g>`
  )
}

const roughStroke = (l: IshikawaLine, seed: number): string =>
  `<g class="${l.cls}">${strokePath(roughLine(l.x1, l.y1, l.x2, l.y2, 1.5, seed), 2)}</g>`

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
    if (p.handDrawn) {
      const seed = p.handDrawn.seed
      const g: string[] = ['<g class="ishikawa">']
      g.push(
        `<g class="ishikawa-head-group" transform="translate(${r(p.head.x)},${r(p.head.y)})">` +
          `<g class="ishikawa-head">${strokePath(roughPathOutline(p.head.d, 1.5, seed), 2)}</g>` +
          `<text class="ishikawa-head-label" x="${r(p.head.textX)}" y="${r(p.head.textY)}">${tspans(p.head.lines, p.head.textX)}</text></g>`,
      )
      for (const it of p.items) {
        if (it.kind === 'line') {
          const l = it.line
          g.push(roughStroke(l, seed))
          // A horizontal sub-bone points left; every other bone points back along itself.
          const horizontal = l.cls === 'ishikawa-sub-branch' && l.y1 === l.y2
          g.push(
            roughArrow(
              l.x1,
              l.y1,
              horizontal ? 1 : l.x1 - l.x2,
              horizontal ? 0 : l.y1 - l.y2,
              seed,
            ),
          )
        } else if (it.kind === 'box')
          g.push(
            `<g class="ishikawa-label-box">${strokePath(roughRectOutline(it.x, it.y, it.width, it.height, 1.5, seed), 2)}</g>`,
          )
        else
          g.push(
            `<text class="ishikawa-label ${it.text.cls}" x="${r(it.text.x)}" y="${r(it.text.y)}">${tspans(it.text.lines, it.text.x)}</text>`,
          )
      }
      g.push(roughStroke(p.spine, seed), '</g>')
      parts.push(g.join('\n'))
      parts.push('</svg>')
      return parts.join('\n')
    }
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
