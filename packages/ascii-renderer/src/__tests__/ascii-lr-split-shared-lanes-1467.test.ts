/**
 * #1467: labeled LR edges from different sources into one node used to share
 * one under-row lane and one final drop, so a label could not be tied to its
 * edge. A run shared by 2+ labeled edges is now split into one lane each.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `flowchart LR
  A --> B
  A -->|first| C
  B -->|second| C
  A -->|third| D
  C -->|fourth| D
  B -->|fifth| D
  B -->|sixth| D
  A -->|seventh| D`

describe('LR labeled fan-in splits shared lanes (#1467)', () => {
  for (const useAscii of [false, true]) {
    const mode = useAscii ? 'ascii' : 'unicode'
    const out = renderMermaidASCII(SRC, { colorMode: 'none', useAscii })
    const rows = out.split('\n')
    const rowOf = (label: string): number =>
      rows.findIndex((r) => r.includes(label))

    it(`gives fifth, sixth and seventh a lane row each (${mode})`, () => {
      const laneRows = ['fifth', 'sixth', 'seventh'].map(rowOf)
      expect(laneRows.every((r) => r >= 0)).toBe(true)
      expect(new Set(laneRows).size).toBe(3)
      // The label sits inside its own stroke, not beside a stem.
      const stroke = useAscii ? '-' : '─'
      for (const label of ['fifth', 'sixth', 'seventh']) {
        const row = rows[rowOf(label)]!
        const at = row.indexOf(label)
        expect(row[at - 1]).toBe(stroke)
        expect(row[at + label.length]).toBe(stroke)
      }
    })

    it(`prints every label once (${mode})`, () => {
      for (const label of ['first', 'second', 'third', 'fourth']) {
        expect(out.match(new RegExp(label, 'g'))).toHaveLength(1)
      }
    })
  }

  it('leaves unlabeled fan-in on one shared lane', () => {
    const labeled = renderMermaidASCII(SRC, { colorMode: 'none' }).split('\n')
    const bare = renderMermaidASCII(SRC.replace(/\|\w+\|/g, ''), {
      colorMode: 'none',
    }).split('\n')
    expect(bare.length).toBeLessThan(labeled.length)
  })
})
