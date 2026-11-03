/**
 * #1242: lifelines were drawn straight through message labels and block
 * titles, and a stick-figure actor's label sat on the first message arrow.
 * The visual suite's tolerance can't see either, so assert the geometry.
 */
import { describe, it, expect } from 'vitest'
import { parseSequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import { layoutSequenceDiagram } from '../sequence/layout.ts'

function lifelineSegments(
  svg: string,
  actor: string,
): Array<{ x: number; y1: number; y2: number }> {
  const out: Array<{ x: number; y1: number; y2: number }> = []
  const re =
    /<line class="lifeline" data-actor="([^"]*)" x1="([\d.]+)" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/g
  for (const m of svg.matchAll(re)) {
    if (m[1] !== actor) continue
    out.push({ x: Number(m[2]), y1: Number(m[3]), y2: Number(m[4]) })
  }
  return out
}

/** Centre y of the `<text>` whose content is `label`. */
function textY(svg: string, label: string): number {
  for (const m of svg.matchAll(
    /<text [^>]*y="([\d.]+)"[^>]*>([^<]*)<\/text>/g,
  )) {
    if (m[2] === label) return Number(m[1])
  }
  return NaN
}

/** True when no lifeline segment of `actor` covers height `y`. */
function lifelineClearAt(svg: string, actor: string, y: number): boolean {
  return lifelineSegments(svg, actor).every((s) => y < s.y1 || y > s.y2)
}

describe('lifelines stay out of message labels (#1242)', () => {
  const svg = renderMermaidSVG(`sequenceDiagram
  participant A
  participant B
  participant C
  A->>B: first
  A->>C: label crossing the middle lifeline
  A->>B: next`)

  it('cuts the crossed lifeline around the label instead of running through it', () => {
    const labelY = textY(svg, 'label crossing the middle lifeline')
    expect(lifelineSegments(svg, 'B').length).toBeGreaterThan(1)
    expect(lifelineClearAt(svg, 'B', labelY)).toBe(true)
  })

  it('leaves a lifeline whole where no label crosses it', () => {
    expect(lifelineSegments(svg, 'A')).toHaveLength(1)
  })

  it('cuts lifelines around a block title tab', () => {
    const blockSvg = renderMermaidSVG(`sequenceDiagram
  participant A
  participant B
  A->>B: hi
  alt Multiple panels
    B->>A: yes
  end`)
    // The tab sits at the block's top-left; the lifeline under it is cut.
    const rect = blockSvg.match(
      /<g class="block"[^>]*>\s*<rect x="([\d.]+)" y="([\d.]+)"/,
    )
    const blockY = Number(rect?.[2])
    expect(lifelineSegments(blockSvg, 'A').length).toBeGreaterThan(1)
    expect(lifelineClearAt(blockSvg, 'A', blockY + 9)).toBe(true)
  })

  it('widens the gap so a self-message label clears the next lifeline', () => {
    const selfSvg = renderMermaidSVG(`sequenceDiagram
  participant A
  participant B
  A->>A: a much longer self message label that would cross B if it were not centred
  A->>B: after`)
    const [a] = lifelineSegments(selfSvg, 'A')
    const [b] = lifelineSegments(selfSvg, 'B')
    // Nothing needed cutting: the label fits before B.
    expect(lifelineSegments(selfSvg, 'B')).toHaveLength(1)
    expect(b!.x - a!.x).toBeGreaterThan(140)
  })

  it('centres a self-message label on its lifeline, above the loop (#2456)', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
  participant A
  participant B
  A->>B: hi
  B->>B: a long self message label here
  A->>B: short
  C->>C: left edge label that is quite long indeed`)
    const g = svg.match(
      /<g class="message"[^>]*data-from="B" data-to="B"[\s\S]*?<\/g>/,
    )![0]
    const lifeX = lifelineSegments(svg, 'B')[0]!.x
    const loopY = Number(g.match(/<path d="M [\d.]+,([\d.]+)/)![1])
    expect(g).toContain('text-anchor="middle"')
    expect(Number(g.match(/<text x="([\d.]+)"/)![1])).toBeCloseTo(lifeX, 0)
    expect(Number(g.match(/<text[^>]* y="([\d.]+)"/)![1])).toBeLessThan(loopY)
    // A first-actor self label spills left of the lifeline without being clipped.
    const first = renderMermaidSVG(`sequenceDiagram
  A->>A: a very long self message label on the first actor`)
    const t = first.match(
      /<text x="([\d.]+)"[^>]*text-anchor="middle"[^>]*>[^<]*self message/,
    )
    expect(t).not.toBeNull()
    expect(
      Number(first.match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+)/)![1]),
    ).toBeGreaterThan(Number(t![1]))
  })

  it("draws the self-message as mermaid 12.2.0's cubic loop and lets the lifeline run through its label (#2477)", () => {
    const svg = renderMermaidSVG(`sequenceDiagram
  participant A
  participant B
  A->>A: think
  A->>B: hi`)
    // Mermaid: M x,y C x+60,y-10 x+60,y+30 x,y+20 (60 control offset, 20 high)
    const m = svg
      .match(
        /<path d="M ([\d.]+),([\d.]+) C ([\d.]+),([\d.]+) ([\d.]+),([\d.]+) ([\d.]+),([\d.]+)"/,
      )!
      .slice(1)
      .map(Number) as number[]
    const [x, y, c1x, c1y, c2x, c2y, ex, ey] = m as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ]
    expect([c1x - x, c1y - y, c2x - x, c2y - y, ex - x, ey - y]).toEqual([
      60, -10, 60, 30, 0, 20,
    ])
    // The lifeline is whole: nothing is cut around "think"
    expect(lifelineSegments(svg, 'A')).toHaveLength(1)
  })

  it('keeps a last-actor self label inside the viewBox and widens the gap to its left (#2456)', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
  participant A
  participant B
  B->>B: a very long self message label on the last actor to widen things
  B->>B`)
    const [a] = lifelineSegments(svg, 'A')
    const [b] = lifelineSegments(svg, 'B')
    expect(b!.x - a!.x).toBeGreaterThan(140)
    const t = svg.match(
      /<text x="([\d.]+)"[^>]*text-anchor="middle"[^>]*>[^<]*last actor/,
    )
    expect(
      Number(svg.match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+)/)![1]),
    ).toBeGreaterThan(Number(t![1]))
  })

  it('widens the gap for a label between adjacent actors', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
  A->>B: a message label far wider than the default gap between two actors
  B->>B: ok`)
    const [a] = lifelineSegments(svg, 'A')
    const [b] = lifelineSegments(svg, 'B')
    expect(b!.x - a!.x).toBeGreaterThan(300)
  })

  it('leaves the gap alone for a self-message on the last actor', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
  participant A
  participant B
  B->>B: only the last actor has a neighbour to its left`)
    const [a] = lifelineSegments(svg, 'A')
    const [b] = lifelineSegments(svg, 'B')
    expect(b!.x - a!.x).toBe(140)
  })

  it('ignores a message with no label when fitting gaps', () => {
    const d = parseSequenceDiagram([
      { text: 'participant A', line: 0 },
      { text: 'participant B', line: 1 },
      { text: 'A->>B: placeholder', line: 2 },
    ])
    d.messages[0]!.label = ''
    const [a, b] = layoutSequenceDiagram(d).actors
    expect(b!.x - a!.x).toBe(140)
  })

  it('cuts lifelines around a bare divider label', () => {
    const divSvg = renderMermaidSVG(`sequenceDiagram
  participant A
  participant B
  alt first
    A->>B: x
  else other case
    B->>A: y
  end`)
    const y = textY(divSvg, '[other case]')
    expect(lifelineSegments(divSvg, 'A').length).toBeGreaterThan(1)
    expect(lifelineClearAt(divSvg, 'A', y)).toBe(true)
  })

  it('ignores unlabeled blocks and dividers', () => {
    const bareSvg = renderMermaidSVG(`sequenceDiagram
  participant A
  participant B
  loop
    B->>A: ping
  else
    A->>B: pong
  end`)
    expect(lifelineSegments(bareSvg, 'A').length).toBeGreaterThan(0)
    expect(lifelineSegments(bareSvg, 'B').length).toBeGreaterThan(0)
  })

  it('never drops a lifeline entirely, even under a label taller than it', () => {
    const lines = Array.from({ length: 8 }, (_, i) => `l${i}`).join('<br/>')
    const tall = renderMermaidSVG(`sequenceDiagram
  participant A
  participant B
  participant C
  A->>C: ${lines}`)
    // The label spans B's whole lifeline; B keeps one uncut line.
    expect(lifelineSegments(tall, 'B')).toHaveLength(1)
  })
})

describe('stick-figure actor label clears the first message (#1242)', () => {
  const src = `sequenceDiagram
  actor U as User
  participant S as System
  U->>S: Click button`
  const svg = renderMermaidSVG(src)
  const layout = layoutSequenceDiagram(
    parseSequenceDiagram(
      src
        .split('\n')
        .slice(1)
        .map((text, line) => ({ text: text.trim(), line })),
    ),
  )

  it('starts the actor lifeline below its label', () => {
    const [seg] = lifelineSegments(svg, 'U')
    expect(seg!.y1).toBeGreaterThan(textY(svg, 'User') + 6)
  })

  it('places the first message arrow clear of the label', () => {
    const first = layout.messages[0]!
    // Label is 13px-ish text centred at textY; arrow must be well below it
    expect(first.y).toBeGreaterThan(textY(svg, 'User') + 16)
  })

  it('keeps the original compact header when no stick figure is used', () => {
    const plain = layoutSequenceDiagram(
      parseSequenceDiagram([
        { text: 'participant A', line: 0 },
        { text: 'participant B', line: 1 },
        { text: 'A->>B: hi', line: 2 },
      ]),
    )
    expect(plain.messages[0]!.y - (plain.actors[0]!.y + 40)).toBe(20)
  })
})
