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
  const re = new RegExp(
    `<line class="lifeline" data-actor="${actor}" x1="([\\d.]+)" y1="([\\d.]+)" x2="[\\d.]+" y2="([\\d.]+)"`,
    'g',
  )
  for (const m of svg.matchAll(re)) {
    out.push({ x: Number(m[1]), y1: Number(m[2]), y2: Number(m[3]) })
  }
  return out
}

/** Centre y of the `<text>` whose content is `label`. */
function textY(svg: string, label: string): number {
  const m = svg.match(
    new RegExp(`<text [^>]*y="([\\d.]+)"[^>]*>${label}</text>`),
  )
  return Number(m?.[1])
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
    const segments = lifelineSegments(svg, 'B')
    expect(segments.length).toBeGreaterThan(1)
    for (const s of segments) {
      expect(labelY >= s.y1 && labelY <= s.y2).toBe(false)
    }
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
    const segments = lifelineSegments(blockSvg, 'A')
    for (const s of segments) {
      expect(blockY + 9 >= s.y1 && blockY + 9 <= s.y2).toBe(false)
    }
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
