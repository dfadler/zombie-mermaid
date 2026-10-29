// Opt-in `describe: 'auto'` (#1879): a deterministic <desc> built only from
// words in the source. Flowchart/state graphs (nodes Map + edges array) only.
import type { MermaidEdge, MermaidNode } from '@zombie-mermaid/core'

const MAX = 500

const clean = (s: string): string =>
  s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function describeGraph(diagram: unknown): string | undefined {
  const g = diagram as { nodes?: unknown; edges?: unknown }
  if (!(g.nodes instanceof Map) || !Array.isArray(g.edges)) return undefined
  const nodes = g.nodes as Map<string, MermaidNode>
  const edges = g.edges as MermaidEdge[]
  if (nodes.size === 0) return undefined
  const name = (id: string) => clean(nodes.get(id)?.label ?? id) || id
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  const parts = edges.map((e) => {
    const label = e.label ? clean(e.label) : ''
    return `${name(e.source)} to ${name(e.target)}${label ? ` (${label})` : ''}`
  })
  if (!parts.length) parts.push([...nodes.keys()].map(name).join(', '))
  const out =
    `Diagram with ${plural(nodes.size, 'node')} and ` +
    `${plural(edges.length, 'connection')}: ${parts.join('; ')}`
  return out.length > MAX ? `${out.slice(0, MAX - 1)}…` : out
}
