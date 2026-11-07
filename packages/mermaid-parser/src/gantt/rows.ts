import type { GanttTask } from './types.ts'

/**
 * Mermaid's `getMaxIntersections` (compact mode): pack one section's tasks onto
 * the fewest rows, assigning each its row (`offset` + index) in `orders`.
 * Returns the highest row index used, relative to `offset`.
 */
export function packGanttSection(
  tasks: GanttTask[],
  offset: number,
  orders: Map<GanttTask, number>,
): number {
  const timeline = tasks.map(() => -Infinity)
  const sorted = [...tasks].sort(
    (a, b) => a.start - b.start || a.order - b.order,
  )
  let max = 0
  for (const t of sorted) {
    for (let j = 0; j < timeline.length; j++) {
      if (t.start >= timeline[j]!) {
        timeline[j] = t.end
        orders.set(t, j + offset)
        if (j > max) max = j
        break
      }
    }
  }
  return max
}
