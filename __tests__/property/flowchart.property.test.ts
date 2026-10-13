import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

// Property tests (#1860). fast-check's value here is shrinking a failure to a
// minimal diagram and replaying it from a seed, not crash discovery.
//
// Fixed `numRuns` keeps CI fast and stable. A failure prints the seed and path
// in its message; replay with
//   fc.assert(prop, { seed: <seed>, path: '<path>' })
// (or set `FC_SEED` below). `verbose: 1` prints the shrunk counterexample.
const SEED = process.env.FC_SEED ? Number(process.env.FC_SEED) : undefined
const PARAMS: fc.Parameters<unknown> = {
  numRuns: 50,
  seed: SEED,
  verbose: 1,
}

const DIRECTIONS = ['TD', 'LR', 'RL', 'BT'] as const
const SHAPES: ReadonlyArray<readonly [string, string]> = [
  ['[', ']'],
  ['(', ')'],
  ['{', '}'],
  ['([', '])'],
]
const EDGES = ['-->', '---', '-.->', '==>'] as const

const label = fc.stringMatching(/^[A-Za-z0-9]{1,8}$/)

/** A small valid flowchart: 1-6 uniquely-id'd nodes, 0-8 edges between them. */
export const flowchartArb: fc.Arbitrary<string> = fc
  .record({
    dir: fc.constantFrom(...DIRECTIONS),
    nodes: fc.array(fc.tuple(fc.constantFrom(...SHAPES), label), {
      minLength: 1,
      maxLength: 6,
    }),
  })
  .chain(({ dir, nodes }) =>
    fc
      .array(
        fc.record({
          from: fc.nat(nodes.length - 1),
          to: fc.nat(nodes.length - 1),
          op: fc.constantFrom(...EDGES),
          text: fc.option(label, { nil: undefined }),
        }),
        { maxLength: 8 },
      )
      .map((edges) => {
        const lines = [`flowchart ${dir}`]
        nodes.forEach(([[o, c], text], i) => lines.push(`  n${i}${o}"${text}"${c}`))
        for (const e of edges) {
          const op = e.text ? `${e.op}|${e.text}|` : e.op
          lines.push(`  n${e.from} ${op} n${e.to}`)
        }
        return lines.join('\n')
      }),
  )

describe('flowchart properties (#1860)', () => {
  it('parse never throws on generated valid input', () => {
    fc.assert(
      fc.property(flowchartArb, (src) => {
        expect(() => parseMermaid(src)).not.toThrow()
      }),
      PARAMS,
    )
  })

  it('SVG render is deterministic', () => {
    fc.assert(
      fc.property(flowchartArb, (src) => {
        expect(renderMermaidSVG(src)).toBe(renderMermaidSVG(src))
      }),
      PARAMS,
    )
  })

  it('ASCII canvas is rectangular (equal-width lines)', () => {
    fc.assert(
      fc.property(flowchartArb, fc.boolean(), (src, useAscii) => {
        const out = renderMermaidASCII(src, { colorMode: 'none', useAscii })
        const widths = new Set(out.split('\n').map((l) => [...l].length))
        expect(widths.size).toBe(1)
      }),
      PARAMS,
    )
  })
})
