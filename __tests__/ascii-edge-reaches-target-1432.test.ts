/**
 * Every edge's drawn path must reach its target (issue #1432).
 *
 * The goldens and visual baselines only self-diff, so a stem overwritten by a
 * label (B-->D left with no visible path out of B) passed unnoticed. This
 * traces the drawn glyphs of the rendered string: starting from the source
 * box, follow line glyphs (only where both neighbouring cells have an arm
 * toward each other, never through another box) and require an arrowhead
 * that points into the target box. Works on the rendered string, like
 * packages/ascii-renderer/src/__tests__/helpers/ascii-form.ts.
 *
 * Lives at the repo root because it imports samples-data.ts, which sits
 * outside tsconfig's `rootDir` for packages (see ascii-hyperlinks-samples).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { samples } from '../packages/site/samples-data.ts'

type Dir = 'U' | 'D' | 'L' | 'R'
const ARMS: Record<string, string> = {}
const def = (chars: string, arms: string) => {
  for (const c of chars) ARMS[c] = arms
}
def('│┆┊┃╎', 'UD')
def('─┄┈━╌', 'LR')
def('┌╭┏', 'RD')
def('┐╮┓', 'LD')
def('└╰┗', 'RU')
def('┘╯┛', 'LU')
def('├┣', 'UDR')
def('┤┫', 'UDL')
def('┬┳', 'LRD')
def('┴┻', 'LRU')
def('┼╋', 'UDLR')
// An arrowhead is a dead end whose single arm points back along the line.
def('▼', 'U')
def('▲', 'D')
def('►', 'L')
def('◄', 'R')
const HEADS: Record<string, Dir> = { '▼': 'D', '▲': 'U', '►': 'R', '◄': 'L' }
const OPPOSITE: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'R', R: 'L' }
const STEP: Record<Dir, [number, number]> = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0],
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
  text: string
}

function findBoxes(grid: string[][]): Box[] {
  const boxes: Box[] = []
  const at = (x: number, y: number) => grid[y]?.[x] ?? ' '
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y]!.length; x++) {
      if (!'┌╭┏'.includes(at(x, y))) continue
      let x1 = x + 1
      while (at(x1, y) !== ' ' && !'┐╮┓'.includes(at(x1, y))) x1++
      if (!'┐╮┓'.includes(at(x1, y))) continue
      let y1 = y + 1
      while (y1 < grid.length && !'└╰┗'.includes(at(x, y1))) y1++
      if (y1 >= grid.length || !'┘╯┛'.includes(at(x1, y1))) continue
      let text = ''
      for (let r = y + 1; r < y1; r++)
        text += ' ' + grid[r]!.slice(x + 1, x1).join('')
      boxes.push({
        x0: x,
        y0: y,
        x1,
        y1,
        text: text.replace(/\s+/g, ' ').trim(),
      })
    }
  }
  return boxes
}

/** Index of the box containing the cell, or -1. */
function boxIndexAt(boxes: Box[], x: number, y: number): number {
  return boxes.findIndex(
    (b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1,
  )
}

/** Is (x,y) a character of a run of text that is one of the edge labels? */
function isLabelCell(
  grid: string[][],
  boxes: Box[],
  labels: string[],
  x: number,
  y: number,
): boolean {
  const row = grid[y]
  const plain = (cx: number) => {
    const c = row?.[cx] ?? ' '
    return c !== ' ' && !ARMS[c] && boxIndexAt(boxes, cx, y) === -1
  }
  if (!row || !plain(x)) return false
  let a = x
  let b = x
  while (plain(a - 1)) a--
  while (plain(b + 1)) b++
  const run = row
    .slice(a, b + 1)
    .join('')
    .trim()
  return labels.some((l) => l.includes(run))
}

/**
 * True when a chain of connected line glyphs leads from a port of `src` to an
 * arrowhead that points into `dst`.
 */
function edgeReaches(
  grid: string[][],
  boxes: Box[],
  src: number,
  dst: number,
  labels: string[],
): boolean {
  const at = (x: number, y: number) => grid[y]?.[x] ?? ' '
  const seen = new Set<string>()
  const queue: [number, number][] = []
  const b = boxes[src]!
  // Seed: line cells touching the source's border with an arm into it.
  for (let y = b.y0 - 1; y <= b.y1 + 1; y++) {
    for (let x = b.x0 - 1; x <= b.x1 + 1; x++) {
      if (boxIndexAt(boxes, x, y) === src && HEADS[at(x, y)]) {
        queue.push([x, y]) // a head drawn on the source's own wall (`<-->`)
        continue
      }
      if (boxIndexAt(boxes, x, y) !== -1) continue
      const arms = ARMS[at(x, y)]
      if (!arms) continue
      // A source-end arrowhead (`<-->`) faces into the source box.
      const h = HEADS[at(x, y)]
      if (h && boxIndexAt(boxes, x + STEP[h][0], y + STEP[h][1]) === src)
        queue.push([x, y])
      for (const d of arms as unknown as Dir[]) {
        const [dx, dy] = STEP[d]
        if (boxIndexAt(boxes, x + dx, y + dy) === src) queue.push([x, y])
      }
    }
  }
  while (queue.length) {
    const [x, y] = queue.pop()!
    const key = `${x},${y}`
    if (seen.has(key)) continue
    seen.add(key)
    const ch = at(x, y)
    const head = HEADS[ch]
    if (head && boxIndexAt(boxes, x + STEP[head][0], y + STEP[head][1]) === dst)
      return true
    for (const d of ARMS[ch] as unknown as Dir[]) {
      const [dx, dy] = STEP[d]
      const nx = x + dx
      const ny = y + dy
      const nb = boxIndexAt(boxes, nx, ny)
      if (nb === dst && HEADS[at(nx, ny)] === d) return true // head on dst wall
      if (nb !== -1) continue
      let tx = nx
      let ty = ny
      // An edge label sits on the stroke: bridge it, but only straight
      // across and only when the stroke resumes on the far side.
      if (isLabelCell(grid, boxes, labels, tx, ty)) {
        do {
          tx += dx
          ty += dy
        } while (dx !== 0 && isLabelCell(grid, boxes, labels, tx, ty))
      }
      const back = ARMS[at(tx, ty)]
      if (back?.includes(OPPOSITE[d])) queue.push([tx, ty])
    }
  }
  return false
}

/** Edges whose path doesn't reach the target; null when not traceable here. */
function disconnectedEdges(source: string): string[] | null {
  const parsed = parseMermaid(source)
  if (parsed.subgraphs.length > 0) return null
  const grid = renderMermaidASCII(source, { colorMode: 'none' })
    .split('\n')
    .map((l) => [...l])
  const boxes = findBoxes(grid)
  const idx = new Map<string, number>()
  for (const n of parsed.nodes.values()) {
    const hits = boxes.flatMap((b, i) => (b.text === n.label ? [i] : []))
    if (hits.length !== 1) return null // shape/label not traceable here
    idx.set(n.id, hits[0]!)
  }
  const labels = parsed.edges.flatMap((e) => (e.label ? [e.label] : []))
  const bad: string[] = []
  for (const e of parsed.edges) {
    if (e.source === e.target || e.style === 'invisible') continue
    if (!e.hasArrowEnd || e.endMarker) continue
    if (
      !edgeReaches(grid, boxes, idx.get(e.source)!, idx.get(e.target)!, labels)
    )
      bad.push(`${e.source}-->${e.target}${e.label ? ` |${e.label}|` : ''}`)
  }
  return bad
}

const FAN_REPRO = `flowchart TD
  A --> B
  A --> |first| C
  B --> |second| C
  A --> |third| D
  C --> |fourth| D
  B --> |fifth| D`

describe('ASCII edges reach their target (#1432)', () => {
  it('traces a simple chain', () => {
    expect(disconnectedEdges('flowchart TD\n  A --> B --> C')).toEqual([])
  })

  it('detects a severed edge', () => {
    const grid = renderMermaidASCII('flowchart TD\n  A --> B', {
      colorMode: 'none',
    })
      .split('\n')
      .map((l) => [...l])
    const boxes = findBoxes(grid)
    expect(edgeReaches(grid, boxes, 0, 1, [])).toBe(true)
    for (const row of grid)
      for (let i = 0; i < row.length; i++) if (row[i] === '▼') row[i] = ' '
    expect(edgeReaches(grid, boxes, 0, 1, [])).toBe(false)
  })

  it('fan-in/fan-out repro: every edge reaches its target', () => {
    expect(disconnectedEdges(FAN_REPRO)).toEqual([])
  })

  it('every traceable gallery flowchart edge reaches its target', () => {
    const failures: string[] = []
    let traced = 0
    for (const s of samples) {
      if (s.category === 'Hero') continue
      let bad: string[] | null
      try {
        bad = disconnectedEdges(s.source)
      } catch {
        continue
      }
      if (bad === null) continue
      traced++
      if (bad.length) failures.push(`${s.title}: ${bad.join(', ')}`)
    }
    expect(traced).toBeGreaterThan(5)
    expect(failures).toEqual([])
  })
})
