// #2723: C4 ASCII places shapes in the rows mermaid 12.3.0 does. The fixture
// holds the position mermaid drew every element at (recorded for the SVG
// renderer), so rows and order here are checked against the real thing.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseC4Diagram } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { c4Rows } from '../c4-rows.ts'
import type { C4Frame } from '../c4-rows.ts'
import { renderMermaidASCII } from '../index.ts'

interface Ref {
  name: string
  source: string
  elements: Record<string, [number, number]>
}
const refs = JSON.parse(
  readFileSync(
    new URL(
      '../../../svg-renderer/src/__tests__/fixtures/c4-mermaid-reference.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as Ref[]

/** Shape rows of every frame, outermost first. */
const shapeRows = (f: C4Frame): string[][] => [
  ...f.shapeRows.map((r) => r.map((e) => e.alias)),
  ...f.boundaryRows.flat().flatMap(shapeRows),
]

/** Consecutive rows of one frame, as alias lists. */
const framePairs = (f: C4Frame): [string[], string[]][] => [
  ...f.shapeRows
    .slice(1)
    .map(
      (r, i) =>
        [f.shapeRows[i]!.map((e) => e.alias), r.map((e) => e.alias)] as [
          string[],
          string[],
        ],
    ),
  ...f.boundaryRows.flat().flatMap(framePairs),
]

describe('C4 row placement matches mermaid 12.3.0 (#2723)', () => {
  it.each(refs.map((r) => [r.name, r] as const))('%s', (_n, ref) => {
    const rows = shapeRows(c4Rows(parseC4Diagram(splitStatements(ref.source))))
    const frame = c4Rows(parseC4Diagram(splitStatements(ref.source)))
    // A new row only where mermaid starts one: it wraps back to the left and
    // sits below every centre of the row before (tops are aligned, so centres
    // within a row differ by height and cannot be compared for equality).
    for (const [prev, next] of framePairs(frame)) {
      const at = (a: string) => ref.elements[a]!
      // (centres: a lone shape stacked under another may sit a little right)
      expect(at(next[0]!)[0]).toBeLessThan(at(prev.at(-1)!)[0] + 60)
      for (const n of next) {
        for (const p of prev) expect(at(n)[1]).toBeGreaterThan(at(p)[1])
      }
    }
    for (const row of rows) {
      const pos = row.map((a) => ref.elements[a]!)
      // A row runs left to right in declaration order.
      for (let i = 1; i < pos.length; i++) {
        expect(pos[i]![0]).toBeGreaterThan(pos[i - 1]![0])
      }
    }
  })

  it('puts the E-mail System beside the Person, above the boundary', () => {
    const out = renderMermaidASCII(
      `C4Context
  Person(customer, "Customer")
  Enterprise_Boundary(b0, "Bank") {
    System(banking, "Banking")
    SystemDb(ledger, "Ledger")
  }
  System_Ext(mail, "E-mail System")
  Rel(banking, mail, "Sends e-mail using")`,
    ).split('\n')
    const row = (s: string) => out.findIndex((l) => l.includes(s))
    expect(row('E-mail System')).toBeLessThan(row('Bank'))
    expect(row('Customer')).toBeLessThan(row('Bank'))
    const col = (s: string) => out.find((l) => l.includes(s))!.indexOf(s)
    expect(col('Banking')).toBeLessThan(col('Ledger'))
  })
})
