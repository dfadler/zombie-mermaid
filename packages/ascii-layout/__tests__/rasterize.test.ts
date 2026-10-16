import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  layoutFlowchart,
  UnsupportedFlowchartError,
  type FlowchartLayout,
} from '@zombie-mermaid/elk-layout'
import { samples } from '../../site/samples-data.ts'
import {
  rasterizeLayout,
  type RasterBox,
  type RasterResult,
} from '../src/index.ts'

// Golden ASCII for the layout module's fixture sources (d1-d3 are the dense duplicate/reciprocal/
// self-loop cases, WITH node declarations: declaration order moves mermaid's layout). No SVG
// golden exists: this path draws characters only, and the SVG renderer is untouched.
// Regenerate after an intentional change, review the diff, then:
//   UPDATE_ASCII_LAYOUT=1 pnpm exec vitest run -c config/vitest.config.ts packages/ascii-layout
const SOURCES = new URL('../../elk-layout/__tests__/fixtures/', import.meta.url)
const GOLDENS = new URL('./fixtures/', import.meta.url)
const fixtures = readdirSync(SOURCES).filter((f) => f.endsWith('.mmd'))

interface Case {
  name: string
  layout: FlowchartLayout
  r: RasterResult
}
const cases: Case[] = []
const galleryCases: Case[] = []
const build = async (name: string, src: string, into: Case[]) => {
  try {
    const layout = await layoutFlowchart(src)
    into.push({ name, layout, r: rasterizeLayout(layout) })
  } catch (e) {
    if (!(e instanceof UnsupportedFlowchartError)) throw e
  }
}
for (const f of fixtures)
  await build(f, readFileSync(new URL(f, SOURCES), 'utf8'), cases)
for (const [i, s] of samples.entries())
  if (/^\s*(flowchart|graph)\b/.test(s.source))
    await build(`sample ${i}`, s.source, galleryCases)

const rowsOf = (r: RasterResult) => r.text.split('\n')
const cell = (rows: string[], x: number, y: number) => rows[y]?.[x] ?? ' '
const inBox = (boxes: RasterBox[], x: number, y: number) =>
  boxes.some((b) => x >= b.c0 && x <= b.c1 && y >= b.r0 && y <= b.r1)

// A line that leaves a face (an arrowhead does not: it takes the cell outside and leaves the border plain).
const LINE = '│─┼┌┐└┘├┤┬┴'

/** Every box border cell is a plain border glyph, or a tee on a face with a line leaving it. */
function borderProblems({ r }: Case): string[] {
  const rows = rowsOf(r)
  const bad: string[] = []
  for (const b of r.boxes)
    for (let y = b.r0; y <= b.r1; y++)
      for (let x = b.c0; x <= b.c1; x++) {
        const g = cell(rows, x, y)
        const top = y === b.r0
        const bot = y === b.r1
        const lft = x === b.c0
        const rgt = x === b.c1
        const where = `${b.id}@${x},${y}`
        if ((top || bot) && (lft || rgt)) {
          const want = top ? (lft ? '┌' : '┐') : lft ? '└' : '┘'
          if (g !== want) bad.push(`${where} corner ${g}`)
        } else if (top || bot) {
          const outside = cell(rows, x, top ? y - 1 : y + 1)
          if (g === '─') continue
          if (g !== (top ? '┴' : '┬') || !LINE.includes(outside))
            bad.push(`${where} face ${g}`)
        } else if (lft || rgt) {
          const outside = cell(rows, lft ? x - 1 : x + 1, y)
          if (g === '│') continue
          if (g !== (lft ? '┤' : '├') || !LINE.includes(outside))
            bad.push(`${where} face ${g}`)
        } else if ('─│┌┐└┘├┤┬┴┼►◄▲▼'.includes(g)) {
          bad.push(`${where} line inside box ${g}`)
        }
      }
  return bad
}

const POINTS: Record<string, [number, number]> = {
  '▲': [0, -1],
  '►': [1, 0],
  '▼': [0, 1],
  '◄': [-1, 0],
}
/** Every arrowhead touches a face (not a corner) and sits on the line of its stem. */
function arrowProblems({ r }: Case): string[] {
  const rows = rowsOf(r)
  const bad: string[] = []
  rows.forEach((row, y) =>
    [...row].forEach((g, x) => {
      const d = POINTS[g]
      if (!d || inBox(r.boxes, x, y)) return
      const tx = x + d[0]
      const ty = y + d[1]
      const b = r.boxes.find(
        (q) => tx >= q.c0 && tx <= q.c1 && ty >= q.r0 && ty <= q.r1,
      )
      const isCorner =
        b && (tx === b.c0 || tx === b.c1) && (ty === b.r0 || ty === b.r1)
      if (!b || isCorner) bad.push(`${g}@${x},${y} not on a face`)
      if (cell(rows, x - d[0], y - d[1]) === ' ')
        bad.push(`${g}@${x},${y} has no stem`)
    }),
  )
  return bad
}

/** Outside boxes, lines only cross (┼); a T-junction would mean two lines overlapped. */
function crossingProblems({ r }: Case): string[] {
  const rows = rowsOf(r)
  const bad: string[] = []
  rows.forEach((row, y) =>
    [...row].forEach((g, x) => {
      if (inBox(r.boxes, x, y)) return
      if ('├┤┬┴'.includes(g)) bad.push(`${g}@${x},${y} junction outside a box`)
      if (g === '┼') {
        const ok =
          '│┼┌┐├┤┬▲▼'.includes(cell(rows, x, y - 1)) &&
          '│┼└┘├┤┴▲▼'.includes(cell(rows, x, y + 1)) &&
          '─┼┌└├┬┴►◄'.includes(cell(rows, x + 1, y)) &&
          '─┼┐┘┤┬┴►◄'.includes(cell(rows, x - 1, y))
        if (!ok) bad.push(`┼@${x},${y} is not a straight right-angle crossing`)
      }
    }),
  )
  return bad
}

const maxBoxError = ({ layout, r }: Case) =>
  Math.max(
    ...layout.nodes.map((n) => {
      const b = r.boxes.find((q) => q.id === n.id)!
      return Math.max(
        Math.abs(((b.c1 - b.c0 + 1) * 5) / n.w - 1),
        Math.abs(((b.r1 - b.r0 + 1) * 10) / n.h - 1),
      )
    }),
  )

describe('ascii-layout: goldens', () => {
  it('covers d1-d3', () =>
    expect(fixtures).toEqual(
      expect.arrayContaining(['d1.mmd', 'd2.mmd', 'd3.mmd']),
    ))
  it.each(cases.map((c) => [c.name, c] as const))(
    '%s matches its golden',
    (name, c) => {
      const golden = new URL(name.replace(/\.mmd$/, '.ascii.txt'), GOLDENS)
      if (process.env.UPDATE_ASCII_LAYOUT)
        writeFileSync(golden, c.r.text + '\n')
      expect(c.r.text + '\n').toBe(readFileSync(golden, 'utf8'))
    },
  )
})

describe.each([
  ['fixtures', cases],
  ['gallery flat samples', galleryCases],
])('ascii-layout: invariants over %s', (_, list) => {
  it('is not empty', () => expect(list.length).toBeGreaterThan(8))
  it.each(list.map((c) => [c.name, c] as const))(
    '%s: borders intact',
    (_n, c) => expect(borderProblems(c)).toEqual([]),
  )
  it.each(list.map((c) => [c.name, c] as const))(
    '%s: arrowheads on a face, on their stem',
    (_n, c) => expect(arrowProblems(c)).toEqual([]),
  )
  it.each(list.map((c) => [c.name, c] as const))(
    '%s: crossings are right-angle only',
    (_n, c) => {
      expect(crossingProblems(c)).toEqual([])
      expect(c.r.stats.relaxed).toBe(false)
    },
  )
  it.each(list.map((c) => [c.name, c] as const))(
    '%s: stats agree with the text',
    (_n, c) => {
      expect(c.r.stats.brokenBorderCells).toBe(0)
      expect(c.r.stats.arrowheadsAdjacent).toBe(c.r.stats.arrowheads)
    },
  )
})

describe('ascii-layout: box proportions', () => {
  it.each(cases.map((c) => [c.name, c] as const))(
    '%s: box error under 15%',
    (_n, c) => expect(maxBoxError(c)).toBeLessThan(0.15),
  )
  it('gallery: at most 4 boxes beyond 15% (sample 24, label-driven growth)', () => {
    const over = galleryCases.filter((c) => maxBoxError(c) >= 0.15)
    expect(over.map((c) => c.name)).toEqual(['sample 24'])
    expect(over[0]!.r.stats.boxesOver15Pct).toBe(4)
  })
})

describe('ascii-layout: face policy (merge-then-grow)', () => {
  const find = (n: string) => cases.find((c) => c.name === n)!
  it('merges only identical parallel edges, and reports them', () => {
    for (const c of [...cases, ...galleryCases])
      for (const g of c.r.mergedGroups) {
        const es = g.map((id) => c.layout.edges.find((e) => e.id === id)!)
        expect(new Set(es.map((e) => `${e.from}>${e.to}`)).size).toBe(1)
        expect(
          new Set(es.map((e) => `${e.arrowStart}|${e.arrowEnd}`)).size,
        ).toBe(1)
      }
    expect(find('d3.mmd').r.stats).toMatchObject({
      edges: 10,
      lines: 4,
      merged: 6,
    })
    expect(find('d3.mmd').r.note).toContain('hide edge multiplicity')
    expect(find('gallery-simple-flow.mmd').r.note).toBe('')
  })
  it('never merges a reciprocal pair', async () => {
    const layout = await layoutFlowchart(
      'flowchart TD\n  A["A"]\n  B["B"]\n  A --> B\n  B --> A',
    )
    const r = rasterizeLayout(layout)
    expect(r.mergedGroups).toEqual([])
    expect(r.stats.lines).toBe(2)
    expect(r.text.match(/[▲▼]/g)).toHaveLength(2)
  })
  it('grows the box width for a crowded top face', () => {
    // Hand-built: B is 6x3 cells (capacity 4 per horizontal face), five distinct sources feed its top.
    const src = [0, 1, 2, 3, 4]
    const layout: FlowchartLayout = {
      dir: 'TD',
      nodes: [
        ...src.map((i) => ({
          id: `A${i}`,
          x: 40 + i * 60,
          y: 20,
          w: 40,
          h: 30,
          label: 'a',
        })),
        { id: 'B', x: 160, y: 200, w: 30, h: 30, label: 'B' },
      ],
      edges: src.map((i) => ({
        id: `e${i}`,
        from: `A${i}`,
        to: 'B',
        lw: 0,
        lh: 0,
        pts: [
          [40 + i * 60, 35],
          [155 + i * 2.5, 185],
        ] as [number, number][],
      })),
    }
    const r = rasterizeLayout(layout)
    expect(r.stats.lines).toBe(5)
    const b = r.boxes.find((q) => q.id === 'B')!
    expect(b.c1 - b.c0 - 1).toBeGreaterThanOrEqual(5)
    expect(r.stats.brokenBorderCells).toBe(0)
  })
  it('grows the box instead of dropping an edge when nothing can merge', async () => {
    const edges = 'ABCDEFGH'.split('').map((t) => `  S --> ${t}`)
    const layout = await layoutFlowchart(
      ['flowchart LR', '  S["S"]', ...edges].join('\n'),
    )
    const r = rasterizeLayout(layout)
    expect(r.stats.lines).toBe(8)
    const s = r.boxes.find((b) => b.id === 'S')!
    expect(s.r1 - s.r0 - 1).toBeGreaterThanOrEqual(8) // one interior cell per lane
  })
})

describe('ascii-layout: column cap (compress gaps, never boxes)', () => {
  const all = [...cases, ...galleryCases]
  const natural = new Map(
    all.map((c) => [c, rasterizeLayout(c.layout, { maxCols: Infinity })]),
  )
  const sizes = (r: RasterResult) =>
    r.boxes.map((b) => `${b.id}:${b.c1 - b.c0 + 1}x${b.r1 - b.r0 + 1}`)

  it('every case fits the default 120 columns, or reports capped:false at natural width', () => {
    for (const c of all) {
      const nat = natural.get(c)!
      if (c.r.capped) expect(c.r.stats.cols, c.name).toBeLessThanOrEqual(120)
      else {
        expect(nat.stats.cols, c.name).toBeGreaterThan(120)
        expect(c.r.text, c.name).toBe(nat.text)
      }
      expect(c.r.stats.naturalCols, c.name).toBe(nat.stats.cols)
    }
  })
  it('compresses only where needed, and some gallery cases really are compressed', () => {
    const compressed = all.filter((c) => c.r.stats.gapKept < 1)
    expect(compressed.length).toBeGreaterThanOrEqual(3)
    for (const c of compressed) {
      expect(c.r.capped, c.name).toBe(true)
      expect(natural.get(c)!.stats.cols, c.name).toBeGreaterThan(120)
    }
  })
  it('keeps box sizes, lines (no extra merges) and edge labels', () => {
    for (const c of all) {
      const nat = natural.get(c)!
      expect(sizes(c.r), c.name).toEqual(sizes(nat))
      expect(c.r.stats.lines, c.name).toBe(nat.stats.lines)
      expect(c.r.mergedGroups, c.name).toEqual(nat.mergedGroups)
      for (const e of c.layout.edges)
        if (e.label && nat.text.includes(e.label))
          expect(c.r.text, `${c.name} label ${e.label}`).toContain(e.label)
    }
  })
  it('is an option: a tighter cap squeezes more, Infinity disables it', async () => {
    const layout = await layoutFlowchart(
      'flowchart LR\n  A[One] --> B[Two] --> C[Three]',
    )
    const wide = rasterizeLayout(layout, { maxCols: Infinity })
    const tight = rasterizeLayout(layout, { maxCols: wide.stats.cols - 10 })
    expect(wide).toMatchObject({ capped: true })
    expect(wide.stats.gapKept).toBe(1)
    expect(tight.capped).toBe(true)
    expect(tight.stats.cols).toBeLessThanOrEqual(wide.stats.cols - 10)
    expect(tight.stats.gapKept).toBeLessThan(1)
    expect(tight.stats.brokenBorderCells).toBe(0)
  })
  it('cap unmet (boxes alone exceed it): natural render, capped:false, naturalCols reported', async () => {
    const layout = await layoutFlowchart(
      'graph LR\n  A[Step 1] --> B[Step 2] --> C[Step 3] --> D[Step 4] --> E[Step 5]',
    )
    const r = rasterizeLayout(layout)
    const nat = rasterizeLayout(layout, { maxCols: Infinity })
    expect(r.capped).toBe(false)
    expect(r.stats.naturalCols).toBe(r.stats.cols)
    expect(r.stats.cols).toBeGreaterThan(120)
    expect(r.text).toBe(nat.text)
  })
})
