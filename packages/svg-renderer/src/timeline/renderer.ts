// ============================================================================
// Timeline SVG renderer
//
// Draws a PositionedTimeline (see ./layout.ts) in Mermaid's structure: each
// period, event and section heading is a `<g transform>` wrapping a
// `timeline-node` group (rounded box, underline, wrapped text), with dashed
// connector lines and the arrowed main axis after them. Styling follows
// Mermaid's default theme, mapped onto this library's CSS custom properties so
// every theme (and live theme switching through `--bg`/`--fg`/`--accent`)
// applies:
//
//   Mermaid                         here
//   cScale0..11 fills               --timeline-color-0..11: the theme accent,
//                                   then getSeriesColor() shades of it (as pie
//                                   does), mixed 30% into --bg for the boxes
//   cScaleInv underline             the same colour, undimmed
//   text, lines, arrowheads         var(--_text) / var(--fg)
//
// `timeline TD` has no arrowheads: Mermaid's vertical renderer points its
// lines at `#arrowhead` but defines `#undefined-arrowhead`, so none show.
// There is no hover or interactivity: Mermaid has none for this type.
// ============================================================================

import type {
  PositionedTimeline,
  PositionedTimelineNode,
} from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { pieColorValue } from '../pie/renderer.ts'

function r(n: number): string {
  return String(Math.round(n * 100) / 100)
}

function timelineStyles(
  tl: PositionedTimeline,
  colors: DiagramColors,
  nonce?: string,
): string {
  const used = [...new Set(tl.nodes.map((n) => n.colorClass))].sort(
    (a, b) => a - b,
  )
  const vars = used.map(
    (c) =>
      `    --timeline-color-${c + 1}: ${pieColorValue(c + 1, colors.accent, colors.bg)};`,
  )
  const rules = used.map(
    (c) =>
      `  .section-${c} path { fill: color-mix(in srgb, var(--timeline-color-${c + 1}) 30%, var(--bg)); }\n` +
      `  .section-${c} line { stroke: var(--timeline-color-${c + 1}); stroke-width: 3; }`,
  )
  return `${styleOpenTag(nonce)}
  .timeline-node text { fill: var(--_text); font-size: 16px; }
  .timeline-title { fill: var(--_text); font-weight: bold; }
  .lineWrapper line { stroke: var(--fg); }
  .timeline-arrow { fill: var(--fg); stroke: var(--fg); }${
    vars.length > 0 ? `\n  svg {\n${vars.join('\n')}\n  }` : ''
  }
${rules.join('\n')}
</style>`
}

function nodeSvg(n: PositionedTimelineNode, wrapper: string): string {
  const { width: w, height: h } = n
  const d = `M0 ${r(h - 5)} v${r(-h + 10)} q0,-5,5,-5 h${r(w - 10)} q5,0,5,5 v${r(h - 5)} H0 Z`
  const tspans = n.lines
    .map(
      (l, i) =>
        `<tspan x="0" dy="${i === 0 ? '1em' : '1.1em'}">${escapeXml(l)}</tspan>`,
    )
    .join('')
  return (
    `<g class="${wrapper}" transform="translate(${r(n.x)}, ${r(n.y)})">` +
    `<g class="timeline-node section-${n.colorClass}">` +
    `<g><path class="node-bkg" d="${d}"/>` +
    `<line class="node-line-${n.colorClass}" x1="0" y1="${r(h)}" x2="${r(w)}" y2="${r(h)}"/></g>` +
    `<g transform="translate(${r(w / 2)}, ${r(n.padding / 2)})">` +
    `<text dy="1em" alignment-baseline="middle" dominant-baseline="middle" text-anchor="middle">${tspans}</text>` +
    `</g></g></g>`
  )
}

/**
 * Render a positioned timeline as an SVG string.
 *
 * The accessible name is `title` (from `options.title`, or the diagram's own
 * `accTitle` via the front door), as for every type but C4: the visible
 * `title` is not used. It is dropped when `decorative` is set — see svgOpenTag() in
 * packages/core/src/theme.ts.
 */
export function renderTimelineSvg(
  tl: PositionedTimeline,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []
  parts.push(
    withDataSrc(
      svgOpenTag(
        tl.width,
        tl.height,
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
  parts.push(buildStyleBlock(font, false, emit.nonce, emit.bodyFont))
  parts.push(timelineStyles(tl, colors, emit.nonce))
  const arrows = tl.direction === 'LR'
  if (arrows) {
    parts.push(
      '<defs><marker id="timeline-arrowhead" refX="5" refY="2" markerWidth="6" markerHeight="4" orient="auto"><path class="timeline-arrow" d="M 0,0 V 4 L6,2 Z"/></marker></defs>',
    )
  }

  for (const n of tl.nodes) {
    parts.push(
      nodeSvg(
        n,
        n.kind === 'section'
          ? 'sectionWrapper'
          : n.kind === 'period'
            ? 'taskWrapper'
            : 'eventWrapper',
      ),
    )
  }
  const marker = arrows ? ' marker-end="url(#timeline-arrowhead)"' : ''
  for (const c of tl.connectors) {
    parts.push(
      `<g class="lineWrapper"><line x1="${r(c.x1)}" y1="${r(c.y1)}" x2="${r(c.x2)}" y2="${r(c.y2)}" stroke-width="2"${marker} stroke-dasharray="5,5"/></g>`,
    )
  }
  if (tl.title) {
    parts.push(
      `<text x="${r(tl.title.x)}" y="${r(tl.title.y)}" font-size="${tl.title.fontSize}" font-weight="bold" class="timeline-title">${escapeXml(tl.title.text)}</text>`,
    )
  }
  const a = tl.axis
  parts.push(
    `<g class="lineWrapper"><line x1="${r(a.x1)}" y1="${r(a.y1)}" x2="${r(a.x2)}" y2="${r(a.y2)}" stroke-width="4"${marker}/></g>`,
  )
  parts.push('</svg>')
  return parts.join('\n')
}
