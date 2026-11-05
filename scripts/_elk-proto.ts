// Spike: mermaid@12.3.0's ELK graph build (elk-XV6XMXQE.mjs), re-implemented from a MermaidGraph.
import { measureMultilineText } from '@zombie-mermaid/core'
import type { MermaidGraph, MermaidSubgraph } from '@zombie-mermaid/core'
import { elkLayoutSync } from '../packages/svg-renderer/src/elk-instance.ts'
import { estimateNodeSize } from '../packages/svg-renderer/src/layout-engine/to-elk.ts'
import { DEFAULTS } from '../packages/svg-renderer/src/layout-engine/constants.ts'
import type { Box, LayoutBoxes } from './lib/layout-agreement.ts'

type Tree = { parentById: Record<string, string> }
const common = (a: string, b: string, { parentById }: Tree): string => {
  const seen = new Set<string>(); let c: string | undefined = a
  if (a === b) return parentById[a] || 'root'
  while (c) { seen.add(c); if (c === b) return c; c = parentById[c] }
  c = b
  while (c) { if (seen.has(c)) return c; c = parentById[c] }
  return 'root'
}
const childOn = (id: string, anc: string, t: Tree): string => { let c = id; while ((t.parentById[c] ?? 'root') !== anc) c = t.parentById[c]!; return c }
function feedback(edges: { source: string; target: string }[], t: Tree): boolean[] {
  const flags = edges.map(() => false); const levels = new Map<string, any[]>()
  edges.forEach(({ source, target }, index) => {
    if (source === target) return
    const anc = common(source, target, t); if (anc === source || anc === target) return
    const from = childOn(source, anc, t), to = childOn(target, anc, t)
    const l = levels.get(anc) ?? []; l.push({ index, from, to, collapsed: from !== source || to !== target }); levels.set(anc, l)
  })
  for (const level of levels.values()) {
    const succ = new Map<string, any[]>(), nodes: string[] = [], indeg = new Map<string, number>()
    for (const e of level) for (const n of [e.from, e.to]) if (!succ.has(n)) { succ.set(n, []); nodes.push(n); indeg.set(n, 0) }
    for (const e of level) { succ.get(e.from)!.push(e); indeg.set(e.to, indeg.get(e.to)! + 1) }
    const state = new Map<string, number>()
    for (const root of [...nodes.filter((n) => indeg.get(n) === 0), ...nodes]) {
      if (state.has(root)) continue
      state.set(root, 1); const stack = [{ node: root, next: 0 }]
      while (stack.length) {
        const f = stack[stack.length - 1]!, out = succ.get(f.node)!
        if (f.next >= out.length) { state.set(f.node, 2); stack.pop(); continue }
        const e = out[f.next++]; const s = state.get(e.to)
        if (s === 1) flags[e.index] = e.collapsed
        else if (s === undefined) { state.set(e.to, 1); stack.push({ node: e.to, next: 0 }) }
      }
    }
  }
  return flags
}
const inside = (id: string, anc: string, { parentById }: Tree): boolean => { let c = parentById[id]; while (c !== undefined) { if (c === anc) return true; c = parentById[c] } return false }
function nestedOrder(edges: { source: string; target: string }[], t: Tree): number[] {
  const order = edges.map((_, i) => i)
  edges.forEach(({ source, target }, index) => {
    const from = order.indexOf(index)
    const to = order.findIndex((o, pos) => { const e = edges[o]!; return pos < from && ((e.target === target && inside(source, e.source, t)) || (e.source === source && inside(target, e.target, t))) })
    if (to !== -1) { order.splice(from, 1); order.splice(to, 0, index) }
  })
  return order
}
const dirOf = (d?: string) => (d === 'LR' ? 'RIGHT' : d === 'RL' ? 'LEFT' : d === 'BT' ? 'UP' : 'DOWN')
const str = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
const PS = '[top=12,left=12,bottom=12,right=12]'

export interface ProtoOpts { sepOrder?: boolean; noFeedback?: boolean; rootOverride?: Record<string, unknown>; sgOverride?: Record<string, unknown>; leavesFirst?: boolean }

export function protoElk(graph: MermaidGraph, o: ProtoOpts = {}) {
  const fs = DEFAULTS.fontSizes ?? { nodeLabel: 13, edgeLabel: 11 }
  const parentById: Record<string, string> = {}
  const sgs: MermaidSubgraph[] = []
  const post = (list: MermaidSubgraph[], parent?: string) => { for (const sg of list) { if (parent) parentById[sg.id] = parent; for (const n of sg.nodeIds) if (!graph.subgraphs.some((x) => x.id === n)) parentById[n] = sg.id; post(sg.children, sg.id); sgs.push(sg) } }
  post(graph.subgraphs)
  for (const sg of sgs) for (const c of sg.children) parentById[c.id] = sg.id
  const clusters = [...sgs].reverse() // flowDb.getData emits subgraphs backwards
  const tree: Tree = { parentById }
  const mk = (id: string): any => {
    const n = graph.nodes.get(id)!
    const s = estimateNodeSize(id, n.label, n.shape, 13, n.icon, graph.direction)
    return { id, width: s.width, height: s.height }
  }
  const el: Record<string, any> = {}
  for (const sg of clusters) {
    const w = measureMultilineText(sg.label, 16, 400).width
    el[sg.id] = { id: sg.id, children: [], labels: [{ text: sg.label, width: w, height: 24 }],
      layoutOptions: str({ 'nodeSize.constraints': '[MINIMUM_SIZE, NODE_LABELS]', 'nodeSize.minimum': `(${w + 8}, 0)`, 'spacing.baseValue': 24,
        'elk.layered.spacing.edgeNodeBetweenLayers': 30, 'elk.spacing.edgeEdge': 20, 'spacing.nodeNode': 50,
        'elk.padding': '[top=24,left=24,bottom=24,right=24]', 'nodeLabels.placement': '[H_CENTER V_TOP, INSIDE]', 'elk.layered.mergeEdges': false,
        'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED', 'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST', 'elk.layered.nodePlacement.networkSimplex.nodeFlexibility': 'PORT_POSITION',
        'elk.spacing.portsSurrounding': PS, ...(sg.direction ? { 'elk.algorithm': 'elk.layered', 'elk.direction': dirOf(sg.direction), 'elk.hierarchyHandling': 'SEPARATE_CHILDREN' } : {}), ...o.sgOverride }) }
  }
  const leaves = [...graph.nodes.keys()].filter((id) => !el[id])
  for (const id of leaves) el[id] = mk(id)
  const root: any = { id: 'root', children: [], edges: [], layoutOptions: str({
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.algorithm': 'elk.layered', 'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED', 'elk.layered.mergeEdges': false, 'elk.direction': dirOf(graph.direction), 'spacing.baseValue': 40,
    'elk.layered.crossingMinimization.forceNodeModelOrder': false, 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', 'elk.layered.unnecessaryBendpoints': true,
    'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST', 'elk.layered.layering.strategy': 'NETWORK_SIMPLEX', 'elk.layered.layering.coffmanGraham.layerBound': 4,
    'elk.layered.wrapping.multiEdge.improveCuts': true, 'elk.layered.wrapping.multiEdge.improveWrappedEdges': true,
    'elk.layered.edgeRouting.selfLoopDistribution': 'EQUALLY', 'elk.layered.mergeHierarchyEdges': true, 'elk.spacing.portsSurrounding': PS, ...o.rootOverride }) }
  // nodeArr order: all clusters (reversed), then vertices in insertion order; children = filter by parent
  const nodeArr = o.leavesFirst ? [...leaves, ...clusters.map((c) => c.id)] : [...clusters.map((c) => c.id), ...leaves]
  for (const id of nodeArr) { const p = parentById[id]; (p ? el[p] : root).children.push(el[id]) }
  const edges = graph.edges.map((e, i) => ({ source: e.source, target: e.target, label: e.label, i }))
  let list = edges.map((e) => ({ id: `e${e.i}`, sources: [e.source], targets: [e.target], ...(e.label ? { labels: [{ text: e.label, width: measureMultilineText(e.label, 11, 400).width + 8, height: measureMultilineText(e.label, 11, 400).height + 6, layoutOptions: str({ 'edgeLabels.inline': true, 'edgeLabels.placement': 'CENTER' }) }] } : {}) }))
  // cross-hierarchy => INCLUDE_CHILDREN on both ends' ancestor chain
  const policy = (id: string, anc: string) => { const n = el[id]; if (!n) return; n.layoutOptions = { ...(n.layoutOptions ?? {}), 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' }; if (id !== anc && parentById[id]) policy(parentById[id]!, anc) }
  for (const e of edges) if (parentById[e.source] !== parentById[e.target]) { const a = common(e.source, e.target, tree); policy(e.source, a); policy(e.target, a) }
  if (!o.noFeedback) { const fl = feedback(list.map((e) => ({ source: e.sources[0]!, target: e.targets[0]! })), tree); list.forEach((e, i) => { if (fl[i]) [e.sources, e.targets] = [e.targets, e.sources] }) }
  const ord = nestedOrder(list.map((e) => ({ source: e.sources[0]!, target: e.targets[0]! })), tree)
  root.edges = ord.map((i) => list[i])
  return root
}

export function protoBoxes(graph: MermaidGraph, o: ProtoOpts = {}): LayoutBoxes {
  const res = elkLayoutSync(protoElk(graph, o) as any)
  const nodes: Record<string, Box> = {}, groups: Record<string, Box> = {}
  const walk = (n: any, ox: number, oy: number) => { for (const c of n.children ?? []) { const b = { x: ox + c.x, y: oy + c.y, w: c.width, h: c.height }; if (c.children?.length || graph.subgraphs.length && isSg(graph.subgraphs, c.id)) groups[c.id] = b; else nodes[c.id] = b; walk(c, b.x, b.y) } }
  const isSg = (l: MermaidSubgraph[], id: string): boolean => l.some((s) => s.id === id || isSg(s.children, id))
  walk(res, 0, 0)
  return { nodes, groups }
}
