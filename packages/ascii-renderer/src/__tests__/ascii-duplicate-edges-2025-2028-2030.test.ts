/**
 * #2025, #2028, #2030: duplicate and reciprocal edges, and duplicate
 * self-loops, left a stroke that connects to nothing (or, for #2025, a canvas
 * of unequal line widths). Causes, both in `rerouteAroundStyleConflicts`:
 *  - a self-loop's reroute was allowed to cut through its own node's block, so
 *    a second loop on the same node drew a stub off the node's corner;
 *  - a parallel-lane search that ran out of offsets returned a placeholder path
 *    hundreds of rows out, and the earlier half-blocked detours were spikes
 *    that draw a stem ending in blank space.
 * Also checked here (what a reader needs to trace each edge): no closed
 * rectangle of strokes outside the nodes, node borders intact, an arrowhead
 * never on the same stem as an opposite-direction exit, and a self-loop on
 * strokes of its own.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

// Arms each box-drawing glyph extends (U/D/L/R). Dotted and heavy variants are
// not drawn by these sources.
const ARMS: Record<string, string> = {
  '─': 'LR',
  '│': 'UD',
  '┌': 'RD',
  '┐': 'LD',
  '└': 'UR',
  '┘': 'UL',
  '├': 'UDR',
  '┤': 'UDL',
  '┬': 'LRD',
  '┴': 'LRU',
  '┼': 'UDLR',
}
const STEP: Record<string, [number, number]> = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0],
}

/** Glyph arms that lead into a blank cell or off the canvas. */
function orphanArms(out: string): string[] {
  const grid = out.split('\n').map((l) => [...l])
  const found: string[] = []
  grid.forEach((row, y) =>
    row.forEach((ch, x) => {
      for (const arm of ARMS[ch] ?? '') {
        const [dx, dy] = STEP[arm]!
        const next = grid[y + dy]?.[x + dx]
        if (next === undefined || next === ' ') {
          found.push(`${ch} at ${x},${y} arm ${arm}`)
        }
      }
    }),
  )
  return found
}

/** Glyph arms that lead into a line glyph (not a node border) with no arm back. */
function brokenJunctions(out: string): string[] {
  const grid = out.split('\n').map((l) => [...l])
  const border = new Set(nodeBoxes(out).flatMap((b) => [...b]))
  const found: string[] = []
  grid.forEach((row, y) =>
    row.forEach((ch, x) => {
      for (const arm of ARMS[ch] ?? '') {
        const [dx, dy] = STEP[arm]!
        const next = ARMS[grid[y + dy]?.[x + dx] ?? ' ']
        if (border.has(key(x + dx, y + dy))) continue
        if (next !== undefined && !next.includes(OPPOSITE[arm]!))
          found.push(`${ch} at ${x},${y} arm ${arm}`)
      }
    }),
  )
  return found
}

/**
 * A seeded random flowchart of 2-4 nodes with duplicate, reciprocal and
 * self-loop edges, in any direction (mulberry32).
 */
function randomFlowchart(seed: number): string {
  let t = seed >>> 0
  const rnd = () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  const pick = (n: number) => Math.floor(rnd() * n)
  const n = 2 + pick(3)
  const lines = [`flowchart ${['TD', 'LR', 'BT', 'RL'][pick(4)]}`]
  for (let i = 0; i < n; i++) lines.push(`  n${i}["n${i}"]`)
  const m = 3 + pick(7)
  for (let i = 0; i < m; i++) {
    const a = pick(n)
    const b = rnd() < 0.2 ? a : pick(n)
    lines.push(`  n${a} --> n${b}`)
    if (rnd() < 0.3) lines.push(`  n${a} --> n${b}`)
    if (rnd() < 0.2) lines.push(`  n${b} --> n${a}`)
  }
  return lines.join('\n')
}

const CORNER_TL = '┌╭◇('
const CORNER_TR = '┐╮◇)'
const CORNER_BL = '└╰◇('
const CORNER_BR = '┘╯◇)'
const HEADS: Record<string, string> = { '▲': 'D', '▼': 'U', '►': 'L', '◄': 'R' }
const OPPOSITE: Record<string, string> = { U: 'D', D: 'U', L: 'R', R: 'L' }

type Cell = [number, number]
const key = (x: number, y: number) => `${x},${y}`

/** Border cells of every node box (rectangle, rounded, diamond, stadium with `(` `)` sides). */
function nodeBoxes(out: string): Set<string>[] {
  const g = out.split('\n').map((l) => [...l])
  const at = (x: number, y: number) => g[y]?.[x] ?? ' '
  const boxes: Set<string>[] = []
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (!CORNER_TL.includes(ch) || !'─┬┴'.includes(at(x + 1, y))) return
      let x2 = x + 1
      while ('─┬┴'.includes(at(x2, y))) x2++
      if (!CORNER_TR.includes(at(x2, y))) return
      let y2 = y + 1
      while ('│├┤('.includes(at(x, y2)) && '│├┤)'.includes(at(x2, y2))) y2++
      if (y2 === y + 1) return
      if (!CORNER_BL.includes(at(x, y2)) || !CORNER_BR.includes(at(x2, y2)))
        return
      if (
        ![...Array(x2 - x - 1).keys()].every((i) =>
          '─┬┴'.includes(at(x + 1 + i, y2)),
        )
      )
        return
      const cells = new Set<string>()
      for (let i = x; i <= x2; i++)
        [key(i, y), key(i, y2)].forEach((k) => cells.add(k))
      for (let j = y; j <= y2; j++)
        [key(x, j), key(x2, j)].forEach((k) => cells.add(k))
      boxes.push(cells)
    }),
  )
  return boxes
}

/**
 * Connected strokes outside the node borders: cells joined where both glyphs
 * have an arm toward each other; an arrowhead joins the stem behind it.
 */
function strokeComponents(out: string, boxes: Set<string>[]) {
  const g = out.split('\n').map((l) => [...l])
  const inBox = new Set(boxes.flatMap((b) => [...b]))
  const armsOf = (ch: string) => ARMS[ch] ?? HEADS[ch] ?? ''
  const parent = new Map<string, string>()
  const find = (k: string): string =>
    parent.get(k) === k
      ? k
      : (parent.set(k, find(parent.get(k)!)), parent.get(k)!)
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (armsOf(ch) && !inBox.has(key(x, y))) parent.set(key(x, y), key(x, y))
    }),
  )
  let edges = 0
  for (const k of parent.keys()) {
    const [x, y] = k.split(',').map(Number) as Cell
    for (const arm of armsOf(g[y]![x]!)) {
      const [dx, dy] = STEP[arm]!
      const n = key(x + dx, y + dy)
      if (!parent.has(n)) continue
      if (!armsOf(g[y + dy]![x + dx]!).includes(OPPOSITE[arm]!)) continue
      if (k < n) {
        edges++
        parent.set(find(k), find(n))
      }
    }
  }
  const comps = new Map<string, string[]>()
  for (const k of parent.keys())
    comps.set(find(k), [...(comps.get(find(k)) ?? []), k])
  return {
    comps: [...comps.values()],
    cycles: edges - parent.size + comps.size,
    g,
    inBox,
  }
}

/** Arrowheads sitting on the same stem as an exit running the other way. */
function headsOnExitStems(out: string): string[] {
  const g = out.split('\n').map((l) => [...l])
  const found: string[] = []
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      const toward = HEADS[ch]
      if (!toward) return
      // The cell the head points into must not carry an arm back out of it.
      const [dx, dy] = STEP[OPPOSITE[toward]!]!
      const into = g[y + dy]?.[x + dx] ?? ' '
      if ((ARMS[into] ?? '').includes(toward))
        found.push(`${ch} at ${x},${y} into ${into}`)
    }),
  )
  return found
}

/** Stroke components that meet exactly one node box, at two cells or more. */
function selfLoops(out: string): number {
  const boxes = nodeBoxes(out)
  const { comps } = strokeComponents(out, boxes)
  const near = (k: string) => {
    const [x, y] = k.split(',').map(Number) as Cell
    return Object.values(STEP).map(([dx, dy]) => key(x + dx, y + dy))
  }
  return comps.filter((c) => {
    const hit = boxes.filter((b) =>
      c.some((k) => near(k).some((n) => b.has(n))),
    )
    if (hit.length !== 1) return false
    return new Set(c.flatMap(near).filter((n) => hit[0]!.has(n))).size >= 2
  }).length
}

const widths = (out: string) =>
  new Set(out.split('\n').map((l) => [...l].length))

const CASES: Record<string, string> = {
  '#2025 decision self-loop + duplicates + labeled back edge': `flowchart LR
  n0{"gSQ21Q"}
  n1["C"]
  n2(["OkfK"])
  n3("Q552S")
  n0 --> n0
  n0 --> n2
  n0 --> n2
  n0 --> n1
  n1 -->|000A| n0
  n0 --> n1`,
  '#2028 duplicate self-loops': `flowchart TD
  n0["a"]
  n0 --> n0
  n0 --> n0`,
  '#2030 RL reciprocal + duplicate edges': `flowchart RL
  n0["L6rc9iw"]
  n1(["9B531Zk"])
  n1 --> n0
  n0 --> n1
  n1 --> n0`,
}

const NODES: Record<string, number> = {
  '#2025 decision self-loop + duplicates + labeled back edge': 4,
  '#2028 duplicate self-loops': 1,
  '#2030 RL reciprocal + duplicate edges': 2,
}

/**
 * Self-loops and lanes sharing a face with in/out/duplicate edges, in every
 * direction (exercises `allocateFaces` in port-offsets.ts and `runTaken` in
 * edge-routing.ts).
 */
const FACE_CASES: [string, string, number][] = [
  [
    'LR loop on a lower node beside an unrelated edge',
    `flowchart LR
  a["a"]
  b["b"]
  c["c"]
  d["d"]
  a --> b
  c --> d
  b --> b
  d --> d`,
    4,
  ],
  [
    'LR many duplicates around a middle node',
    `flowchart LR
  a["a"]
  b["b"]
  c["c"]
  a --> b
  a --> b
  a --> b
  a --> b
  b --> c
  b --> c
  a --> c
  a --> c
  c --> a
  c --> a`,
    3,
  ],
  [
    'TD many duplicates around a middle node',
    `flowchart TD
  a["a"]
  b["b"]
  c["c"]
  a --> b
  a --> b
  a --> b
  a --> b
  b --> c
  b --> c
  a --> c
  a --> c
  c --> a
  c --> a`,
    3,
  ],
  [
    'self-loop with in and out neighbours (TD)',
    `flowchart TD
  a["a"]
  b["b"]
  c["c"]
  a --> a
  b --> a
  a --> c
  b --> c
  c --> a`,
    3,
  ],
  [
    'self-loop with duplicate neighbours (TD)',
    `flowchart TD
  a["a"]
  b["b"]
  a --> a
  a --> b
  a --> b
  b --> a
  b --> a
  a --> a`,
    2,
  ],
  [
    'two self-loops and a fan (TD)',
    `flowchart TD
  a["a"]
  b["b"]
  c["c"]
  d["d"]
  a --> a
  b --> b
  a --> b
  c --> a
  d --> a
  a --> c
  a --> d
  d --> b
  c --> b`,
    4,
  ],
  [
    'self-loop with in and out neighbours (LR)',
    `flowchart LR
  a["a"]
  b["b"]
  c["c"]
  a --> a
  b --> a
  a --> c
  b --> c
  c --> a`,
    3,
  ],
  [
    'self-loop with duplicate neighbours (LR)',
    `flowchart LR
  a["a"]
  b["b"]
  a --> a
  a --> b
  a --> b
  b --> a
  b --> a
  a --> a`,
    2,
  ],
  [
    'two self-loops and a fan (LR)',
    `flowchart LR
  a["a"]
  b["b"]
  c["c"]
  d["d"]
  a --> a
  b --> b
  a --> b
  c --> a
  d --> a
  a --> c
  a --> d
  d --> b
  c --> b`,
    4,
  ],
  [
    'self-loop with in and out neighbours (BT)',
    `flowchart BT
  a["a"]
  b["b"]
  c["c"]
  a --> a
  b --> a
  a --> c
  b --> c
  c --> a`,
    3,
  ],
  [
    'self-loop with duplicate neighbours (BT)',
    `flowchart BT
  a["a"]
  b["b"]
  a --> a
  a --> b
  a --> b
  b --> a
  b --> a
  a --> a`,
    2,
  ],
  [
    'two self-loops and a fan (BT)',
    `flowchart BT
  a["a"]
  b["b"]
  c["c"]
  d["d"]
  a --> a
  b --> b
  a --> b
  c --> a
  d --> a
  a --> c
  a --> d
  d --> b
  c --> b`,
    4,
  ],
  [
    'self-loop with in and out neighbours (RL)',
    `flowchart RL
  a["a"]
  b["b"]
  c["c"]
  a --> a
  b --> a
  a --> c
  b --> c
  c --> a`,
    3,
  ],
  [
    'self-loop with duplicate neighbours (RL)',
    `flowchart RL
  a["a"]
  b["b"]
  a --> a
  a --> b
  a --> b
  b --> a
  b --> a
  a --> a`,
    2,
  ],
  [
    'two self-loops and a fan (RL)',
    `flowchart RL
  a["a"]
  b["b"]
  c["c"]
  d["d"]
  a --> a
  b --> b
  a --> b
  c --> a
  d --> a
  a --> c
  a --> d
  d --> b
  c --> b`,
    4,
  ],
]

/**
 * Closed stroke rectangles a case cannot avoid. None now: the short `a --> b`
 * and `b --> c` duplicates are strokes on the facing faces and the skip and
 * back lanes of `a --> c` / `c --> a` nest in the gutter beside the column
 * (#2121), so nothing crosses. It was three (#2071, #2072) while the
 * duplicates took side lanes round the column.
 */
const CROSSINGS: Record<string, number> = {}

describe('ASCII duplicate edges and self-loops (#2025, #2028, #2030)', () => {
  for (const [name, source] of Object.entries(CASES)) {
    for (const useAscii of [false, true]) {
      it(`${name} (${useAscii ? 'ascii' : 'unicode'}): equal-width rows`, () => {
        const out = renderMermaidASCII(source, { colorMode: 'none', useAscii })
        expect(widths(out).size).toBe(1)
      })
    }
    it(`${name}: no glyph arm leads into blank`, () => {
      const out = renderMermaidASCII(source, { colorMode: 'none' })
      expect(orphanArms(out)).toEqual([])
    })
    it(`${name}: node borders intact, no closed stroke rectangle, heads not on exit stems`, () => {
      const out = renderMermaidASCII(source, { colorMode: 'none' })
      const boxes = nodeBoxes(out)
      expect(boxes).toHaveLength(NODES[name]!)
      expect(strokeComponents(out, boxes).cycles).toBe(0)
      expect(headsOnExitStems(out)).toEqual([])
    })
    it(`${name}: stays compact (no placeholder lane hundreds of rows out)`, () => {
      const out = renderMermaidASCII(source, { colorMode: 'none' })
      expect(out.split('\n').length).toBeLessThan(40)
    })
  }

  // #2072: Mermaid draws one path per edge. A too-short face used to draw the
  // later of two same-direction duplicates on its twin's route (one arrowhead
  // for two edges); each edge now keeps its own lane and arrowhead.
  it.each([
    ['LR many duplicates around a middle node', 10],
    ['TD many duplicates around a middle node', 10],
  ])('%s: one arrowhead per edge', (name, edges) => {
    const src = Object.fromEntries(FACE_CASES.map(([n, s]) => [n, s]))[name]!
    const out = renderMermaidASCII(src, { colorMode: 'none' })
    expect(out.match(/[▲▼◄►]/g)).toHaveLength(edges)
  })

  it('two self-loops on one node draw the one clean loop', () => {
    const one = renderMermaidASCII('flowchart TD\n  n0["a"]\n  n0 --> n0', {
      colorMode: 'none',
    })
    const two = renderMermaidASCII(CASES['#2028 duplicate self-loops']!, {
      colorMode: 'none',
    })
    expect(two).toBe(one)
  })

  it('#2025: the self-loop leaves and re-enters its node on strokes of its own', () => {
    const out = renderMermaidASCII(
      CASES['#2025 decision self-loop + duplicates + labeled back edge']!,
      {
        colorMode: 'none',
      },
    )
    const boxes = nodeBoxes(out)
    const { comps, g } = strokeComponents(out, boxes)
    const touching = (comp: string[]) =>
      new Set(
        boxes.flatMap((b, i) =>
          comp.some((k) => {
            const [x, y] = k.split(',').map(Number) as Cell
            return Object.values(STEP).some(([dx, dy]) =>
              b.has(key(x + dx, y + dy)),
            )
          })
            ? [i]
            : [],
        ),
      )
    const heads = (comp: string[]) =>
      comp.filter((k) => {
        const [x, y] = k.split(',').map(Number) as Cell
        return HEADS[g[y]![x]!]
      })
    // A loop is a stroke component that touches exactly one node and ends in one head.
    const lines = out.split('\n')
    const row = lines.findIndex((l) => l.includes('gSQ21Q'))
    const col = lines[row]!.indexOf('gSQ21Q')
    const own = boxes.findIndex((b) => {
      const xs = [...b].map((k) => Number(k.split(',')[0]))
      const ys = [...b].map((k) => Number(k.split(',')[1]))
      return (
        Math.min(...xs) < col &&
        col < Math.max(...xs) &&
        Math.min(...ys) < row &&
        row < Math.max(...ys)
      )
    })
    // Border cells of its own node a component meets (a loop meets two: where
    // it leaves and where it re-enters).
    const contacts = (comp: string[]) =>
      new Set(
        comp.flatMap((k) => {
          const [x, y] = k.split(',').map(Number) as Cell
          return Object.values(STEP)
            .map(([dx, dy]) => key(x + dx, y + dy))
            .filter((n) => boxes[own]!.has(n))
        }),
      )
    const loops = comps.filter(
      (c) =>
        touching(c).size === 1 &&
        touching(c).has(own) &&
        contacts(c).size >= 2 &&
        heads(c).length === 1,
    )
    expect(loops).toHaveLength(1)
  })

  describe('self-loops sharing a face with other edges', () => {
    for (const [name, source, nodes] of FACE_CASES) {
      for (const useAscii of [false, true]) {
        it(`${name} (${useAscii ? 'ascii' : 'unicode'}): equal-width rows`, () => {
          const out = renderMermaidASCII(source, {
            colorMode: 'none',
            useAscii,
          })
          expect(widths(out).size).toBe(1)
        })
      }
      it(`${name}: no orphan arms, intact boxes, no closed rectangle, heads not on exit stems`, () => {
        const out = renderMermaidASCII(source, { colorMode: 'none' })
        expect(orphanArms(out)).toEqual([])
        const boxes = nodeBoxes(out)
        expect(boxes).toHaveLength(nodes)
        expect(strokeComponents(out, boxes).cycles).toBe(CROSSINGS[name] ?? 0)
        expect(headsOnExitStems(out)).toEqual([])
      })
      it(`${name}: every self-loop is a stroke of its own`, () => {
        const out = renderMermaidASCII(source, { colorMode: 'none' })
        const looped = new Set(
          [...source.matchAll(/^\s*(\w+) --> (\w+)$/gm)]
            .filter((m) => m[1] === m[2])
            .map((m) => m[1]),
        )
        expect(selfLoops(out)).toBe(looped.size)
      })
    }
  })

  // 48 seeded graphs. Before the face allocator (#2025) the same seeds drew
  // 555 broken or dangling arms over 200 seeds on main and, on this PR's
  // parent, 50 closed rectangles and 10 heads on exit stems over these 48;
  // now none of the former, and the totals below (crossings the grid
  // cannot route round) are a ratchet. #2072: each edge keeps a lane of its
  // own, as in Mermaid, so lanes that used to merge now cross (9 -> 15).
  it('random duplicate/reciprocal/self-loop graphs: no broken arms, few boxes', () => {
    let cycles = 0
    let heads = 0
    for (let seed = 1; seed <= 48; seed++) {
      const out = renderMermaidASCII(randomFlowchart(seed), {
        colorMode: 'none',
      })
      expect(
        [...orphanArms(out), ...brokenJunctions(out)],
        `seed ${seed}`,
      ).toEqual([])
      expect(widths(out).size, `seed ${seed}`).toBe(1)
      cycles += strokeComponents(out, nodeBoxes(out)).cycles
      heads += headsOnExitStems(out).length
    }
    expect(cycles).toBeLessThanOrEqual(15)
    expect(heads).toBeLessThanOrEqual(3)
  })
})
