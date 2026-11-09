// #2790: C4 ASCII breaks rows on each shape's real layout width (a tall queue's
// caps widen it past 216px), not a fixed 216px. Recorded from mermaid@12.3.0,
// where four of these queues wrap to rows of 3 and 1 (queue centres at x 276,
// 627, 978, then back to 276 on the next row), while four plain 216px shapes
// stay on one row. Mermaid sizes the slot from regular-weight text, so a name
// that is only bold-wide does not widen it (four short-named queues stay on
// one row).
import { describe, expect, it } from 'vitest'
import { parseC4Diagram } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { c4Rows } from '../c4-rows.ts'

const DESCR =
  'Events and so forth here and then a great deal more text so that the description wraps over several lines in the box for sure'

const rows = (kind: string, count: number, descr: string): number[] =>
  c4Rows(
    parseC4Diagram(
      splitStatements(
        `C4Container\n` +
          Array.from(
            { length: count },
            (_, i) =>
              `  ${kind}(s${i}, "Order events queue number ${i}", "Kafka", "${descr}")`,
          ).join('\n'),
      ),
    ),
  ).shapeRows.map((r) => r.length)

describe('C4 ASCII row breaks use shape layout widths (#2790)', () => {
  it('wraps tall queues after three, as mermaid 12.3.0 does', () => {
    expect(rows('ContainerQueue', 4, DESCR)).toEqual([3, 1])
    expect(rows('ContainerQueue', 5, DESCR)).toEqual([3, 2])
  })

  it('keeps four plain containers on one row', () => {
    expect(rows('Container', 4, DESCR)).toEqual([4])
  })

  it('does not widen the slot for a bold-only-wide name', () => {
    expect(rows('ContainerQueue', 4, 'Events')).toEqual([4])
  })
})
