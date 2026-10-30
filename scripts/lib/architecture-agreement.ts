/**
 * Architecture-diagram placement agreement against official mermaid.js
 * (#2451), for scripts/architecture-oracle.ts. Browser-free so it can be
 * unit-tested.
 *
 * Mermaid places services with cytoscape fcose, constrained by the L/R/T/B
 * sides in the source. fcose is a force layout: distances, and sometimes the
 * whole arrangement, move with the iteration seed and the font metrics, so
 * pixel positions are not comparable. What the source does pin is relative
 * placement (`a:R -- L:b` puts b to the right of a, a group contains its
 * services), so the same pairwise above/below/beside and containment figures
 * as the flowchart oracle are taken, with a wider "level" band (ARCH_TOLERANCE)
 * because fcose spaces icons far less evenly than a layered layout does.
 */

import { splitStatements } from '@zombie-mermaid/core'
import {
  architectureToGraph,
  parseArchitecture,
} from '@zombie-mermaid/mermaid-parser'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import {
  agreement,
  type Agreement,
  type Box,
  type LayoutBoxes,
} from './layout-agreement.ts'

/** Px; half an 80px service icon. Two centres closer than this count as level. */
export const ARCH_TOLERANCE = 40

/** Official mermaid draws a service or junction as an 80px square at its `translate`. */
const ICON = 80

const num = (tag: string, name: string): number =>
  Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1])

const translate = (tag: string): { x: number; y: number } | undefined => {
  const m = /translate\(\s*(-?[\d.]+)[ ,]+\s*(-?[\d.]+)\s*\)/.exec(tag)
  return m ? { x: Number(m[1]), y: Number(m[2]) } : undefined
}

/**
 * Boxes from official mermaid: `g#<render>-service-<id>` and
 * `g.architecture-junction` (its inner `rect#<render>-node-<id>`) are
 * translated 80px squares; groups are `rect#<render>-group-<id>`.
 */
export function parseOfficialArchitecture(
  svg: string,
  renderId: string,
): LayoutBoxes {
  const nodes: Record<string, Box> = {}
  const groups: Record<string, Box> = {}
  const add = (re: RegExp): void => {
    for (const m of svg.matchAll(re)) {
      const t = translate(m[0])
      if (t) nodes[m[1]!] = { x: t.x, y: t.y, w: ICON, h: ICON }
    }
  }
  add(new RegExp(`<g\\b[^>]*id="${renderId}-service-([^"]+)"[^>]*>`, 'g'))
  add(
    new RegExp(
      `<g\\b[^>]*class="architecture-junction"[^>]*>\\s*<g>\\s*<rect\\b[^>]*id="${renderId}-node-([^"]+)"`,
      'g',
    ),
  )
  for (const m of svg.matchAll(
    new RegExp(`<rect\\b[^>]*id="${renderId}-group-([^"]+)"[^>]*>`, 'g'),
  )) {
    groups[m[1]!] = {
      x: num(m[0], 'x'),
      y: num(m[0], 'y'),
      w: num(m[0], 'width'),
      h: num(m[0], 'height'),
    }
  }
  return { nodes, groups }
}

/** Box of every service, junction and group in our own layout of `source` (the one the SVG is drawn from). */
export function measureOurArchitecture(source: string): LayoutBoxes {
  const laid = layoutGraphSync(
    architectureToGraph(parseArchitecture(splitStatements(source))),
  )
  const box = (n: { x: number; y: number; width: number; height: number }) => ({
    x: n.x,
    y: n.y,
    w: n.width,
    h: n.height,
  })
  const nodes: Record<string, Box> = {}
  for (const n of laid.nodes) nodes[n.id] = box(n)
  const groups: Record<string, Box> = {}
  const walk = (list: typeof laid.groups): void => {
    for (const g of list) {
      groups[g.id] = box(g)
      walk(g.children)
    }
  }
  walk(laid.groups)
  return { nodes, groups }
}

/** Placement agreement of our boxes with the official ones. */
export function architectureAgreement(
  official: LayoutBoxes,
  ours: LayoutBoxes,
): Agreement {
  return agreement(official, ours, ARCH_TOLERANCE)
}

/** Lowest figure of a sample, or null when it has none. */
export function worstArch(a: Agreement): number | null {
  const v = [a.vertical, a.horizontal, a.containment].filter(
    (n): n is number => n !== null,
  )
  return v.length > 0 ? Math.min(...v) : null
}

/**
 * Floor for every sample's lowest figure: the weakest sample on the first run
 * against mermaid 12.2.0 (Group-To-Group Edges, 50% vertical). Our layered
 * layout does not put side-linked services on one row the way fcose does, so
 * this guards against getting worse, not against the known gap.
 */
export const ARCH_FLOOR = 0.5

/** One tracked data point: mean of each figure over the architecture samples. */
export interface ArchitectureEntry {
  kind: 'architecture'
  date: string
  commit: string
  mermaid: string
  samples: number
  vertical: number | null
  horizontal: number | null
  containment: number | null
}

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((n): n is number => n !== null)
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Collapse per-sample results into one history entry. */
export function summarizeArchitecture(
  results: Record<string, Agreement>,
  meta: { date: string; commit: string; mermaid: string },
): ArchitectureEntry {
  const all = Object.values(results)
  return {
    kind: 'architecture',
    ...meta,
    samples: all.length,
    vertical: mean(all.map((r) => r.vertical)),
    horizontal: mean(all.map((r) => r.horizontal)),
    containment: mean(all.map((r) => r.containment)),
  }
}

/** Samples under the floor; empty when within it. `errored` samples count as breaches. */
export function architectureBreaches(
  results: Record<string, Agreement>,
  errored: string[] = [],
): string[] {
  const out = errored.map((t) => `${t} (error)`)
  for (const [title, r] of Object.entries(results)) {
    const low = worstArch(r)
    if (low !== null && low + 1e-9 < ARCH_FLOOR) {
      out.push(`${title} (${Math.round(low * 100)}% < ${ARCH_FLOOR * 100}%)`)
    }
  }
  return out
}
