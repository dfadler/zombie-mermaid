/**
 * #2902: a same-pair group that runs back over more than a layer takes ELK's
 * faces, each end on a cell of its own with its own jog column, and a label on
 * a long horizontal run. Faces are measured against ELK's hints.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { allForkFixes } from '../demo/fork-fixes-data.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'

const ENTRY = allForkFixes.find((f) => f.id === 'ascii-label-canvas-edge')!
const draw = (source: string): string => {
  registerAsciiLayout(asciiLayoutProvider)
  return renderMermaidASCII(source, { colorMode: 'none', layoutHints: true })
}

describe('far same-pair group on ELK faces (#2902)', () => {
  it('puts every end of `ascii-label-canvas-edge` on ELK’s face', () => {
    const { faceOk, faceEnds } = measureSample(ENTRY.source)
    expect(faceOk).toBe(faceEnds)
  })

  it('draws it without a crossing, with both labels whole on horizontal runs', () => {
    const text = draw(ENTRY.source)
    expect(text).not.toContain('┼')
    expect(text).toMatch(/◄─+e0─+┘/)
    expect(text).toMatch(/├─+e1─+┘/)
  })

  it('mirrors for a left-to-right flow', () => {
    const text = draw(ENTRY.source.replace('direction RL', 'direction LR'))
    expect(text).toContain('e0')
    expect(text).toContain('e1')
  })

  it('keeps a diamond end on its own routing', () => {
    const text = draw(
      'graph LR\nA{x} --> B\nB --> C\nC --> D\nD -->|p| A\nD -->|q| A',
    )
    expect(text).toContain('p')
    expect(text).toContain('q')
  })

  it('draws the same group without hints as before', () => {
    registerAsciiLayout(undefined)
    const text = renderMermaidASCII(ENTRY.source, { colorMode: 'none' })
    expect(text).toContain('e1')
  })
})
