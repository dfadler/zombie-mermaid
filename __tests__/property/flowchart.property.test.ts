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
  numRuns: Number(process.env.FC_RUNS ?? 50),
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
        nodes.forEach(([[o, c], text], i) =>
          lines.push(`  n${i}${o}"${text}"${c}`),
        )
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
    // 30 s timeout: two full SVG layouts per generated case, ~4 s alone and
    // several-fold slower under full-suite worker contention (#1825).
  }, 30_000)

  it('ASCII canvas is rectangular (equal-width lines)', () => {
    fc.assert(
      fc.property(flowchartArb, fc.boolean(), (src, useAscii) => {
        const out = renderMermaidASCII(src, { colorMode: 'none', useAscii })
        const widths = new Set(out.split('\n').map((l) => [...l].length))
        expect(widths.size).toBe(1)
      }),
      PARAMS,
    )
    // 60 s timeout (#3093): 50 ASCII layouts take ~8 s at load average ~90 on
    // 12 cores (mean ~160 ms each, worst generated case ~3 s), against the 20 s
    // default, so a loaded machine could time it out with no real failure.
  }, 60_000)

  // Edge labels: every label string appears in the output at least as often as
  // the diagram holds it (labels and node texts that contain it count too, so
  // a substring match cannot hide a missing one). Domain limited to what the
  // renderer draws whole today: no self-loops, no diamonds, at most two
  // edges between one pair. Wider domains still drop labels (see the PR that
  // added this test for the sources).
  it('every edge label appears in the ASCII output', () => {
    const labelled = flowchartArb.filter((src) => {
      const edges = [
        ...src.matchAll(
          /^\s+n(\d+) \S+ n(\d+)$|^\s+n(\d+) \S+\|\w+\| n(\d+)$/gm,
        ),
      ]
      if (/n\d+\{/.test(src)) return false
      const pair = new Map<string, number>()
      for (const m of edges) {
        const a = Number(m[1] ?? m[3])
        const b = Number(m[2] ?? m[4])
        if (a === b) return false
        const k = a < b ? `${a},${b}` : `${b},${a}`
        pair.set(k, (pair.get(k) ?? 0) + 1)
      }
      return [...pair.values()].every((n) => n <= 2)
    })
    fc.assert(
      fc.property(labelled, (src) => {
        const out = renderMermaidASCII(src, { colorMode: 'none' })
        const labels = [...src.matchAll(/\|(\w+)\|/g)].map((m) => m[1]!)
        const texts = [...src.matchAll(/n\d+\S*?"(\w+)"/g)].map((m) => m[1]!)
        for (const l of new Set(labels)) {
          const need = [...labels, ...texts].filter((t) => t.includes(l)).length
          expect(out.split(l).length - 1).toBeGreaterThanOrEqual(need)
        }
      }),
      PARAMS,
    )
  }, 60_000)
})
