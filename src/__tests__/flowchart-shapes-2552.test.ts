/**
 * #2552: mermaid 12.2.0 and 12.3.0 draw `cloud`, `h-cyl`, `tag-rect`, `sm-circ`
 * and `fork`/`join` as their own outlines. `cloud`, `tag-rect` and the
 * horizontal cylinder have no ASCII analogue beyond a box (the horizontal
 * cylinder keeps the cylinder glyph); `sm-circ` is the state-start dot.
 */
import { describe, expect, it } from 'vitest'
import { parseMermaid, renderMermaidASCII, renderMermaidSVG } from '../index.ts'
import { estimateNodeSize } from '../../packages/svg-renderer/src/layout-engine/to-elk.ts'

const SRC = `flowchart LR
A@{ shape: cloud, label: "cloud" }
B@{ shape: h-cyl, label: "h-cyl" }
C@{ shape: tag-rect, label: "tag" }
D@{ shape: sm-circ }
E@{ shape: fork }
F@{ shape: join, label: "ignored" }
A --> B --> C --> D --> E --> F`

describe('flowchart expanded shapes (#2552)', () => {
  it('SVG snapshot', () => {
    expect(renderMermaidSVG(SRC)).toMatchSnapshot()
  })

  it('ASCII snapshot', () => {
    expect(renderMermaidASCII(SRC)).toMatchSnapshot()
  })

  it('parses each name to its own shape; fork, join and sm-circ lose their label', () => {
    const { nodes } = parseMermaid(SRC)
    expect([...nodes.values()].map((n) => [n.shape, n.label])).toEqual([
      ['cloud', 'cloud'],
      ['horizontal-cylinder', 'h-cyl'],
      ['tagged-rectangle', 'tag'],
      ['small-circle', ''],
      ['fork-join', ''],
      ['fork-join', ''],
    ])
  })

  it('keeps the aliases: start is the small circle, tag-proc the tagged rectangle', () => {
    const { nodes } = parseMermaid(
      'flowchart TD\nA@{ shape: start }\nB@{ shape: tag-proc }\nC@{ shape: das }',
    )
    expect([...nodes.values()].map((n) => n.shape)).toEqual([
      'small-circle',
      'tagged-rectangle',
      'horizontal-cylinder',
    ])
  })

  it('draws a cloud path, a tag triangle, a 14px dot and an upright bar for LR', () => {
    const svg = renderMermaidSVG(SRC)
    expect(svg).toMatch(/<path transform="translate\([\d. ]+\)" d="M0 0 a/)
    expect(svg).toMatch(/<polygon points="[^"]+" fill=/) // dog-ear
    expect(svg).toContain('r="7"')
    expect(svg).toMatch(/<rect x="[\d.]+" y="[\d.]+" width="8" height="70"/)
  })

  it('lays a fork bar across the flow', () => {
    expect(estimateNodeSize('F', '', 'fork-join', 14, undefined, 'TD')).toEqual(
      { width: 70, height: 10 },
    )
    expect(estimateNodeSize('F', '', 'fork-join', 14, undefined, 'RL')).toEqual(
      { width: 10, height: 70 },
    )
    const tb = renderMermaidSVG(
      'flowchart TD\nA --> F@{ shape: fork }\nF --> B',
    )
    expect(tb).toMatch(/<rect x="[\d.]+" y="[\d.]+" width="70" height="8"/)
  })
})
