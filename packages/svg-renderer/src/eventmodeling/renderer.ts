// ============================================================================
// Event modeling SVG renderer
//
// Draws a PositionedEventModeling (see ./layout.ts) in Mermaid's structure:
// one `em-swimlane` band per lane with its label, one `em-box` per frame, one
// `em-relation` arrow per relation, and an arrowhead marker.
//
//   Mermaid                           here
//   lane fill rgb(250,250,250)        --fg mixed 4% into --bg (follows the theme)
//   lane label (bold, 16px)           <text>, bold
//   box fill / stroke by entity       Mermaid's own pastel pairs, in every theme
//   box text (HTML, centred)          <text>, #333 so it reads on the pastels
//   inline data (<code>, left)        a left-aligned block under the name, regular weight
//                                     (Mermaid measures it bold but draws it outside <b>)
//   arrow stroke #000                 --_line
//
// The entity colours are Mermaid's defaults (`emUiFill`, `emCommandFill`, ...),
// kept fixed because event modeling is read by colour: blue commands, orange
// events, green read models. They are not themeable here.
// ============================================================================

import type {
  EventModelingEntityType,
  PositionedEventModeling,
} from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { EVENTMODELING, measure } from './layout.ts'

const r = (n: number): string => String(Math.round(n * 100) / 100)

/** Mermaid's default `emUi*`, `emProcessor*`, `emReadModel*`, `emCommand*` and `emEvent*` colours. */
export const ENTITY_COLORS: Record<
  EventModelingEntityType,
  { fill: string; stroke: string }
> = {
  ui: { fill: '#ffffff', stroke: '#dbdada' },
  processor: { fill: '#edb3f6', stroke: '#b88cbf' },
  readmodel: { fill: '#d3f1a2', stroke: '#a3b732' },
  command: { fill: '#bcd6fe', stroke: '#679ac3' },
  event: { fill: '#ffb778', stroke: '#c19a0f' },
}

const STYLE = (nonce?: string): string => `${styleOpenTag(nonce)}
  .em-lane { fill: color-mix(in srgb, var(--fg) 4%, var(--bg)); stroke: color-mix(in srgb, var(--fg) 10%, var(--bg)); }
  .em-lane-label { fill: var(--_text); font-size: 16px; font-weight: 700; }
  .em-box rect { stroke-width: 1px; }
  .em-text { fill: #333333; font-size: 16px; }
  .em-name { font-weight: 700; text-anchor: middle; }
  .em-data { font-weight: 400; }
  .em-relation { fill: none; stroke: var(--_line); stroke-width: 1px; }
  .em-arrowhead { fill: var(--_line); }
</style>`

/**
 * Render a positioned event modeling diagram as an SVG string.
 *
 * The accessible name is `title` (from `options.title`) when given; the
 * diagram has no title statement of its own. Both are dropped when
 * `decorative` is set, see svgOpenTag() in packages/core/src/theme.ts.
 */
export function renderEventModelingSvg(
  d: PositionedEventModeling,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const E = EVENTMODELING
  const vb = d.viewBox
  const parts: string[] = [
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
    buildStyleBlock(font, false, emit.nonce, emit.bodyFont),
    STYLE(emit.nonce),
    `<g transform="translate(${r(-vb.x)}, ${r(-vb.y)})">`,
  ]
  for (const lane of d.lanes)
    parts.push(
      `<g class="em-swimlane"><rect class="em-lane" rx="3" x="0" y="${r(lane.y)}" width="${r(d.laneWidth)}" height="${r(lane.height)}"/>` +
        `<text class="em-lane-label" x="30" y="${r(lane.y + 30)}" dy="0.35em">${escapeXml(lane.label)}</text></g>`,
    )
  for (const box of d.boxes) {
    const c = ENTITY_COLORS[box.frame.entityType]
    const lines = box.nameLines.length
    const total =
      lines + (box.dataLines.length > 0 ? 1 + box.dataLines.length : 0)
    // The text block is centred in the box, 10px inside its top and bottom.
    const top = box.y + 10 + (box.height - 20 - total * E.lineHeight) / 2
    const baseline = (k: number): number => top + (k + 0.5) * E.lineHeight
    const cx = box.x + box.width / 2
    let text = box.nameLines
      .map(
        (l, k) =>
          `<text class="em-text em-name" x="${r(cx)}" y="${r(baseline(k))}" dy="0.35em">${escapeXml(l)}</text>`,
      )
      .join('')
    if (box.dataLines.length > 0) {
      const left =
        cx -
        Math.min(
          E.textMaxWidth,
          Math.max(...box.dataLines.map((l) => measure(l))),
        ) /
          2
      text += box.dataLines
        .map(
          (l, k) =>
            `<text class="em-text em-data" x="${r(left)}" y="${r(baseline(lines + 1 + k))}" dy="0.35em" xml:space="preserve">${escapeXml(l)}</text>`,
        )
        .join('')
    }
    parts.push(
      `<g class="em-box"><rect rx="3" x="${r(box.x)}" y="${r(box.y)}" width="${r(box.width)}" height="${r(box.height)}" fill="${c.fill}" stroke="${c.stroke}"/>${text}</g>`,
    )
  }
  for (const rel of d.relations)
    parts.push(
      `<path class="em-relation" d="M${r(rel.x1)} ${r(rel.y1)} L${r(rel.x2)} ${r(rel.y2)}" marker-end="url(#em-arrowhead)"/>`,
    )
  parts.push(
    '<defs><marker id="em-arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon class="em-arrowhead" points="0 0, 10 3.5, 0 7"/></marker></defs>',
    '</g></svg>',
  )
  return parts.join('\n')
}
