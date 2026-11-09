// ============================================================================
// Kanban layout
//
// Turns a parsed Kanban into Mermaid 12.3.0's geometry (packages/mermaid/src/
// diagrams/kanban/kanbanRenderer.ts and rendering-elements/shapes/kanbanItem.ts):
//
//   - column N (1-based) is `sectionWidth` (200) wide and centred at
//     `width * N + (N - 1) * 5`, its top at `-1.5 * width`; the gap between
//     columns is 5px
//   - a column's heading is a label at its top, 24px per line; the cards start
//     below the tallest heading (at least 25px)
//   - a card is `width - 15` wide and centred in its column; its title wraps at
//     `width - 25` (a label whose longest line reaches that), 24px per line;
//     ticket (left) and assigned (right) share a second row under the title
//     when either is set; the card is the title height + 20, plus half a row
//     (12px) when there is a second row
//   - cards are 5px apart; the column ends 30px under the last card (50px at
//     the least), plus any heading height above 25px
//   - a `priority` draws a 4px bar 2px inside the card's left edge
//   - the viewBox is the content bounds plus 10px all round
//
// Text widths come from Trebuchet MS advances (Mermaid's default font), so line
// breaks match Mermaid's; its colours do not (see ./renderer.ts).
// ============================================================================

import type {
  Kanban,
  KanbanCard,
  MindmapTextRun,
  PositionedKanban,
  PositionedKanbanCard,
  PositionedKanbanColumn,
  PositionedKanbanText,
} from '@zombie-mermaid/mermaid-parser'
import { layoutLabel } from '../mindmap/layout.ts'
import { textWidth } from '../timeline/layout.ts'

/** Mermaid's kanban defaults. */
export const KANBAN = {
  sectionWidth: 200,
  /** Space between cards (halved between columns) and the base of the column's bottom margin. */
  padding: 10,
  lineHeight: 24,
  /** Vertical space a card adds around its title. */
  cardPadding: 20,
  /** Smallest heading allowance, and smallest column height. */
  minHeading: 25,
  minColumn: 50,
  viewBoxPadding: 10,
  cornerRadius: 5,
} as const

const PRIORITY_COLORS: Record<string, string> = {
  'Very High': 'red',
  High: 'orange',
  Low: 'blue',
  'Very Low': 'lightblue',
}

/** An ideograph or kana at 16px in Chrome on macOS (the fallback CJK font); Latin text uses Trebuchet MS. */
const CJK_ADVANCE = 16.328125
const CJK_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu

const measure = (run: MindmapTextRun): number => {
  const cjk = run.text.match(CJK_CHAR)?.length ?? 0
  return (
    cjk * CJK_ADVANCE + textWidth(run.text.replace(CJK_CHAR, ''), 16, run.bold)
  )
}

function label(text: string | undefined, max: number) {
  if (!text) return { lines: [] as MindmapTextRun[][], width: 0, height: 0 }
  // A nowrap label collapses runs of spaces.
  return layoutLabel(text.replace(/[ \t]+/g, ' '), max, measure, true)
}

function textAt(
  l: ReturnType<typeof label>,
  x: number,
  y: number,
): PositionedKanbanText {
  return { lines: l.lines, x, y, width: l.width, height: l.height }
}

/** Mermaid's `ticketBaseUrl.replace('#TICKET#', ticket)` (first occurrence only). */
function ticketLink(card: KanbanCard, base: string | undefined) {
  return card.ticket && base ? base.replace('#TICKET#', card.ticket) : undefined
}

/** Lay a kanban board out; all coordinates are in Mermaid's space, `viewBox` says where its origin is. */
export function layoutKanban(kanban: Kanban): PositionedKanban {
  const W = kanban.config?.sectionWidth || KANBAN.sectionWidth
  const pad = KANBAN.padding
  const cardWidth = W - 1.5 * pad
  const textMax = cardWidth - 10
  const columns: PositionedKanbanColumn[] = []
  const headings = kanban.columns.map((c) => label(c.text, W))
  const maxHeading = Math.max(
    KANBAN.minHeading,
    ...headings.map((h) => h.height),
  )
  const top = (-W * 3) / 2 + maxHeading

  kanban.columns.forEach((col, n) => {
    const cnt = n + 1
    const cx = W * cnt + ((cnt - 1) * pad) / 2
    let y = top
    const cards: PositionedKanbanCard[] = col.cards.map((card) => {
      const title = label(card.text, textMax)
      const ticket = label(card.ticket, textMax)
      const assigned = label(card.assigned, textMax)
      const heightAdj = Math.max(ticket.height, assigned.height) / 2
      const height = title.height + KANBAN.cardPadding + heightAdj
      const cy = y + height / 2
      y = cy + height / 2 + pad / 2
      const left = cx - cardWidth / 2 + 10
      const rowTop = cy - heightAdj + title.height / 2
      const href = ticketLink(card, kanban.config?.ticketBaseUrl)
      const placed: PositionedKanbanCard = {
        cx,
        cy,
        width: cardWidth,
        height,
        title: textAt(title, left, cy - heightAdj - title.height / 2),
        ...(ticket.height > 0 && { ticket: textAt(ticket, left, rowTop) }),
        ...(assigned.height > 0 && {
          assigned: textAt(
            assigned,
            cx + 10 + cardWidth / 2 - assigned.width - 20,
            rowTop,
          ),
        }),
        ...(href !== undefined && { ticketUrl: href }),
        // Any priority draws a bar; only the five known names colour it.
        ...(card.priority !== undefined && {
          priorityColor: PRIORITY_COLORS[card.priority] ?? '',
        }),
        ...(card.className !== undefined && { className: card.className }),
      }
      return placed
    })
    const heading = headings[n]!
    columns.push({
      x: cx - W / 2,
      y: (-W * 3) / 2,
      width: W,
      height:
        Math.max(y - top + 3 * pad, KANBAN.minColumn) +
        (maxHeading - KANBAN.minHeading),
      colorClass: cnt,
      label: textAt(heading, cx - heading.width / 2, (-W * 3) / 2),
      ...(col.className !== undefined && { className: col.className }),
      cards,
    })
  })

  // Mermaid's bbox includes label boxes that overflow (a word wider than its box).
  const texts = columns.flatMap((c) => [
    c.label,
    ...c.cards.flatMap((k) => [k.title, k.ticket, k.assigned]),
  ])
  const minX = Math.min(
    ...columns.map((c) => c.x),
    ...texts.flatMap((t) => (t ? [t.x] : [])),
  )
  const maxX = Math.max(
    ...columns.map((c) => c.x + c.width),
    ...texts.flatMap((t) => (t ? [t.x + t.width] : [])),
  )
  const minY = (-W * 3) / 2
  const maxY = Math.max(...columns.map((c) => c.y + c.height))
  const vp = KANBAN.viewBoxPadding
  const empty = columns.length === 0
  return {
    viewBox: empty
      ? { x: 0, y: 0, width: 2 * vp, height: 2 * vp }
      : {
          x: minX - vp,
          y: minY - vp,
          width: maxX - minX + 2 * vp,
          height: maxY - minY + 2 * vp,
        },
    columns,
  }
}
