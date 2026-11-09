// ============================================================================
// Kanban SVG renderer
//
// Draws a PositionedKanban (see ./layout.ts) in Mermaid's structure: a
// `sections` group of column rectangles with their headings, then an `items`
// group of cards (rounded rectangle, title, ticket, assignee and the priority
// bar). Styling follows Mermaid's kanban styles.ts, mapped onto this library's
// CSS custom properties so every theme applies:
//
//   Mermaid                          here
//   cScale1..N column fills          --kb-color-N: the theme accent and
//                                    getSeriesColor() shades of it, mixed into
//                                    --bg so the cards stay readable
//   card fill / border               --_node-fill / --_node-stroke
//   labels (HTML, 16px)              <text>, 16px, one per label line
//   ticket link                      underlined, a real <a> with ticketBaseUrl
//
// Mermaid fills with its own hsl colours; here the colours follow the theme
// (a documented difference). The priority bar colours are Mermaid's.
// ============================================================================

import type {
  PositionedKanban,
  PositionedKanbanCard,
  PositionedKanbanText,
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
import { KANBAN } from './layout.ts'

const r = (n: number): string => String(Math.round(n * 100) / 100)

/** Class names a node asks for with `:::`, reduced to safe CSS identifiers. */
function userClasses(className: string | undefined): string {
  if (className === undefined) return ''
  return className
    .split(/\s+/)
    .filter((c) => /^[A-Za-z_][\w-]*$/.test(c))
    .map((c) => ` ${c}`)
    .join('')
}

function kanbanStyles(
  board: PositionedKanban,
  colors: DiagramColors,
  nonce?: string,
): { css: string; cls: string } {
  const used = board.columns.map((c) => c.colorClass)
  const vars = used.map(
    (i) =>
      `    --kb-color-${i}: ${pieColorValue(i - 1, colors.accent, colors.bg)};`,
  )
  const rules = used.map(
    (i) =>
      `  .section-${i} rect { fill: color-mix(in srgb, var(--kb-color-${i}) 32%, var(--bg)); stroke: color-mix(in srgb, var(--kb-color-${i}) 32%, var(--bg)); }`,
  )
  const cls = paletteClass(vars)
  const css = `${styleOpenTag(nonce)}
  .kb-label { fill: var(--_text); font-size: 16px; }
  .kb-heading { text-anchor: middle; }
  .kb-bold { font-weight: 700; }
  .kb-italic { font-style: italic; }
  .node rect { fill: var(--_node-fill); stroke: var(--_node-stroke); stroke-width: 1px; }
  .kanban-ticket-link .kb-label { text-decoration: underline; }
  .cluster-label .kb-label { fill: var(--_text); }
  .cluster rect { stroke-width: 1px; }
  .${cls} {
${vars.join('\n')}
  }
${rules.join('\n')}
</style>`
  return { css, cls }
}

function textSvg(t: PositionedKanbanText, centered = false): string {
  return t.lines
    .map((runs, k) => {
      const spans = runs
        .map((run) => {
          const c = `${run.bold ? 'kb-bold' : ''}${run.bold && run.italic ? ' ' : ''}${run.italic ? 'kb-italic' : ''}`
          const text = escapeXml(run.text)
          return c === '' ? text : `<tspan class="${c}">${text}</tspan>`
        })
        .join('')
      const y = t.y + KANBAN.lineHeight * (k + 0.5)
      const attrs = centered
        ? `x="${r(t.x + t.width / 2)}" class="kb-label kb-heading"`
        : `x="${r(t.x)}" class="kb-label"`
      return `<text ${attrs} y="${r(y)}" dy="0.35em" xml:space="preserve">${spans.trim()}</text>`
    })
    .join('')
}

function cardSvg(c: PositionedKanbanCard): string {
  const x = c.cx - c.width / 2
  const y = c.cy - c.height / 2
  const rad = KANBAN.cornerRadius
  let out =
    `<g class="node${userClasses(c.className)}">` +
    `<rect class="basic label-container" rx="${rad}" ry="${rad}" x="${r(x)}" y="${r(y)}" width="${r(c.width)}" height="${r(c.height)}"/>` +
    textSvg(c.title)
  if (c.ticket) {
    const ticket = textSvg(c.ticket)
    out +=
      c.ticketUrl === undefined
        ? ticket
        : `<a class="kanban-ticket-link" href="${escapeXml(c.ticketUrl)}" target="_blank" rel="noopener noreferrer">${ticket}</a>`
  }
  if (c.assigned) out += textSvg(c.assigned)
  if (c.priorityColor !== undefined) {
    const lx = x + 2
    out += `<line x1="${r(lx)}" y1="${r(y + Math.floor(rad / 2))}" x2="${r(lx)}" y2="${r(y + c.height - Math.floor(rad / 2))}" stroke-width="4"${c.priorityColor === '' ? '' : ` stroke="${c.priorityColor}"`}/>`
  }
  return out + '</g>'
}

/**
 * Render a positioned kanban board as an SVG string.
 *
 * The accessible name is `title` (from `options.title`) when given; a kanban
 * board has no title statement of its own. Both are dropped when `decorative`
 * is set, see svgOpenTag() in packages/core/src/theme.ts.
 */
export function renderKanbanSvg(
  board: PositionedKanban,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []
  const { css, cls } = kanbanStyles(board, colors, emit.nonce)
  const vb = board.viewBox
  parts.push(
    withDataSrc(
      withRootClass(
        svgOpenTag(
          vb.width,
          vb.height,
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
  parts.push(`<g transform="translate(${r(-vb.x)}, ${r(-vb.y)})">`)
  parts.push('<g class="sections">')
  for (const col of board.columns) {
    parts.push(
      `<g class="cluster section-${col.colorClass}${userClasses(col.className)}">` +
        `<rect rx="${KANBAN.cornerRadius}" ry="${KANBAN.cornerRadius}" x="${r(col.x)}" y="${r(col.y)}" width="${r(col.width)}" height="${r(col.height)}"/>` +
        `<g class="cluster-label">${textSvg(col.label, true)}</g></g>`,
    )
  }
  parts.push('</g><g class="items">')
  for (const col of board.columns)
    for (const c of col.cards) parts.push(cardSvg(c))
  parts.push('</g></g></svg>')
  return parts.join('\n')
}
