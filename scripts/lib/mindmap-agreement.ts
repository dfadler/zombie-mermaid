/**
 * Mindmap agreement against official mermaid.js (#2840), for
 * scripts/mindmap-oracle.ts. The browser-free half, so it can be unit-tested.
 *
 * Mermaid lays a mindmap out with a force simulation over node sizes it reads
 * from the browser's text measurement. Comparing our figure to its would mix
 * three things, so each is checked on its own, from the official render:
 *
 *   structure  node text, shape, colour section, classes, parent of each node
 *              and the edge classes: exact
 *   shapes     our shape sizes, given the official label box: within SIZE_TOL
 *   layout     our CoSE-Bilkent port, given the official node sizes: positions
 *              relative to the root within POSITION_TOL; the edge path through
 *              the official centres within PATH_TOL
 *
 * Label widths (font metrics) are reported by the caller, not gated: ours is
 * Inter, Mermaid's is "trebuchet ms", and that difference is documented.
 */
import { parseMindmap, mindmapPlainLines } from '@zombie-mermaid/mermaid-parser'
import type { MindmapNode } from '@zombie-mermaid/mermaid-parser'
import {
  MINDMAP,
  basisPath,
  layoutMindmap,
  shapeFor as mindmapShape,
} from '../../packages/svg-renderer/src/mindmap/layout.ts'
import { coseBilkentLayout } from '../../packages/svg-renderer/src/mindmap/cose-bilkent.ts'

/** One node of the official render. */
export interface OfficialMindmapNode {
  /** `node_<n>`'s n. */
  id: number
  /** Classes after `node mindmap-node`: `section-root section--1`, `section-0 urgent`. */
  classes: string
  /** Circle | rect | rect-rounded | polygon | path-default | path-other */
  shape: string
  /** Label lines, trimmed. */
  lines: string[]
  /** Label box (the foreignObject). */
  labelWidth: number
  labelHeight: number
  /** `getBBox()` of the node group. */
  width: number
  height: number
  x: number
  y: number
}

export interface OfficialMindmapEdge {
  from: number
  to: number
  classes: string
  /** The `d` attribute. */
  d: string
}

export interface OfficialMindmap {
  nodes: OfficialMindmapNode[]
  edges: OfficialMindmapEdge[]
}

/** Rendered size tolerance (px) for shapes built from the official label box. */
export const SIZE_TOL = 0.01
/** Position tolerance (px), relative to the root. */
export const POSITION_TOL = 0.01
/** Edge path tolerance (px). */
export const PATH_TOL = 0.01

const SHAPE_NAME: Record<string, string> = {
  default: 'path-default',
  rect: 'rect',
  rounded: 'rect-rounded',
  circle: 'circle',
  cloud: 'path-other',
  bang: 'path-other',
  hexagon: 'polygon',
}

const numbers = (d: string): number[] =>
  [...d.matchAll(/-?\d*\.?\d+(?:e-?\d+)?/gi)].map((m) => Number(m[0]))

/** Colour section from mermaid's classes: root is -1 (no section here). */
function sectionOf(classes: string): number | undefined {
  const m = /\bsection-(\d+)\b/.exec(classes)
  return m === null ? undefined : Number(m[1])
}

/** Our tree flattened in Mermaid's node order, with the layout's sections and parents. */
function ourNodes(source: string) {
  const mindmap = parseMindmap(source)
  const placed = layoutMindmap(mindmap).nodes
  const parent = new Map<number, number>()
  const walk = (node: MindmapNode) => {
    for (const child of node.children) {
      parent.set(child.id, node.id)
      walk(child)
    }
  }
  walk(mindmap.root)
  return placed.map((p) => ({
    node: p.node,
    section: p.section,
    parent: parent.get(p.node.id),
  }))
}

/** Every mismatch between the official render of `source` and ours, empty when they agree. */
export function mindmapMismatches(
  source: string,
  official: OfficialMindmap,
): string[] {
  const out: string[] = []
  const ours = ourNodes(source)
  if (ours.length !== official.nodes.length) {
    return [`nodes: ${official.nodes.length} official, ${ours.length} ours`]
  }

  // Structure
  const edgeKey = new Set(official.edges.map((e) => `${e.from}_${e.to}`))
  for (const [i, o] of official.nodes.entries()) {
    const u = ours[i]!
    if (o.id !== i) out.push(`node ${i}: official id ${o.id}`)
    if (sectionOf(o.classes) !== u.section) {
      out.push(
        `node ${i}: section ${sectionOf(o.classes)} official, ${u.section} ours`,
      )
    }
    const extra = o.classes
      .split(/\s+/)
      .filter((c) => c !== '' && !/^section-/.test(c))
    const wanted = (u.node.className ?? '').split(/\s+/).filter(Boolean)
    if (extra.join(' ') !== wanted.join(' ')) {
      out.push(
        `node ${i}: classes "${extra.join(' ')}" official, "${wanted.join(' ')}" ours`,
      )
    }
    if (o.shape !== SHAPE_NAME[u.node.shape]) {
      out.push(`node ${i}: shape ${o.shape} official, ${u.node.shape} ours`)
    }
    const text = mindmapPlainLines(u.node.text)
    if (o.lines.join('\n') !== text.join('\n')) {
      out.push(
        `node ${i}: text ${JSON.stringify(o.lines)} official, ${JSON.stringify(text)} ours`,
      )
    }
    if (u.parent !== undefined && !edgeKey.has(`${u.parent}_${i}`)) {
      out.push(`node ${i}: no official edge from ${u.parent}`)
    }
  }
  if (official.edges.length !== ours.length - 1) {
    out.push(
      `edges: ${official.edges.length} official, ${ours.length - 1} ours`,
    )
  }

  // Shapes, from the official label box
  for (const [i, o] of official.nodes.entries()) {
    const s = mindmapShape(ours[i]!.node.shape, o.labelWidth, o.labelHeight)
    if (
      Math.abs(s.width - o.width) > SIZE_TOL ||
      Math.abs(s.height - o.height) > SIZE_TOL
    ) {
      out.push(
        `node ${i}: shape ${o.width}x${o.height} official, ${s.width}x${s.height} ours`,
      )
    }
  }

  // Layout, from the official node sizes
  const placed = coseBilkentLayout(
    official.nodes.map((o) => ({
      id: String(o.id),
      width: o.width,
      height: o.height,
    })),
    ours.flatMap((u) =>
      u.parent === undefined
        ? []
        : [{ source: String(u.parent), target: String(u.node.id) }],
    ),
  )
  const root = official.nodes[0]!
  const at = placed.get('0')!
  for (const o of official.nodes) {
    const p = placed.get(String(o.id))!
    const dx = p.x - at.x - (o.x - root.x)
    const dy = p.y - at.y - (o.y - root.y)
    if (Math.hypot(dx, dy) > POSITION_TOL) {
      out.push(
        `node ${o.id}: position off by (${dx.toFixed(3)}, ${dy.toFixed(3)})`,
      )
    }
  }

  // Edges: class and the path through the official centres
  const byId = new Map(official.nodes.map((o) => [o.id, o]))
  for (const e of official.edges) {
    const u = ours[e.to]!
    const depth = ours[e.from]!.node.level + 1
    const wantedClasses = `section-edge-${u.section} edge-depth-${depth}`
    const hasClasses = wantedClasses
      .split(' ')
      .every((c) => e.classes.split(/\s+/).includes(c))
    if (!hasClasses) {
      out.push(
        `edge ${e.from}_${e.to}: classes "${e.classes}" official, wanted ${wantedClasses}`,
      )
    }
    const a = byId.get(e.from)!
    const b = byId.get(e.to)!
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const p0: [number, number] = [
      a.x + ((b.x - a.x) / len) * MINDMAP.edgeInset,
      a.y + ((b.y - a.y) / len) * MINDMAP.edgeInset,
    ]
    const p2: [number, number] = [
      b.x - ((b.x - a.x) / len) * MINDMAP.edgeInset,
      b.y - ((b.y - a.y) / len) * MINDMAP.edgeInset,
    ]
    const ourPath = basisPath([
      p0,
      [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2],
      p2,
    ])
    const ours_d = numbers(ourPath)
    const theirs = numbers(e.d)
    const commands = (d: string) => d.replace(/[^A-Za-z]/g, '')
    const worst =
      ours_d.length === theirs.length && commands(ourPath) === commands(e.d)
        ? Math.max(...ours_d.map((v, k) => Math.abs(v - theirs[k]!)))
        : Infinity
    if (worst > PATH_TOL) {
      out.push(`edge ${e.from}_${e.to}: path differs by ${worst}`)
    }
  }
  return out
}
