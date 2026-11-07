/**
 * #2888: each Z-shaped edge of a gap gets a bend row of its own, so strokes
 * out of one face no longer merge into shared runs (`┼`) and labels no longer
 * print over each other. Faces and order are measured against ELK's hints.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { allForkFixes } from '../demo/fork-fixes-data.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import {
  measureSample,
  redirectDirection,
} from '../scripts/lib/ascii-topology.ts'
import { bestJogRows } from '../packages/ascii-renderer/src/port-offsets.ts'
import type { Jog } from '../packages/ascii-renderer/src/port-offsets.ts'

const LONGEST = allForkFixes.find(
  (f) => f.id === 'ascii-longest-path-layering',
)!.source
const draw = (source: string): string => {
  registerAsciiLayout(asciiLayoutProvider)
  return renderMermaidASCII(source, { colorMode: 'none', layoutHints: true })
}

describe('jog row per edge (#2888)', () => {
  it('draws the labelled reciprocal pairs of `ascii-longest-path-layering` apart', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = draw(LONGEST)
    expect(text).not.toContain('┼')
    // Every label intact, none printed over another.
    expect(text.match(/long label/g)).toHaveLength(2)
    expect(text).not.toMatch(/long labelab|abx|xab/)
    expect(text.match(/(?<![a-z])ab(?![a-z])/g)).toHaveLength(2)
    // Outer strokes on the bend row nearest A, the inner pair on the next.
    expect(text).toMatch(/─x─.*─x─/)
    expect(text).toMatch(/long label─.*─ab─/)
    const { faceOk, faceEnds } = measureSample(LONGEST)
    expect(faceOk).toBe(faceEnds)
  })

  it('mirrors for BT and leaves a horizontal flow as it was', () => {
    expect(draw(LONGEST.replace('graph TD', 'graph BT'))).not.toContain('┼')
    const lr = draw(LONGEST.replace('graph TD', 'graph LR'))
    expect(lr.match(/long label/g)?.length).toBe(2)
  })

  it('falls back to a row-by-row search for a gap with many jogs', () => {
    const kids = ['B', 'C', 'D', 'E', 'F']
    const src = [
      'graph TD',
      ...kids.flatMap((k) => [`A -->|a${k}| ${k}`, `${k} -->|b${k}| A`]),
    ].join('\n')
    const text = draw(src)
    for (const k of kids) {
      expect(text).toContain(`a${k}`)
      expect(text).toContain(`b${k}`)
    }
  })

  it('keeps a trunk of strokes out of one cell on one row', () => {
    const text = draw('graph TD\nA -->|yes| B\nA -->|no| C\nB --> D\nC --> D')
    expect(text).toContain('yes')
    expect(text).toContain('no')
  })

  it('searches row by row for a gap with more jogs than it can enumerate', () => {
    // Ten disjoint strokes fit on one row: no cost, so each stays on the first.
    const jogs = Array.from({ length: 10 }, (_, i) => ({
      near: i * 10,
      far: i * 10 + 5,
    })) as Jog[]
    expect(bestJogRows(jogs, 6, 11)).toEqual(jogs.map(() => 6))
    // Two nested strokes that would merge on one row take two.
    const nested = [
      { near: 0, far: 40 },
      { near: 10, far: 30 },
      ...jogs.slice(2).map((j, i) => ({ near: 50 + i * 4, far: 52 + i * 4 })),
    ] as Jog[]
    const rows = bestJogRows(nested, 6, 11)
    expect(rows[0]).not.toBe(rows[1])
  })

  it('redraws a source in another flow direction for the topology script', () => {
    process.argv.push('--dir', 'LR')
    try {
      expect(redirectDirection('graph TD\nA --> B')).toBe('graph LR\nA --> B')
      expect(redirectDirection('stateDiagram-v2\n  A --> B')).toContain(
        'direction LR\n',
      )
    } finally {
      process.argv.splice(-2)
    }
    expect(redirectDirection('graph TD\nA --> B')).toBe('graph TD\nA --> B')
  })
})
