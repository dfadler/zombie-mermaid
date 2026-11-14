/**
 * Fan-in landing cells (#2678, #2913): every edge into a node ends on a cell of
 * its own with its own arrowhead, as mermaid@12.3.0 draws `A & B --> C`, a
 * decision whose branches rejoin and a state join bar. The topology gate counts
 * the end cells and arrowheads (end cells 375/379 -> 379/379, arrowheads
 * 391/395 -> 395/395). Where a node is too narrow for a stroke each (3 strokes
 * need 5 interior cells a spacing apart) or a self-loop holds its top face, the
 * strokes keep one trunk, as before.
 * Not checked on GitHub / mermaid.live.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { renderMermaidSVG } from '../packages/svg-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'
import { samples } from '../samples/samples-data.ts'

const draw = (source: string, hints: boolean, useAscii = false): string => {
  registerAsciiLayout(hints ? asciiLayoutProvider : undefined)
  try {
    return renderMermaidASCII(source, { colorMode: 'none', useAscii })
  } finally {
    registerAsciiLayout(undefined)
  }
}

const sample = (title: string): string =>
  samples.find((s) => s.title === title)!.source

const heads = (out: string): number => (out.match(/[▼▲◄►]/g) ?? []).length

/** The columns of the first `▼ ▼` pair: the two strokes' landing cells. */
const landing = (out: string): [number, number] => {
  const row = out.split('\n').find((r) => /▼ ▼/.test(r))!
  return [row.indexOf('▼'), row.lastIndexOf('▼')]
}

const AMP = 'graph TD\n  A & B --> C'
const CASES: Record<string, string> = {
  'A & B --> C': AMP,
  'diamond fan-in': sample('Text-Embedded Labels'),
  'parallel links': sample('Parallel Links (&)'),
  'colour-coded edges': sample('linkStyle: Color-Coded Edges'),
  'state join': sample('State: Choice, Fork and Join'),
  'three strokes, narrow target': 'graph TD\n  A & B & C --> D',
  'self-loop on the target': 'graph TD\n  A & B --> D\n  D --> D',
}

describe('fan-in landing cells (#2678)', () => {
  for (const hints of [false, true]) {
    describe(
      hints ? 'with the layout provider' : 'without a layout provider',
      () => {
        it('A & B --> C: two strokes, two arrowheads, either side of the centre', () => {
          const out = draw(AMP, hints)
          expect(heads(out)).toBe(2)
          const [l, r] = landing(out)
          const c = out
            .split('\n')
            .find((row) => row.includes('C'))!
            .indexOf('C')
          expect((l + r) / 2).toBe(c)
          expect(r - l).toBe(2)
        })

        it('a diamond that rejoins: Finish gets one arrowhead per branch', () => {
          const out = draw(CASES['diamond fan-in']!, hints)
          // Start, Yes, No, then C and D each into Finish.
          expect(heads(out)).toBe(5)
          expect(out).toMatch(/▼ ▼/)
        })

        it('a join bar takes a landing cell per incoming edge', () => {
          const out = draw(CASES['state join']!, hints)
          const [l, r] = landing(out)
          expect(r - l).toBe(2)
          expect(heads(out)).toBe(7)
        })

        it('keeps one trunk where the node is too narrow for a stroke each', () => {
          expect(
            heads(draw(CASES['three strokes, narrow target']!, hints)),
          ).toBe(1)
        })

        it('keeps one trunk when a self-loop holds the node', () => {
          const out = draw(CASES['self-loop on the target']!, hints)
          expect(out.match(/▼/g)).toHaveLength(1)
        })

        it('draws the ASCII charset the same way', () => {
          const out = draw(AMP, hints, true)
          expect(out.match(/v/g)).toHaveLength(2)
          expect(out).toMatch(/v v/)
        })
      },
    )
  }

  it.each([
    'A & B --> C',
    'diamond fan-in',
    'parallel links',
    'colour-coded edges',
    'state join',
  ])('topology gate: %s scores every end cell and arrowhead', (name) => {
    const c = measureSample(CASES[name]!)
    expect(c.endCells).toBe(c.endCellsWant)
    expect(c.arrows).toBe(c.arrowsWant)
  })

  describe.each(Object.entries(CASES))('%s', (_name, source) => {
    it.each(['TD', 'BT'])(
      '%s: snapshots SVG and ASCII (grid and ELK hints)',
      (d) => {
        const src = source.replace(
          /^(\s*(?:graph|flowchart))\s+\w+/m,
          `$1 ${d}`,
        )
        const dirSrc = /^\s*stateDiagram/m.test(source)
          ? source.replace(
              /^(\s*stateDiagram[^\n]*\n)/m,
              `$1  direction ${d}\n`,
            )
          : src
        expect(renderMermaidSVG(dirSrc)).toMatchSnapshot('svg')
        expect(draw(dirSrc, false)).toMatchSnapshot('ascii-grid')
        expect(draw(dirSrc, true)).toMatchSnapshot('ascii-hints')
      },
    )
  })
})
