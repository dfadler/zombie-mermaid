/**
 * Reads a flowchart layout back out of real mermaid.js (headless Chromium) in the
 * @zombie-mermaid/elk-layout output shape, for scripts/elk-layout-oracle.ts. Node w/h come
 * from the shape's getBBox (rect, polygon, path...); edge points from the path's data-points.
 */
import {
  startRealMermaid,
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface LNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
  lines?: string[]
}
export interface LEdge {
  id: string
  from: string
  to: string
  pts: [number, number][]
  label?: string
  lw?: number
  lh?: number
  arrowStart?: boolean
  arrowEnd?: boolean
}
export interface Layout {
  dir: string
  nodes: LNode[]
  edges: LEdge[]
}

export async function oracleLayout(
  s: RealMermaidSession,
  src: string,
  id = 'orc',
): Promise<Layout> {
  const svg = await renderRealMermaidSvg(s, id, src)
  const dir =
    /^\s*(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)/m.exec(src)?.[1] ?? 'TD'
  const out = await s.page.evaluate((svg) => {
    const host = document.createElement('div')
    host.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden'
    host.innerHTML = svg
    document.body.appendChild(host)
    const nodes = [...host.querySelectorAll('g.node')].map((g) => {
      const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(
        g.getAttribute('transform') ?? '',
      )!
      const shape = g.querySelector(
        ':scope > rect, :scope > polygon, :scope > path, :scope > circle, :scope > ellipse, :scope > g > path, :scope > g > rect',
      ) as SVGGraphicsElement
      let b = shape?.getBBox() ?? { width: 0, height: 0 }
      if (!b.width)
        b =
          (
            g.querySelector('circle') as SVGGraphicsElement | null
          )?.parentElement?.getBBox() ?? b
      const nid = /flowchart-(.+)-\d+$/.exec(g.id)?.[1] ?? g.id
      return {
        id: nid,
        x: +m[1]!,
        y: +m[2]!,
        w: b.width,
        h: b.height,
        label: g.textContent!.trim(),
      }
    })
    const labels = [...host.querySelectorAll('g.edgeLabel')].map((g) => {
      const fo = g.querySelector('foreignObject')
      return {
        text: g.textContent!.trim(),
        w: fo ? +fo.getAttribute('width')! : 0,
        h: fo ? +fo.getAttribute('height')! : 0,
      }
    })
    const edges = [...host.querySelectorAll('path.flowchart-link')].map((p) => {
      const pts = (
        JSON.parse(atob(p.getAttribute('data-points')!)) as {
          x: number
          y: number
        }[]
      ).map((q) => [q.x, q.y] as [number, number])
      return { id: p.id, pts, di: p.getAttribute('data-id') ?? '' }
    })
    return { nodes, edges, labels }
  }, svg)
  const edges: LEdge[] = out.edges.map((e) => {
    const m = /L[_-](.+)[_-](.+?)[_-]\d+$/.exec(e.di || e.id)
    return {
      id: e.di || e.id,
      from: m?.[1] ?? '?',
      to: m?.[2] ?? '?',
      pts: e.pts,
    }
  })
  // edgeLabel groups are emitted in edge order
  out.labels.forEach((l, i) => {
    if (edges[i] && l.text)
      Object.assign(edges[i]!, { label: l.text, lw: l.w, lh: l.h })
  })
  return { dir, nodes: out.nodes, edges }
}

export { startRealMermaid }
