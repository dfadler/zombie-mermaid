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
    expect(outerLeft - left).toBeGreaterThan(0)
    expect(outerLeft - left).toBeLessThanOrEqual(20)
    expect(right - outerRight).toBeCloseTo(outerLeft - left, 1)
  })

  it('SVG: divider labels are centred on the frame, the header label right of the tab', () => {
    const centre = (left + right) / 2
    const tab =
      /<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)"[^>]*group-hdr/.exec(svg)!
    const header = new RegExp(
      '<text[^>]*>\\[Establish connection\\]</text>',
    ).exec(svg)![0]
    expect(num(header, 'x')).toBeCloseTo((left + Number(tab[1]) + right) / 2, 1)
    for (const label of ['Network timeout', 'Credentials denied']) {
      const tag = new RegExp(`<text[^>]*>\\[${label}\\]</text>`).exec(svg)![0]
      expect(num(tag, 'x')).toBeCloseTo(centre, 1)
    }
  })

  it('SVG: a divider label sits on its own row above the message label', () => {
    const rows = (text: string) =>
      num(new RegExp(`<text[^>]*>${text}</text>`).exec(svg)![0], 'y')
    expect(
      rows('retry') - rows('\\[Network timeout\\]'),
    ).toBeGreaterThanOrEqual(11)
    expect(
      rows('abort') - rows('\\[Credentials denied\\]'),
    ).toBeGreaterThanOrEqual(11)
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
