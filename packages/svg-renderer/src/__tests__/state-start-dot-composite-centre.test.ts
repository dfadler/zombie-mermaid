import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

// The `[*]` dot sat 3px off the edge leaving it when it joined a composite
// state: centreStateMarkers only looked the neighbour up among nodes, and a
// composite is a group.
const composite = (dir: string, target: string): string =>
  `stateDiagram-v2\n  direction ${dir}\n  [*] --> ${target}\n  ${target} --> Q\n  state ${target} {\n    B\n    --\n    C\n  }`

const startEdgeAndDot = (src: string): { edge: number[]; dot: number[] } => {
  const svg = renderMermaidSVG(src)
  const d =
    /data-from="_start"[^>]* d="M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+)"/.exec(
      svg,
    )!
  const c = /<circle cx="([\d.]+)" cy="([\d.]+)"/.exec(svg)!
  return { edge: d.slice(1).map(Number), dot: c.slice(1).map(Number) }
}

describe('state start dot joined to a composite', () => {
  it('TB: dot is centred on the edge leaving it', () => {
    const { edge, dot } = startEdgeAndDot(composite('TB', 'W'))
    expect(dot[0]).toBe(edge[0])
  })

  it('LR: dot is centred on the edge leaving it', () => {
    const { edge, dot } = startEdgeAndDot(composite('LR', 'W'))
    expect(dot[1]).toBe(edge[1])
  })
})
