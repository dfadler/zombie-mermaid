import { describe, it, expect } from 'vitest'
import { renderMermaidASCII, renderMermaidSVG } from '../src/index.ts'

// Block labels follow mermaid.js: the tab holds only the block type, the
// `[label]` and every divider label are centred across the frame (each on its
// own row, above the message it introduces), and the frame hugs its outermost
// lifelines instead of the wider actor boxes above them.
const source = `sequenceDiagram
  participant App
  participant Broker
  critical Establish connection
    App->>Broker: connect
  option Network timeout
    Broker-->>App: retry
  option Credentials denied
    Broker-->>App: abort
  end`

const num = (tag: string, attr: string): number =>
  Number(tag.split(` ${attr}="`)[1]!.split('"')[0])

describe('block label layout', () => {
  const svg = renderMermaidSVG(source)
  /** The opening `<text ...>` tag of the element whose content is `content`. */
  const textTag = (content: string): string => {
    const end = svg.indexOf(`>${content}</text>`)
    return svg.slice(svg.lastIndexOf('<text', end), end)
  }
  const frame =
    /<g class="block"[^>]*>\s*<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/.exec(
      svg,
    )!
  const left = Number(frame[1])
  const right = left + Number(frame[2])
  const lifelineXs = [
    ...svg.matchAll(/<line class="lifeline" data-actor="[^"]*" x1="([\d.]+)"/g),
  ].map((m) => Number(m[1]))

  it('SVG: the frame sits the same small distance outside both lifelines', () => {
    const outerLeft = Math.min(...lifelineXs)
    const outerRight = Math.max(...lifelineXs)
    // mermaid@12.3.0 draws the frame 11px outside the lifelines.
    expect(outerLeft - left).toBe(11)
    expect(right - outerRight).toBeCloseTo(outerLeft - left, 1)
  })

  /** Corner points of the block's type tab, which is a polygon. */
  const tabPoints = (): number[][] =>
    /<polygon points="([^"]+)"[^>]*group-hdr/
      .exec(svg)![1]!
      .split(' ')
      .map((p) => p.split(',').map(Number))

  it('SVG: the frame is dotted and the tab has its bottom-right corner cut, as in mermaid', () => {
    expect(svg).toMatch(
      /<rect x="[\d.]+"[^>]*fill="none"[^>]*stroke-dasharray="2 2"/,
    )
    const pts = tabPoints()
    expect(pts).toHaveLength(5)
    // top-right, then a vertical edge that stops short of the bottom, then the cut.
    expect(pts[2]![0]).toBe(pts[1]![0])
    expect(pts[3]![0]).toBeLessThan(pts[2]![0]!)
    expect(pts[3]![1]).toBeGreaterThan(pts[2]![1]!)
  })

  it('SVG: divider labels are centred on the frame, the header label right of the tab', () => {
    const centre = (left + right) / 2
    const tabRight = tabPoints()[1]![0]!
    const header = textTag('[Establish connection]')
    expect(num(header, 'x')).toBeCloseTo((tabRight + right) / 2, 1)
    for (const label of ['[Network timeout]', '[Credentials denied]']) {
      expect(num(textTag(label), 'x')).toBeCloseTo(centre, 1)
    }
  })

  it('SVG: a divider label sits on its own row above the message label', () => {
    const rows = (text: string) => num(textTag(text), 'y')
    expect(rows('retry') - rows('[Network timeout]')).toBeGreaterThanOrEqual(11)
    expect(rows('abort') - rows('[Credentials denied]')).toBeGreaterThanOrEqual(
      11,
    )
  })

  it('ASCII: the wall sits the same distance outside both lifelines', () => {
    const rows = renderMermaidASCII(source).split('\n')
    const row = rows.find((r) => r.includes('retry'))!
    // `│   │   retry   │   │`: wall, gap, lifeline, ..., lifeline, gap, wall.
    const cols = [...row].flatMap((c, i) => (c === '│' ? [i] : []))
    expect(cols).toHaveLength(4)
    expect(cols[1]! - cols[0]!).toBe(cols[3]! - cols[2]!)
  })

  it('ASCII: divider labels are centred, with dashes on both sides', () => {
    const line = renderMermaidASCII(source)
      .split('\n')
      .find((r) => r.includes('[Network timeout]'))!
      .trimEnd()
    const [before, after] = line.split(' [Network timeout] ')
    expect(Math.abs(before!.length - after!.length)).toBeLessThanOrEqual(1)
  })
})
