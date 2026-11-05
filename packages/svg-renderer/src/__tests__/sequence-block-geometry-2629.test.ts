/**
 * #2629: pins the sequence block frame margin and tab notch geometry to the
 * values mermaid 12.3.0 draws, so a drifting literal fails a test instead of
 * only moving a screenshot.
 *
 * Mermaid 12.3.0 reference (sequence-block-label-layout, `critical`): frame
 * `x` is 11px outside the lifeline (`boxMargin` 10 + 1px stroke), nested
 * `rect` highlights step 10px in per level (21px outer, 11px inner), and a
 * 35px-tall tab is `64,83 114,83 114,111 105.6,118 64,118`: a 7px rise and
 * an 8.4px run, i.e. 0.2 and 0.24 of the tab height.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'
import { STROKE_WIDTHS } from '../styles.ts'
import {
  BLOCK_TAB_CUT_RISE_RATIO,
  BLOCK_TAB_CUT_RUN_RATIO,
  BLOCK_TAB_HEIGHT,
  blockFramePad,
  blockTabPoints,
} from '../sequence/layout.ts'

const num = (s: string, re: RegExp) => Number(re.exec(s)![1])

/** The x of the first lifeline of actor `id`. */
const lifelineX = (svg: string, id: string) =>
  num(svg, new RegExp(`class="lifeline" data-actor="${id}" x1="([\\d.]+)"`))

/** The x of every filled `rect <color>` highlight, outer first. */
const highlightXs = (svg: string) =>
  [...svg.matchAll(/<rect x="([\d.]+)"[^>]*fill="rgb\(/g)].map((m) => +m[1]!)

describe('sequence block geometry (#2629)', () => {
  it('ties the frame margin to boxMargin plus the frame stroke', () => {
    expect(blockFramePad({ blockPadX: 10 })).toBe(10 + STROKE_WIDTHS.outerBox)
    expect(blockFramePad({ blockPadX: 10 })).toBe(11)
  })

  it('draws a loop frame 11px outside the outermost lifelines', () => {
    const svg = renderMermaidSVG(
      'sequenceDiagram\nparticipant A\nparticipant B\nloop L\nA->>B: x\nend',
    )
    const rect =
      /<g class="block" data-type="loop"[^>]*>\s*<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/.exec(
        svg,
      )!
    const left = Number(rect[1])
    const right = left + Number(rect[2])
    expect(lifelineX(svg, 'A') - left).toBe(11)
    expect(right - lifelineX(svg, 'B')).toBe(11)
  })

  it('steps nested rect highlights in 21px (outer) then 11px (inner)', () => {
    const svg = renderMermaidSVG(
      'sequenceDiagram\nparticipant A\nparticipant B\n' +
        'rect rgb(200, 220, 255)\nA->>B: o\nrect rgb(255, 220, 200)\nB->>A: i\nend\nend',
    )
    const [outer, inner] = highlightXs(svg)
    expect(lifelineX(svg, 'A') - outer!).toBe(21)
    expect(lifelineX(svg, 'A') - inner!).toBe(11)
  })

  it('cuts the tab corner 0.2 x 0.24 of its height, as mermaid does', () => {
    expect(BLOCK_TAB_CUT_RISE_RATIO).toBe(0.2)
    expect(BLOCK_TAB_CUT_RUN_RATIO).toBe(0.24)
    // mermaid's 35px tab: 7px rise, 8.4px run
    expect(35 * BLOCK_TAB_CUT_RISE_RATIO).toBeCloseTo(7)
    expect(35 * BLOCK_TAB_CUT_RUN_RATIO).toBeCloseTo(8.4)
  })

  it('emits the tab as a five-point polygon with the notch at the bottom right', () => {
    const h = BLOCK_TAB_HEIGHT
    const pts = blockTabPoints(10, 20, 50)
    expect(pts).toEqual([
      [10, 20],
      [60, 20],
      [60, 20 + h - h * 0.2],
      [60 - h * 0.24, 20 + h],
      [10, 20 + h],
    ])
    const svg = renderMermaidSVG(
      'sequenceDiagram\nA->>B: x\nloop L\nB->>A: y\nend',
    )
    const drawn = /<polygon points="([^"]+)" fill="var\(--_group-hdr\)"/.exec(
      svg,
    )![1]!
    const p = drawn
      .split(' ')
      .map((pt) => pt.split(',').map(Number) as [number, number])
    expect(p).toHaveLength(5)
    // Notch: BLOCK_TAB_HEIGHT * 0.2 up the right edge, * 0.24 along the bottom
    expect(p[1]![1]! + h - p[2]![1]!).toBeCloseTo(h * 0.2)
    expect(p[2]![0]! - p[3]![0]!).toBeCloseTo(h * 0.24)
    expect(p[4]![1]! - p[0]![1]!).toBe(h)
  })

  it('dots the frame and dashes the dividers', () => {
    const svg = renderMermaidSVG(
      'sequenceDiagram\nA->>B: x\nalt a\nB->>A: y\nelse b\nA->>B: z\nend',
    )
    expect(svg).toMatch(/<rect [^>]*rx="0"[^>]*stroke-dasharray="2 2"/)
    expect(svg).toMatch(/<line [^>]*stroke-dasharray="3 3"/)
  })

  // #2628: mermaid 12.3.0 computed styles: `.loopLine` 2px (frame and
  // dividers), `.labelBox` 1px, `.note` a plain 1px rectangle.
  it('strokes the frame and dividers 2px and the tab 1px', () => {
    const svg = renderMermaidSVG(
      'sequenceDiagram\nA->>B: x\nalt a\nB->>A: y\nelse b\nA->>B: z\nend',
    )
    expect(svg).toMatch(/<rect [^>]*stroke-width="2" stroke-dasharray="2 2"/)
    expect(svg).toMatch(/<line [^>]*stroke-width="2" stroke-dasharray="3 3"/)
    expect(svg).toMatch(/<polygon [^>]*group-hdr[^>]*stroke-width="1"/)
  })

  it('draws a note as a plain 1px rectangle, with no dog-ear', () => {
    const svg = renderMermaidSVG('sequenceDiagram\nA->>B: x\nNote over A,B: hi')
    const note = /<g class="note"[^>]*>([\s\S]*?)<\/g>/.exec(svg)![1]!
    expect(note).toMatch(/<rect [^>]*stroke-width="1"/)
    expect(note).not.toContain('<polygon')
  })
})
