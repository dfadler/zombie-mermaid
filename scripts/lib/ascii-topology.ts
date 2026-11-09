/**
 * Topology agreement between the ASCII grid and the ELK layout (#2645, PR 1).
 *
 * Per node pair: the flow-axis layer relation (same layer / before / after;
 * ELK tolerance 20 px, grid tolerance 1 cell, RL and BT mirrored on the ASCII
 * side only), the in-layer order for pairs ELK puts in one layer, and a
 * normalised cross-axis alignment (centre offset in node widths, so pixels and
 * cells compare). Per edge end: the face against the ELK hints. Measured from
 * the grid's own coordinates through `renderGraphAscii`'s `afterDraw` hook.
 * `scripts/ascii-topology.ts` runs it over the gallery; Q3 of #2645 gates each
 * ASCII placement PR on these numbers not dropping.
 */
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import {
  DEFAULT_ASCII_THEME,
  type AsciiFace,
  type AsciiLayoutHints,
  registerAsciiLayout,
} from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../../src/index.ts'
import { renderGraphAscii } from '../../packages/ascii-renderer/src/flowchart.ts'
import type { AsciiGraph } from '../../packages/ascii-renderer/src/types.ts'
import {
  asciiLayoutProvider,
  LAYER_TOLERANCE,
} from '../../src/ascii-layout-provider.ts'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'

export const GRID_TOLERANCE = 1
/** Two nodes agree on alignment when their normalised offsets differ by at most this many node widths. */
export const ALIGN_TOLERANCE = 0.5

/** A node centre and its cross-axis size. `main`/`cross` are along/across the flow in SVG orientation. */
export interface Spot {
  main: number
  cross: number
  size: number
}

export interface Counts {
  layerPairs: number
  layerOk: number
  orderPairs: number
  orderOk: number
  alignOk: number
  /** Sum of |normalised offset difference| over all pairs, for the mean. */
  alignDev: number
  faceEnds: number
  faceOk: number
}

export const emptyCounts = (): Counts => ({
  layerPairs: 0,
  layerOk: 0,
  orderPairs: 0,
  orderOk: 0,
  alignOk: 0,
  alignDev: 0,
  faceEnds: 0,
  faceOk: 0,
})

export const addCounts = (a: Counts, b: Counts): Counts => {
  const out = emptyCounts()
  for (const k of Object.keys(out) as (keyof Counts)[]) out[k] = a[k] + b[k]
  return out
}

const rel = (d: number, tol: number): number =>
  Math.abs(d) <= tol ? 0 : Math.sign(d)

/**
 * Pairwise comparison of node spots, both in SVG orientation (the grid's main
 * axis already mirrored for RL/BT).
 */
export function compareSpots(
  elk: Record<string, Spot>,
  grid: Record<string, Spot>,
): Counts {
  const c = emptyCounts()
  const ids = Object.keys(elk).filter((i) => grid[i])
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [ea, eb] = [elk[ids[i]!]!, elk[ids[j]!]!]
      const [ga, gb] = [grid[ids[i]!]!, grid[ids[j]!]!]
      const er = rel(ea.main - eb.main, LAYER_TOLERANCE)
      c.layerPairs++
      if (er === rel(ga.main - gb.main, GRID_TOLERANCE)) c.layerOk++
      if (er === 0) {
        c.orderPairs++
        if (Math.sign(ea.cross - eb.cross) === Math.sign(ga.cross - gb.cross))
          c.orderOk++
      }
      const dev = Math.abs(
        (ea.cross - eb.cross) / ((ea.size + eb.size) / 2) -
          (ga.cross - gb.cross) / ((ga.size + gb.size) / 2),
      )
      c.alignDev += dev
      if (dev <= ALIGN_TOLERANCE) c.alignOk++
    }
  }
  return c
}

/** The faces a grid end direction can stand for; a slant counts as either neighbour. */
const ADJ: Record<string, AsciiFace[]> = {
  '1,0': ['T'],
  '1,2': ['B'],
  '0,1': ['L'],
  '2,1': ['R'],
  '2,0': ['T', 'R'],
  '0,0': ['T', 'L'],
  '2,2': ['B', 'R'],
  '0,2': ['B', 'L'],
  '1,1': [],
}
const MIRROR_H: Record<AsciiFace, AsciiFace> = {
  T: 'T',
  B: 'B',
  L: 'R',
  R: 'L',
}
const MIRROR_V: Record<AsciiFace, AsciiFace> = {
  T: 'B',
  B: 'T',
  L: 'L',
  R: 'R',
}

const facesOf = (d: { x: number; y: number }, dir: string): AsciiFace[] =>
  (ADJ[`${d.x},${d.y}`] ?? []).map((f) =>
    dir === 'RL' ? MIRROR_H[f] : dir === 'BT' ? MIRROR_V[f] : f,
  )

export interface GridRender {
  spots: Record<string, Spot>
  /** Grid edge ends as faces (already un-mirrored to the SVG side), in graph edge order. */
  edges: { from: string; to: string; start: AsciiFace[]; end: AsciiFace[] }[]
}

/** Draws the sample and reads node spots and edge-end faces off the grid. */
export function readGrid(source: string): GridRender & { direction: string } {
  const parsed = parseMermaid(source)
  const dir = parsed.direction
  const horiz = dir === 'LR' || dir === 'RL'
  const flip = dir === 'RL' || dir === 'BT' ? -1 : 1
  const out: GridRender = { spots: {}, edges: [] }
  const afterDraw = (g: AsciiGraph): void => {
    for (const n of g.nodes) {
      if (!n.gridCoord || !n.drawingCoord || !n.drawing) continue
      const w = n.drawing.length
      const h = n.drawing[0]?.length ?? 1
      // Order/layer use grid cells (the unit the layout works in); size uses
      // drawn characters, so a wide box reads as wide.
      const gx = n.gridCoord.x + 1
      const gy = n.gridCoord.y + 1
      // `main` is the flow-leading edge (ELK aligns a layer on it; centres
      // drift by half the width difference), `cross` the centre.
      out.spots[n.name] = {
        main: flip * (horiz ? n.gridCoord.x : n.gridCoord.y),
        cross: horiz ? gy : gx,
        size: horiz ? h : w,
      }
    }
    for (const e of g.edges) {
      out.edges.push({
        from: e.from.name,
        to: e.to.name,
        start: facesOf(e.startDir, dir),
        end: facesOf(e.endDir, dir),
      })
    }
  }
  registerAsciiLayout(
    process.argv.includes('--no-hints') ? undefined : asciiLayoutProvider,
  )
  renderGraphAscii(
    parsed,
    {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    },
    'none',
    DEFAULT_ASCII_THEME,
    { layoutHints: true },
    { afterDraw },
  )
  return { ...out, direction: dir }
}

/** Counts the grid's edge ends whose face is the hints' face (matched by from/to, in order). */
export function compareFaces(
  grid: GridRender['edges'],
  hints: AsciiLayoutHints,
): Counts {
  const c = emptyCounts()
  const used = new Set<number>()
  for (const h of hints.edges) {
    const i = grid.findIndex(
      (g, k) => !used.has(k) && g.from === h.from && g.to === h.to,
    )
    if (i < 0) continue
    used.add(i)
    c.faceEnds += 2
    if (grid[i]!.start.includes(h.start.face)) c.faceOk++
    if (grid[i]!.end.includes(h.end.face)) c.faceOk++
  }
  return c
}

const ER_RE = /^\s*erDiagram/m
export const isEr = (src: string): boolean =>
  ER_RE.test(src.replace(/^---[\s\S]*?---/, '').trim())

/** Every ASCII fork-fix entry plus the subgraph frame merge, flowchart/state/ER. */
export const inScope = (id: string): boolean =>
  id.startsWith('ascii-') ||
  id.startsWith('er-ascii-') ||
  id === 'subgraph-frame-merge'
export const isGraph = (src: string): boolean =>
  isEr(src) ||
  /^\s*(flowchart|graph|stateDiagram)/m.test(
    src.replace(/^---[\s\S]*?---/, '').trim(),
  )

/** Entity boxes read off drawn ER text: a `┌──┐` top border over a row holding the entity's label. */
export function readErText(
  text: string,
  labels: Record<string, string>,
): Record<string, Spot> {
  const rows = text.split('\n').map((l) => Array.from(l))
  const out: Record<string, Spot> = {}
  rows.forEach((row, y) => {
    for (const m of row.join('').matchAll(/┌─+┐/g)) {
      const a = Array.from(row.join('').slice(0, m.index)).length
      const w = Array.from(m[0]).length
      const name = (rows[y + 1] ?? [])
        .slice(a + 1, a + w - 1)
        .join('')
        .trim()
      const id = Object.keys(labels).find((k) => labels[k] === name)
      if (id && !out[id]) out[id] = { main: y, cross: a + w / 2, size: w }
    }
  })
  return out
}

/**
 * ER measure: entities as nodes, the provider's ER hints (ELK layer, order,
 * centre) as the reference, the drawn box rows and centres as the grid. Only
 * the top-down stacking has layers: `direction LR/RL` packs one row, no hints.
 */
export function measureEr(
  source: string,
  /** Test seam: what the grid is fed instead of the true hints (the reference stays true). */
  feed: (h: AsciiLayoutHints) => AsciiLayoutHints = (h) => h,
): Counts {
  let seen:
    | { labels: Record<string, string>; hints?: AsciiLayoutHints }
    | undefined
  registerAsciiLayout({
    er: (d) => {
      const hints = asciiLayoutProvider.er!(d)
      seen = {
        labels: Object.fromEntries(d.entities.map((e) => [e.id, e.label])),
        hints,
      }
      return hints && feed(hints)
    },
  })
  const text = renderMermaidASCII(source)
  if (!seen?.hints) return emptyCounts()
  const grid = readErText(text, seen.labels)
  const elk: Record<string, Spot> = {}
  for (const [id, h] of seen.hints.nodes)
    elk[id] = { main: h.layer * 1000, cross: h.cross, size: h.size }
  return compareSpots(elk, grid)
}

/** Full measure for one flowchart/state/ER source: grid versus ELK. */
export function measureSample(source: string): Counts {
  if (isEr(source)) return measureEr(source)
  const parsed = parseMermaid(source)
  const { spots, edges, direction } = readGrid(source)
  const pos = layoutFlowchartSync(parsed)
  const horiz = direction === 'LR' || direction === 'RL'
  // ELK stays in SVG orientation; the grid side was mirrored to match it.
  // Layers are the provider's hint layers (the grouping `buildHints` uses, which
  // handles a diamond beside shorter boxes); `main` is spaced so they never fall
  // within the layer tolerance. The provider failing is a hard error here.
  const hints = asciiLayoutProvider.graph!(parsed)!
  const rev = direction === 'RL' || direction === 'BT'
  const elk: Record<string, Spot> = {}
  for (const n of pos.nodes) {
    const layer = hints.nodes.get(n.id)!.layer
    elk[n.id] = {
      main: (rev ? -layer : layer) * 1000,
      cross: horiz ? n.y + n.height / 2 : n.x + n.width / 2,
      size: horiz ? n.height : n.width,
    }
  }
  const c = compareSpots(elk, spots)
  return addCounts(c, compareFaces(edges, hints))
}

/** A sample is exact when every layer and in-layer-order pair agrees. */
export const isExact = (c: Counts): boolean =>
  c.layerOk === c.layerPairs && c.orderOk === c.orderPairs

/** One report line: layers and order, plus alignment and faces when `all`. */
export const describeSample = (
  title: string,
  c: Counts,
  all: boolean,
): string =>
  `layer ${c.layerOk}/${c.layerPairs} order ${c.orderOk}/${c.orderPairs}` +
  (all
    ? ` align ${c.alignOk}/${c.layerPairs} faces ${c.faceOk}/${c.faceEnds}`
    : '') +
  `  ${title}`

/** `source` redrawn in the flow direction after `--dir` (none: unchanged); a state diagram gets a `direction` line. */
export function redirectDirection(source: string): string {
  const at = process.argv.indexOf('--dir')
  const dir = at < 0 ? undefined : process.argv[at + 1]
  if (!dir) return source
  if (/^\s*stateDiagram/m.test(source)) {
    return source.replace(
      /^(\s*stateDiagram[^\n]*\n)(\s*direction \w+\n)?/m,
      `$1direction ${dir}\n`,
    )
  }
  return source.replace(/^(\s*(?:graph|flowchart))\s+\w+/m, `$1 ${dir}`)
}
