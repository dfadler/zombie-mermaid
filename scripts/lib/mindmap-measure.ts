/** Runs every mindmap sample through real mermaid and diffs structure, shapes and layout, for mindmap-oracle.ts and layout-oracle.ts (#2840). */
import { samples } from '../../samples/samples-data.ts'
import { mindmapMismatches, type OfficialMindmap } from './mindmap-agreement.ts'
import type { RealMermaidSession } from './real-mermaid.ts'

/** Render `source` in real mermaid and read the figure back out of the DOM. */
export async function readOfficialMindmap(
  session: RealMermaidSession,
  id: string,
  source: string,
): Promise<OfficialMindmap> {
  return session.page.evaluate(
    async ([renderId, src]) => {
      const { svg } = await window.mermaid.render(renderId!, src!)
      const host = document.createElement('div')
      host.style.cssText = 'position:absolute;left:0;top:0'
      host.innerHTML = svg
      document.body.appendChild(host)
      try {
        const nodes = [...host.querySelectorAll<SVGGElement>('g.node')].map(
          (g) => {
            const t = /translate\(([-\d.e]+),\s*([-\d.e]+)\)/.exec(
              g.getAttribute('transform') ?? '',
            )!
            const fo = g.querySelector('foreignObject')!
            const p = g.querySelector('p')!
            const lines = p.innerHTML.split(/<br\s*\/?>/i).map((h) => {
              const d = document.createElement('div')
              d.innerHTML = h
              return (d.textContent ?? '').trim()
            })
            let shape = 'path-other'
            if (g.querySelector(':scope > circle')) shape = 'circle'
            else if (g.querySelector(':scope > polygon')) shape = 'polygon'
            else if (g.querySelector(':scope > rect.basic')) {
              shape = g.querySelector(':scope > rect.basic')!.hasAttribute('rx')
                ? 'rect-rounded'
                : 'rect'
            } else if (g.querySelector(':scope > path.node-bkg'))
              shape = 'path-default'
            const box = g.getBBox()
            return {
              id: Number(/node_(\d+)$/.exec(g.id)![1]),
              classes: (g.getAttribute('class') ?? '')
                .replace(/^node mindmap-node\s*/, '')
                .replace(/section-root section--1\s*/, 'section-root ')
                .trim(),
              shape,
              lines,
              labelWidth: Number(fo.getAttribute('width')),
              labelHeight: Number(fo.getAttribute('height')),
              width: box.width,
              height: box.height,
              x: Number(t[1]),
              y: Number(t[2]),
            }
          },
        )
        const edges = [
          ...host.querySelectorAll<SVGPathElement>('path.edge'),
        ].map((e) => {
          const m = /edge_(\d+)_(\d+)$/.exec(e.id)!
          return {
            from: Number(m[1]),
            to: Number(m[2]),
            classes: e.getAttribute('class') ?? '',
            d: e.getAttribute('d') ?? '',
          }
        })
        return { nodes, edges }
      } finally {
        host.remove()
      }
    },
    [id, source] as [string, string],
  )
}

/** Sample title -> mismatches (empty = agrees). Errored samples count as breaches. */
export async function scoreMindmap(
  session: RealMermaidSession,
  filter?: string,
): Promise<{ results: Record<string, string[]>; breaches: string[] }> {
  const wanted = samples.filter(
    (s) =>
      /^\s*mindmap\b/.test(s.source) &&
      (!filter || s.title.toLowerCase().includes(filter.toLowerCase())),
  )
  const results: Record<string, string[]> = {}
  const breaches: string[] = []
  for (const [i, s] of wanted.entries()) {
    try {
      const official = await readOfficialMindmap(session, `mm_${i}`, s.source)
      const found = mindmapMismatches(s.source, official)
      results[s.title] = found
      if (found.length > 0)
        breaches.push(`${s.title} (${found.length} mismatches)`)
    } catch (err) {
      console.error(`ERR  ${s.title}: ${(err as Error).message.split('\n')[0]}`)
      breaches.push(`${s.title} (error)`)
    }
  }
  return { results, breaches }
}
