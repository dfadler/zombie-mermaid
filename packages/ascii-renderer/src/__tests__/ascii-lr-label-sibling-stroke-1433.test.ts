/**
 * #1433: in an LR graph a label centred on a horizontal run covered the
 * sibling stem dropping off the same node, so B --> D had no visible path out
 * of B (the mirror of the TD stem case in #1413).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { slideClearOf } from '../draw-arrows.ts'

const SRC = `flowchart LR
  A --> B
  A -->|first| C
  B -->|second| C
  A -->|third| D
  C -->|fourth| D
  B -->|fifth| D`

describe('LR label clear of a sibling stem (#1433)', () => {
  it('keeps every node-to-lane stem (unicode)', () => {
    const rows = renderMermaidASCII(SRC, { colorMode: 'none' }).split('\n')
    const row = rows.find((r) => r.includes('│ B ├'))!
    // A, B and C each tee down into the shared lane.
    expect(row.match(/┬/g)).toHaveLength(3)
  })

  it('draws every label, even where two edges share a drop into D (unicode)', () => {
    const out = renderMermaidASCII(SRC, { colorMode: 'none' })
    for (const label of ['first', 'second', 'third', 'fourth', 'fifth']) {
      expect(out).toContain(label)
    }
  })

  it('still draws the moved labels (ascii)', () => {
    const out = renderMermaidASCII(SRC, { colorMode: 'none', useAscii: true })
    for (const label of ['first', 'second', 'third', 'fourth', 'fifth']) {
      expect(out).toContain(label)
    }
  })
})

describe('slideClearOf (#1433)', () => {
  const at = (y: number, text = 'fifth') => [{ x: 30, y, text }]

  it('leaves a label that clears every taken label alone', () => {
    expect(slideClearOf(at(4), at(3), 2, 6)).toEqual(at(4))
  })

  it('slides to the nearest free interior row, preferring the one below', () => {
    expect(slideClearOf(at(4), at(4), 2, 6)).toEqual(at(5))
    expect(slideClearOf(at(4), [...at(4), ...at(5)], 2, 6)).toEqual(at(3))
  })

  it('never lands on a stroke end, and stays put when no interior row is free', () => {
    const taken = [...at(3), ...at(4), ...at(5)]
    expect(slideClearOf(at(4), taken, 2, 6)).toEqual(at(4))
    expect(slideClearOf([...at(4), ...at(5, 'x')], at(4), 2, 6)).toEqual([
      ...at(4),
      ...at(5, 'x'),
    ])
  })
})
