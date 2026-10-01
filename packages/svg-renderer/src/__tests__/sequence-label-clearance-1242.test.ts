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

  it('cuts a lifeline beside a self-message label', () => {
    const selfSvg = renderMermaidSVG(`sequenceDiagram
  participant A
  participant B
  A->>A: a long self message label crossing B
  A->>B: after`)
    const y = textY(selfSvg, 'a long self message label crossing B')
    expect(lifelineSegments(selfSvg, 'B').length).toBeGreaterThan(1)
    expect(lifelineClearAt(selfSvg, 'B', y)).toBe(true)
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
    // label is 13px-ish text centred at textY; arrow must be well below it
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
