/**
 * #2913 bullet 3: a decision with three ends on its entry face (the way in and
 * two returns) gives each its own cell, as mermaid@12.3.0 draws `Git Branching
 * Workflow`'s `G{Tests?}`: the F->G arrowhead and the pass and fail strokes end
 * on the vertex and the two slants, not on one shared stem (`┌┴┬─►`).
 * Not checked on GitHub / mermaid.live.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'
import { samples } from '../samples/samples-data.ts'

const draw = (source: string, hints: boolean): string => {
  registerAsciiLayout(hints ? asciiLayoutProvider : undefined)
  try {
    return renderMermaidASCII(source, { colorMode: 'none' })
  } finally {
    registerAsciiLayout(undefined)
  }
}

const SRC = samples.find((s) => s.title === 'Git Branching Workflow')!.source
const dir = (d: string): string => SRC.replace('graph LR', `graph ${d}`)

describe('a decision’s entry face gives three ends a cell each (#2913)', () => {
  it('LR: entry arrowhead on the vertex, no stem shared with the returns', () => {
    const out = draw(dir('LR'), true)
    expect(out).toContain('►< Tests? >')
    expect(out).not.toMatch(/[┴┬]─►/)
    expect(out).toMatch(/╱ {6}╲/)
    // One stroke starts on each slant of the entry face
    expect(out).toMatch(/└─+╱/)
    expect(out).toMatch(/┌─+╲/)
  })

  it('RL is the mirror of LR', () => {
    const lr = draw(dir('LR'), true).split('\n')
    const rl = draw(dir('RL'), true).split('\n')
    expect(rl.length).toBe(lr.length)
    expect(rl.join('\n')).toContain('< Tests? >◄')
    expect(rl.join('\n')).not.toMatch(/◄─[┬┴]/)
  })

  it('scores every end cell and arrowhead of the decision in the topology gate', () => {
    const c = measureSample(dir('LR'))
    // Before: 9/10 end cells and 9/10 arrowheads (the entry and returns shared one).
    expect(c.endCells).toBe(c.endCellsWant)
    expect(c.arrows).toBe(c.arrowsWant)
  })

  it.each(['LR', 'RL', 'TD', 'BT'])(
    '%s: snapshots SVG and ASCII (grid and ELK hints)',
    (d) => {
      expect(renderMermaidSVG(dir(d))).toMatchSnapshot('svg')
      expect(draw(dir(d), false)).toMatchSnapshot('ascii-grid')
      expect(draw(dir(d), true)).toMatchSnapshot('ascii-hints')
    },
  )
})
