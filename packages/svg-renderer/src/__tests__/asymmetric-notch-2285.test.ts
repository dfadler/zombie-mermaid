/**
 * #2285: `A>text]` is a flag with a notch cut into its left edge (the tip
 * points inward, 12px deep), not a point sticking out. The label is centred
 * in the body right of the notch, and an edge entering the left side ends on
 * the notch tip.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import {
  layoutFlowchartSync,
  renderMermaidSVG,
} from '@zombie-mermaid/svg-renderer'
import { ASYMMETRIC_NOTCH } from '../styles.ts'

describe('asymmetric shape notch (#2285)', () => {
  for (const dir of ['LR', 'TD', 'RL', 'BT']) {
    it(`${dir}: notch tip points inward and the label is centred in the body`, () => {
      const src = `flowchart ${dir}\n  B --> A>Flag shape]`
      const n = layoutFlowchartSync(parseMermaid(src)).nodes.find(
        (x) => x.id === 'A',
      )!
      const svg = renderMermaidSVG(src)
      const poly = svg.match(
        /data-shape="asymmetric">\s*<polygon points="([^"]+)"/,
      )![1]!
      const pts = poly.split(' ').map((p) => p.split(',').map(Number))
      // top-left, top-right, bottom-right, bottom-left, then the inward tip
      expect(pts).toHaveLength(5)
      expect(pts[0]![0]).toBeCloseTo(n.x, 1)
      expect(pts[3]![0]).toBeCloseTo(n.x, 1)
      expect(pts[4]![0]).toBeCloseTo(n.x + ASYMMETRIC_NOTCH, 1)
      expect(pts[4]![1]).toBeCloseTo(n.y + n.height / 2, 1)
      const textX = svg.match(/<text x="([\d.]+)"[^>]*>Flag shape/)![1]
      expect(Number(textX)).toBeCloseTo(
        n.x + n.width / 2 + ASYMMETRIC_NOTCH / 2,
        1,
      )
    })
  }

  it('an edge entering the left side ends on the notch tip', () => {
    const layout = layoutFlowchartSync(
      parseMermaid('flowchart LR\n  B --> A>Flag shape]'),
    )
    const n = layout.nodes.find((x) => x.id === 'A')!
    const last = layout.edges[0]!.points.at(-1)!
    expect(last.x).toBeCloseTo(n.x + ASYMMETRIC_NOTCH, 1)
    expect(last.y).toBeCloseTo(n.y + n.height / 2, 1)
  })
})
