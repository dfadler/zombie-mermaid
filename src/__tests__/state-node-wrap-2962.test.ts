/**
 * #2962: mermaid@12.3.0 sizes a state box from its label wrapped at 120px
 * (24px a line, 8px a side and 16px top and bottom), measured at 16px.
 */
// Provenance (#2679): expected sizes are measured from mermaid@12.3.0 (headless, scripts/lib/real-mermaid.ts), not this renderer's own output.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setTrebuchetMetrics, wrapFlowchartLabel } from '@zombie-mermaid/core'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'
import { estimateNodeSize } from '../../packages/svg-renderer/src/layout-engine/to-elk.ts'

const size = (label: string, shape = 'rounded') =>
  estimateNodeSize('Y', label, shape, 13, undefined, 'TD', true)

describe('state node size (#2962)', () => {
  // The default font is mermaid's Trebuchet stack at render time; set it here.
  beforeEach(() => setTrebuchetMetrics(true))
  afterAll(() => setTrebuchetMetrics(false))

  it('keeps the 136 x 40 minimum for a short label', () => {
    expect(size('A')).toEqual({ width: 136, height: 40 })
    expect(size('A', 'rectangle')).toEqual({ width: 136, height: 40 })
  })

  it('widens to the label plus 16px when it fits on one line', () => {
    expect(size('x'.repeat(20)).width).toBeCloseTo(176.31, 1)
    expect(size('x'.repeat(30)).width).toBeCloseTo(256.47, 1)
  })

  it('wraps a spaced label at 120px and grows 24px a line', () => {
    const one = size('Wait Idle Ready Running Active Failed Paused Done')
    expect(one.width).toBe(136)
    expect(one.height % 24).toBe(16)
    expect(one.height).toBeGreaterThan(40)
  })

  it('draws the wrapped label on separate lines inside the node', () => {
    const svg = renderMermaidSVG(
      'stateDiagram-v2\n  Y: Wait Idle Ready Running Active Failed Paused Done\n  [*] --> Y',
    )
    expect(svg).toContain('>Wait Idle Ready</tspan>')
    expect(svg).toContain('>Running Active</tspan>')
  })

  it('sizes the box by the same rule when the diagram has no [*]', () => {
    const svg = renderMermaidSVG(
      'stateDiagram-v2\n  Y: Wait Idle Ready Running Active Failed Paused Done\n  Y --> Z',
    )
    expect(svg).toContain('>Running Active</tspan>')
    expect(svg).toMatch(/width="136"[^>]*height="112"/)
  })

  it('wraps the label in ASCII at the same words, as a 2 x 2 grid', () => {
    const ascii = renderMermaidASCII(
      'stateDiagram-v2\n  [*] --> W\n  state W {\n    A: Wait Idle Ready Running Active Failed Paused Done\n    --\n    B\n    --\n    C\n    --\n    D\n  }',
      { colorMode: 'none' },
    )
    expect(ascii).toContain('Wait Idle Ready')
    expect(ascii).toContain('Running Active')
    expect(ascii).toContain('Failed Paused')
    expect(ascii).not.toContain('Wait Idle Ready Running')
  })

  it('leaves a flowchart label and a state note alone in ASCII', () => {
    const f = renderMermaidASCII(
      'flowchart TD\n  A[Wait Idle Ready Running Active]',
      { colorMode: 'none' },
    )
    expect(f).toContain('Wait Idle Ready Running Active')
  })

  it('keeps bold on every line of a wrapped label', () => {
    const svg = renderMermaidSVG(
      'stateDiagram-v2\n  Y: <b>Wait Idle Ready Running Active Failed Paused Done</b>\n  [*] --> Y',
    )
    expect(svg).not.toMatch(/<\/b>/)
    expect(
      (svg.match(/font-weight="bold"/g) ?? []).length,
    ).toBeGreaterThanOrEqual(4)
  })

  it('places the four regions in two rows and two columns in ASCII', () => {
    const rows = renderMermaidASCII(
      'stateDiagram-v2\n  state W {\n    A: Wait Idle Ready Running Active Failed Paused Done\n    --\n    B\n    --\n    C\n    --\n    D\n  }',
      { colorMode: 'none' },
    ).split('\n')
    // Region frames are drawn dotted: four tops, two rows, two columns.
    const tops = rows.flatMap((r, y) =>
      [...r.matchAll(/[┌├]┄/g)].map((m) => [y, m.index!] as const),
    )
    expect(tops).toHaveLength(4)
    expect(new Set(tops.map(([y]) => y)).size).toBe(2)
    expect(new Set(tops.map(([, x]) => x)).size).toBe(2)
  })

  it('wraps around markup without an empty line or a split tag', () => {
    const w = (l: string): string => wrapFlowchartLabel(l, 16, 500).text
    expect(w('<b> Supercalifragilisticexpialidocious </b>')).not.toContain(
      '<b></b>',
    )
    expect(
      w('<b >Wait Idle Ready Running Active Failed Paused Done</b >'),
    ).not.toMatch(/<\/b$/m)
    expect(w('a </u> b').split('\n')).toHaveLength(1)
  })
})
