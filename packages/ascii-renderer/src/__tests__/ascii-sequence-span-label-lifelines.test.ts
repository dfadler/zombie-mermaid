// A label on a message that spans several participants must not blank the
// lifelines of the participants it merely passes over (issue #1119).
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `sequenceDiagram
  participant G
  participant A
  participant U
  participant O
  participant N
  G->>A: Validate token
  G->>U: Get user
  G->>O: Get orders
  G->>N: Send notification`

describe.each([false, true])(
  'span label keeps lifelines (useAscii=%s)',
  (ascii) => {
    it('leaves every intermediate lifeline intact on the label row', () => {
      const lines = renderMermaidASCII(SRC, { useAscii: ascii }).split('\n')
      const bar = ascii ? '|' : '│'
      const spacer = lines.find((l) => l.split(bar).length - 1 === 5)!
      for (const label of ['Send notification', 'Get orders']) {
        const row = lines.find((l) => l.includes(label))!
        // Every column that is a lifeline on the spacer row stays one here.
        for (let x = 0; x < spacer.length; x++) {
          if (spacer[x] === bar) expect(row[x]).toBe(bar)
        }
      }
    })
  },
)
