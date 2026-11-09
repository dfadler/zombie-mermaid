// ============================================================================
// Journey SVG renderer
//
// Draws a PositionedJourney (see ./layout.ts) in Mermaid's structure: an actor
// legend, a bar per section, and per task a dashed score line, a face (smile,
// straight or sad mouth by score), the task box with a dot per actor, and the
// arrowed main axis. Colours follow this library's CSS custom properties so
// every theme applies; Mermaid's fixed palette is not copied:
//
//   Mermaid                         here
//   sectionFills 0-6, actorColours  --journey-color-N: the theme accent, then
//                                   getSeriesColor() shades (as pie/timeline)
//   white section/task text         var(--_text), boxes mixed 30% into --bg
//   face / lines / axis             var(--fg) mixes
//
// Mermaid draws no hover or interactivity for this type.
// ============================================================================

import type {
  PositionedJourney,
  PositionedJourneyTask,
} from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  paletteClass,
  withRootClass,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { pieColorValue } from '../pie/renderer.ts'

function r(n: number): string {
  // A non-numeric score gives Mermaid a NaN attribute, which browsers read as 0.
  return String(Number.isFinite(n) ? Math.round(n * 100) / 100 : 0)
}

const SMILE =
  'M7.5,0A7.5,7.5,0,1,1,-7.5,0L-6.818,0A6.818,6.818,0,1,0,6.818,0Z'
const SAD = 'M-7.5,0A7.5,7.5,0,1,1,7.5,0L6.818,0A6.818,6.818,0,1,0,-6.818,0Z'

function journeyStyles(
  j: PositionedJourney,
  colors: DiagramColors,
  nonce?: string,
): { css: string; cls: string } {
  const used = new Set<number>()
  for (const s of j.sections) used.add(s.num)
  for (const t of j.tasks) used.add(t.num)
  const actors = new Set<number>()
  for (const row of j.legend) actors.add(row.pos % 6)
  const vars = [
    ...[...used]
      .sort((a, b) => a - b)
      .map(
        (n) =>
          `    --journey-section-${n}: ${pieColorValue(n + 1, colors.accent, colors.bg)};`,
      ),
    ...[...actors]
      .sort((a, b) => a - b)
      .map(
        (n) =>
          `    --journey-actor-${n}: ${pieColorValue(n + 4, colors.accent, colors.bg)};`,
      ),
  ]
  const rules = [
    ...[...used].map(
      (n) =>
        `  .section-type-${n} { fill: color-mix(in srgb, var(--journey-section-${n}) 30%, var(--bg)); }`,
    ),
    ...[...actors].map(
      (n) => `  .actor-${n} { fill: var(--journey-actor-${n}); }`,
    ),
  ]
  const cls = paletteClass(vars)
  const css = `${styleOpenTag(nonce)}
  .journey-label { fill: var(--_text); font-size: 14px; }
  .legend { fill: var(--_text); font-size: 16px; }
  .journey-title { fill: var(--_text); font-weight: bold; }
  .face { fill: color-mix(in srgb, var(--fg) 8%, var(--bg)); stroke: var(--fg); }
  .mouth { stroke: var(--fg); fill: var(--fg); }
  .mouth-line { stroke: var(--fg); }
  .task-line { stroke: var(--fg); }
  .task, .journey-section { stroke: var(--fg); stroke-opacity: 0.4; }
  .journey-axis { stroke: var(--fg); }
  .journey-arrow { fill: var(--fg); }${
    vars.length > 0 ? `\n  .${cls} {\n${vars.join('\n')}\n  }` : ''
  }
${rules.join('\n')}
</style>`
  return { css, cls }
}

/** Centered multi-line text, as Mermaid's `byTspan`: lines stacked 14px apart around the box middle. */
function labelText(
  lines: string[],
  x: number,
  y: number,
  cls: string,
): string {
  const tspans = lines
    .map((l, i) => {
      const dy = i * 14 - (14 * (lines.length - 1)) / 2
      return `<tspan x="${r(x)}" dy="${r(dy)}">${escapeXml(l)}</tspan>`
    })
    .join('')
  return `<text x="${r(x)}" y="${r(y)}" dominant-baseline="central" alignment-baseline="central" text-anchor="middle" class="journey-label ${cls}">${tspans}</text>`
}

function faceSvg(t: PositionedJourneyTask): string {
  const cx = t.x + t.width / 2
  const cy = t.faceY
  const eyes =
    `<circle cx="${r(cx - 5)}" cy="${r(cy - 5)}" r="1.5" stroke-width="2" fill="var(--fg)" stroke="var(--fg)"/>` +
    `<circle cx="${r(cx + 5)}" cy="${r(cy - 5)}" r="1.5" stroke-width="2" fill="var(--fg)" stroke="var(--fg)"/>`
  let mouth: string
  if (t.score > 3) {
    mouth = `<path class="mouth" d="${SMILE}" transform="translate(${r(cx)},${r(cy + 2)})"/>`
  } else if (t.score < 3) {
    mouth = `<path class="mouth" d="${SAD}" transform="translate(${r(cx)},${r(cy + 7)})"/>`
  } else {
    mouth = `<line class="mouth-line" x1="${r(cx - 5)}" y1="${r(cy + 7)}" x2="${r(cx + 5)}" y2="${r(cy + 7)}" stroke-width="1"/>`
  }
  return `<circle cx="${r(cx)}" cy="${r(cy)}" class="face" r="15" stroke-width="2"/><g>${eyes}${mouth}</g>`
}

/**
 * Render a positioned journey as an SVG string.
 *
 * The accessible name is `title` (from `options.title`, or the diagram's own
 * `accTitle` via the front door), as for every type but C4: the visible
 * `title` is not used. It is dropped when `decorative` is set — see svgOpenTag() in
 * packages/core/src/theme.ts.
 */
export function renderJourneySvg(
  j: PositionedJourney,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []
  const { css, cls } = journeyStyles(j, colors, emit.nonce)
  parts.push(
    withDataSrc(
      withRootClass(
        svgOpenTag(
          j.width,
          j.height,
          colors,
          transparent,
          title,
          decorative,
          undefined,
          emit.styleAttribute,
          emit.description,
        ),
        cls,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, false, emit.nonce, emit.bodyFont))
  parts.push(css)
  parts.push(
    '<defs><marker id="journey-arrowhead" refX="5" refY="2" markerWidth="6" markerHeight="4" orient="auto"><path class="journey-arrow" d="M 0,0 V 4 L6,2 Z"/></marker></defs>',
  )

  for (const row of j.legend) {
    parts.push(
      `<circle cx="${r(row.cx)}" cy="${r(row.cy)}" class="actor-${row.pos % 6}" stroke="var(--fg)" r="7"/>`,
    )
    for (const l of row.lines) {
      parts.push(
        `<text x="40" y="${r(l.y)}" class="legend"><tspan x="${r(l.x)}">${escapeXml(l.text)}</tspan></text>`,
      )
    }
  }
  for (const s of j.sections) {
    parts.push(
      `<g><rect x="${r(s.x)}" y="${r(s.y)}" width="${r(s.width)}" height="${r(s.height)}" rx="3" ry="3" class="journey-section section-type-${s.num}"/>` +
        labelText(s.text.split(/<br\s*\/?>/i), s.x + s.width / 2, s.y + s.height / 2, '') +
        '</g>',
    )
  }
  j.tasks.forEach((t, i) => {
    const cx = t.x + t.width / 2
    const dots = t.dots
      .map(
        (d) =>
          `<circle cx="${r(d.cx)}" cy="${r(d.cy)}" class="actor-${d.pos}" stroke="var(--fg)" r="7"><title>${escapeXml(d.actor)}</title></circle>`,
      )
      .join('')
    parts.push(
      `<g><line id="task${i}" x1="${r(cx)}" y1="${r(t.y)}" x2="${r(cx)}" y2="${r(t.lineEndY)}" class="task-line" stroke-width="1" stroke-dasharray="4 2"/>` +
        faceSvg(t) +
        `<rect x="${r(t.x)}" y="${r(t.y)}" width="${r(t.width)}" height="${r(t.height)}" rx="3" ry="3" class="task task-type-${t.num} section-type-${t.num}"/>` +
        dots +
        labelText(t.lines, cx, t.y + t.height / 2, '') +
        '</g>',
    )
  })
  if (j.title) {
    parts.push(
      `<text x="${r(j.title.x)}" y="${r(j.title.y)}" font-size="33.47" font-weight="bold" class="journey-title">${escapeXml(j.title.text)}</text>`,
    )
  }
  const a = j.axis
  parts.push(
    `<line x1="${r(a.x1)}" y1="${r(a.y1)}" x2="${r(a.x2)}" y2="${r(a.y2)}" stroke-width="4" class="journey-axis" marker-end="url(#journey-arrowhead)"/>`,
  )
  parts.push('</svg>')
  return parts.join('\n')
}
