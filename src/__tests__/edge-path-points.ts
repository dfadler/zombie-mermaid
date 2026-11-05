/**
 * The routed bend points of an edge, recovered from its `d` attribute.
 *
 * Edges are `<path>`s with rounded corners (#2635): each bend is `L <fillet
 * start> Q <corner> <fillet end>`, so the corner is the `Q` control point and
 * the `L` before it is dropped. A path with no `Q` is its own points.
 */
export function pathPoints(d: string): { x: number; y: number }[] {
  const cmds = [...d.matchAll(/([MLQ])\s*([-\d.,\s]+)/g)].map((m) => ({
    c: m[1]!,
    n: m[2]!
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number),
  }))
  const out: { x: number; y: number }[] = []
  cmds.forEach((cmd, i) => {
    if (cmd.c === 'L' && cmds[i + 1]?.c === 'Q') return
    out.push({ x: cmd.n[0]!, y: cmd.n[1]! })
  })
  return out
}

/** `pathPoints` for every edge `<path>` in `svg`, keyed `FROM->TO` (last wins). */
export function edgePointsByEnds(
  svg: string,
): Map<string, { x: number; y: number }[]> {
  const out = new Map<string, { x: number; y: number }[]>()
  for (const m of svg.matchAll(
    /<path class="edge"[^>]*data-from="([^"]+)" data-to="([^"]+)"[^>]* d="([^"]+)"/g,
  ))
    out.set(`${m[1]}->${m[2]}`, pathPoints(m[3]!))
  return out
}

/** `x,y x,y …` form of `pathPoints`, for tests that compare point lists as text. */
export function pathPointsAttr(d: string): string {
  return pathPoints(d)
    .map((p) => `${p.x},${p.y}`)
    .join(' ')
}
