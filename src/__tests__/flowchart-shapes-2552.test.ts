/**
 * #2552: mermaid 12.2.0 and 12.3.0 draw `cloud`, `h-cyl`, `tag-rect`, `sm-circ`
 * and `fork`/`join` as their own outlines. `cloud`, `tag-rect` and the
 * horizontal cylinder have no ASCII analogue beyond a box (the horizontal
 * cylinder keeps the cylinder glyph); `sm-circ` is the state-start dot.
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. It does not claim to match mermaid.js.
// Mermaid 12.3.0 verdict (#2708): matches (label level, 4 SVG sources and the ASCII one); outline geometry not compared, and the SVG viewBox differs (e.g. sm-circ 80x86 mermaid vs 152x150 here), left to #2678.
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
      ['fork-bar', ''],
      ['fork-bar', ''],
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
    expect(svg).toMatch(/<rect x="[\d.]+" y="[\d.]+" width="10" height="70"/)
  })

  it('lays a fork bar across the flow', () => {
    expect(estimateNodeSize('F', '', 'fork-bar', 14, undefined, 'TD')).toEqual({
      width: 70,
      height: 10,
    })
    expect(estimateNodeSize('F', '', 'fork-bar', 14, undefined, 'RL')).toEqual({
      width: 10,
      height: 70,
    })
    const tb = renderMermaidSVG(
      'flowchart TD\nA --> F@{ shape: fork }\nF --> B',
    )
    expect(tb).toMatch(/<rect x="[\d.]+" y="[\d.]+" width="70" height="10"/)
  })

  // #2850: mermaid@12.3.0 label box is 120 wide and 24 per line; padding is
  // 15 for the cloud, 12 for the h-cyl, 24 for the tag-rect (headless oracle
  // and GitHub/mermaid.live agree: 168.8x103.9, 148.8x36, 161.6x48).
  it('sizes cloud, h-cyl and tag-rect like mermaid (#2850)', () => {
    const size = (shape: string, label: string) =>
      estimateNodeSize('A', label, shape, 16)
    const round = (s: { width: number; height: number }) => [
      Math.round(s.width * 10) / 10,
      Math.round(s.height * 10) / 10,
    ]
    expect(round(size('cloud', 'cloud'))).toEqual([168.8, 103.8])
    expect(round(size('horizontal-cylinder', 'h-cyl'))).toEqual([148.8, 36])
    expect(round(size('tagged-rectangle', 'tag'))).toEqual([161.6, 48])
    // multi-line: 24px per line
    expect(round(size('cloud', 'a\nb\nc'))[1]).toBe(151.8)
    expect(round(size('horizontal-cylinder', 'a\nb'))[1]).toBe(60)
    expect(round(size('tagged-rectangle', 'a\nb\nc'))[1]).toBe(96)
  })

  const EDGE = `flowchart LR
A@{ shape: cloud, label: "line one<br/>line two" }
B@{ shape: h-cyl, label: "line one<br/>line two<br/>line three" }
C@{ shape: tag-rect, label: "a label wider than the 120px minimum box" }
A --> B --> C`

  it('multi-line and wide labels: SVG snapshot (#2850)', () => {
    expect(renderMermaidSVG(EDGE)).toMatchSnapshot()
  })

  it('multi-line and wide labels: ASCII snapshot (#2850)', () => {
    expect(renderMermaidASCII(EDGE)).toMatchSnapshot()
  })

  it('fills the bar from style and classDef, but ignores them on the small circle (#2680)', () => {
    const svg = renderMermaidSVG(
      'flowchart LR\nD@{ shape: sm-circ }\nE@{ shape: fork }\nclassDef hot fill:#f00,stroke:#00f\nclass D,E hot\nstyle D stroke-width:4px,stroke-dasharray:5 5\nD --> E',
    )
    expect(svg).toMatch(
      /<circle [^>]*r="7" fill="var\(--_node-fill\)" stroke="var\(--_node-stroke\)" stroke-width="0.75" \/>/,
    )
    expect(svg).not.toContain('stroke-dasharray="5')
    expect(svg).toMatch(/<rect [^>]*width="10" height="70" [^>]*fill="#f00"/)
  })
})
