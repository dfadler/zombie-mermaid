import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TOLERANCE,
  agreement,
  formatRow,
  parseOracleArgs,
  worst,
  scorecardMarkdown,
  summarize,
  type Box,
  type LayoutBoxes,
} from '../scripts/lib/layout-agreement.ts'

/** A 100x40 box whose centre is at (cx, cy). */
const at = (cx: number, cy: number): Box => ({
  x: cx - 50,
  y: cy - 20,
  w: 100,
  h: 40,
})

const layout = (
  nodes: Record<string, Box>,
  groups: Record<string, Box> = {},
): LayoutBoxes => ({ nodes, groups })

describe('agreement: node pairs', () => {
  const official = layout({ A: at(100, 100), B: at(100, 300), C: at(400, 300) })

  it('is 1 on both axes for the same arrangement, whatever the scale', () => {
    // Twice the size and shifted: only the arrangement matters.
    const ours = layout({ A: at(210, 220), B: at(210, 620), C: at(810, 620) })
    expect(agreement(official, ours)).toEqual({
      vertical: 1,
      horizontal: 1,
      containment: null,
      nodes: 3,
    })
  })

  it('scores each axis on its own', () => {
    // B and C swapped sideways: vertical relations are unchanged.
    const ours = layout({ A: at(100, 100), B: at(400, 300), C: at(100, 300) })
    const a = agreement(official, ours)
    expect(a.vertical).toBe(1)
    // A-B (level to right of), A-C (left of to level) and B-C (left of to
    // right of) all change relation.
    expect(a.horizontal).toBe(0)
  })

  it('counts a flipped order as a disagreement', () => {
    // A below B instead of above it.
    const ours = layout({ A: at(100, 500), B: at(100, 300), C: at(400, 300) })
    const a = agreement(official, ours)
    // A-B and A-C flip; B-C (same row) agrees.
    expect(a.vertical).toBeCloseTo(1 / 3, 5)
    expect(a.horizontal).toBe(1)
  })

  it('treats centres within the tolerance as level, and just past it as not', () => {
    const o = layout({ A: at(100, 100), B: at(300, 100) })
    const within = layout({
      A: at(100, 100),
      B: at(300, 100 + DEFAULT_TOLERANCE),
    })
    const past = layout({
      A: at(100, 100),
      B: at(300, 100 + DEFAULT_TOLERANCE + 1),
    })
    expect(agreement(o, within).vertical).toBe(1)
    expect(agreement(o, past).vertical).toBe(0)
  })

  it('takes the tolerance as an argument', () => {
    const o = layout({ A: at(100, 100), B: at(300, 100) })
    const ours = layout({ A: at(100, 100), B: at(300, 150) })
    expect(agreement(o, ours, 20).vertical).toBe(0)
    expect(agreement(o, ours, 60).vertical).toBe(1)
  })

  it('ignores ids that only one layout has', () => {
    const ours = layout({ A: at(100, 100), B: at(100, 300), Z: at(0, 0) })
    expect(agreement(official, ours).nodes).toBe(2)
  })

  it('has nothing to compare with fewer than two shared nodes', () => {
    const a = agreement(layout({ A: at(0, 0) }), layout({ A: at(0, 0) }))
    expect(a).toEqual({
      vertical: null,
      horizontal: null,
      containment: null,
      nodes: 1,
    })
    expect(agreement(layout({}), layout({})).nodes).toBe(0)
  })
})

describe('agreement: containment', () => {
  const group: Box = { x: 0, y: 0, w: 300, h: 300 }
  const nodes = { A: at(100, 100), B: at(600, 100) }

  it('is 1 when both layouts agree on what is inside', () => {
    const both = layout(nodes, { g: group })
    expect(agreement(both, both).containment).toBe(1)
  })

  it('is lowered by a node that is inside in one layout and outside in the other', () => {
    const official = layout(nodes, { g: group })
    // B is inside the subgraph's box in ours (a non-member swallowed by it).
    const ours = layout({ A: at(100, 100), B: at(200, 100) }, { g: group })
    expect(agreement(official, ours).containment).toBe(0.5)
  })

  it.each([
    ['left', at(-200, 100)],
    ['right', at(700, 100)],
    ['above', at(100, -200)],
    ['below', at(100, 700)],
  ])('treats a node placed %s of the box as outside it', (_side, outside) => {
    const official = layout({ A: at(100, 100) }, { g: group })
    const ours = layout({ A: outside }, { g: group })
    expect(agreement(official, ours).containment).toBe(0)
  })

  it('only counts subgraphs both layouts have', () => {
    const official = layout(nodes, { g: group })
    expect(agreement(official, layout(nodes)).containment).toBeNull()
  })
})

describe('worst', () => {
  it('is the lowest figure that exists', () => {
    expect(
      worst({ vertical: 0.9, horizontal: 0.5, containment: 1, nodes: 4 }),
    ).toBe(0.5)
    expect(
      worst({ vertical: 0.9, horizontal: 0.8, containment: null, nodes: 4 }),
    ).toBe(0.8)
  })

  it('is null when there is nothing to score', () => {
    expect(
      worst({ vertical: null, horizontal: null, containment: null, nodes: 1 }),
    ).toBeNull()
  })
})

describe('parseOracleArgs', () => {
  it('has defaults', () => {
    expect(parseOracleArgs([])).toEqual({
      tolerance: DEFAULT_TOLERANCE,
      help: false,
    })
  })

  it('reads each option', () => {
    expect(
      parseOracleArgs([
        '--filter=ci',
        '--json=out.json',
        '--fail-below=75',
        '--tolerance=30',
      ]),
    ).toEqual({
      filter: 'ci',
      json: 'out.json',
      failBelow: 75,
      tolerance: 30,
      help: false,
    })
  })

  it('reads help in either form', () => {
    expect(parseOracleArgs(['-h']).help).toBe(true)
    expect(parseOracleArgs(['--help']).help).toBe(true)
  })

  it('ignores the bare -- that `pnpm run script -- --flag` forwards', () => {
    expect(parseOracleArgs(['--', '--filter=ci']).filter).toBe('ci')
  })

  it('keeps an = inside a value', () => {
    expect(parseOracleArgs(['--filter=a=b']).filter).toBe('a=b')
  })

  it.each([
    [['--nope=1'], 'Unknown argument'],
    [['positional'], 'Unknown argument'],
    [['--fail-below='], 'non-negative number'],
    [['--fail-below=abc'], 'non-negative number'],
    [['--fail-below=-5'], 'non-negative number'],
    [['--fail-below=101'], 'percentage'],
    [['--tolerance=-1'], 'non-negative number'],
  ])('rejects %j', (argv, message) => {
    expect(() => parseOracleArgs(argv)).toThrow(message)
  })

  it('accepts the bounds of --fail-below', () => {
    expect(parseOracleArgs(['--fail-below=0']).failBelow).toBe(0)
    expect(parseOracleArgs(['--fail-below=100']).failBelow).toBe(100)
  })
})

describe('formatRow', () => {
  it('shows percentages, a dash for a missing figure, and the subgraph marker', () => {
    const row = formatRow(
      'CI/CD Pipeline',
      { vertical: 0.476, horizontal: 0.524, containment: null, nodes: 7 },
      true,
    )
    expect(row).toContain(' 48%')
    expect(row).toContain(' 52%')
    expect(row).toContain('  - ')
    expect(row).toContain(' sg ')
    expect(row.endsWith('CI/CD Pipeline')).toBe(true)
  })

  it('omits the marker without subgraphs', () => {
    const row = formatRow(
      'Simple',
      { vertical: 1, horizontal: 1, containment: null, nodes: 3 },
      false,
    )
    expect(row).not.toContain('sg')
  })
})

describe('summarize / scorecardMarkdown (#1572)', () => {
  const r = (v: number | null, h: number | null, c: number | null) => ({
    vertical: v,
    horizontal: h,
    containment: c,
    nodes: 3,
    subgraphs: false,
  })
  const meta = { date: '2026-10-10', commit: 'abcdef123', tolerance: 20 }

  it('means ignore null figures', () => {
    const e = summarize({ a: r(1, null, null), b: r(0.5, null, null) }, meta)
    expect(e).toMatchObject({ samples: 2, vertical: 0.75, horizontal: null })
  })

  it('scorecard lists lowest sample first and escapes pipes', () => {
    const results = { 'hi|gh': r(1, 1, 1), low: r(0.2, 1, 1) }
    const md = scorecardMarkdown(summarize(results, meta), results, [])
    expect(md.indexOf('| low |')).toBeLessThan(md.indexOf('hi\\|gh'))
  })
})
