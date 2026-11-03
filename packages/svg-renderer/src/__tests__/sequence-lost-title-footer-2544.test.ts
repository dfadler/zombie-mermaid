/**
 * #2544 lost-message cross, #2545 activation bars vs block tabs, #2546 title
 * line, #2559 mirrored footer actors: sequence SVG parity with Mermaid 12.3.0.
 */
import { describe, it, expect } from 'vitest'
import { parseSequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutSequenceDiagram } from '../sequence/layout.ts'
import { renderMermaidSVG } from '../index.ts'

const parse = (src: string) =>
  parseSequenceDiagram(
    ('sequenceDiagram\n' + src)
      .split('\n')
      .map((text, line) => ({ text: text.trim(), line })),
  )
const layout = (src: string) => layoutSequenceDiagram(parse(src))
const svg = (src: string) => renderMermaidSVG('sequenceDiagram\n' + src)

describe('lost message cross (#2544)', () => {
  it('ends -x and --x in the cross marker, other arrows keep theirs', () => {
    const out = svg('A-xB: a\nA--xB: b\nA->>B: c')
    expect(out).toMatch(/id="[\w]+-seq-lost"/)
    const ends = [
      ...out.matchAll(/marker-end="url\(#\w+-(seq-[\w-]+)\)"/g),
    ].map((m) => m[1])
    expect(ends).toEqual(['seq-lost', 'seq-lost', 'seq-arrow'])
    expect(out.match(/data-lost="true"/g)).toHaveLength(2)
  })

  it('keeps the open arrowhead for -) beside a cross', () => {
    const ends = [
      ...svg('A-)B: a\nA-xB: b').matchAll(
        /marker-end="url\(#\w+-(seq-[\w-]+)\)"/g,
      ),
    ].map((m) => m[1])
    expect(ends).toEqual(['seq-arrow-open', 'seq-lost'])
  })

  it('carries isLost onto the positioned message', () => {
    const l = layout('A-xB: a\nA->>B: b')
    expect(l.messages.map((m) => m.isLost)).toEqual([true, undefined])
  })
})

describe('framed blocks paint over activation bars (#2545)', () => {
  const src =
    'participant A\nparticipant B\nB->>+A: go\npar one\nA->>B: x\nand two\nA->>B: y\nend\nA-->>-B: done'

  it('draws the block (and its tab) after the bar that crosses it', () => {
    const out = svg(src)
    expect(out.indexOf('class="block"')).toBeGreaterThan(
      out.indexOf('class="activation"'),
    )
  })

  it('keeps a rect highlight fill behind the bar', () => {
    const out = svg(
      'participant A\nparticipant B\nB->>+A: go\nrect rgb(0,255,0)\nA->>B: x\nend\nA-->>-B: done',
    )
    expect(out.indexOf('class="block"')).toBeLessThan(
      out.indexOf('class="activation"'),
    )
  })
})

describe('title line (#2546)', () => {
  it('parses `title X` and `title: X`, last one wins', () => {
    expect(parse('title Demo\nA->>B: x').title).toBe('Demo')
    expect(parse('title: One\ntitle Two\nA->>B: x').title).toBe('Two')
    expect(parse('A->>B: x').title).toBeUndefined()
  })

  it('draws it above the actors, centred, and widens a narrow diagram', () => {
    const plain = layout('A->>B: x')
    const l = layout('title A rather long diagram title indeed\nA->>B: x')
    expect(l.actors[0]!.y).toBeGreaterThan(plain.actors[0]!.y)
    expect(l.title!.y).toBeLessThan(l.actors[0]!.y)
    expect(l.width).toBeGreaterThan(plain.width)
    const out = svg('title Demo\nA->>B: x')
    expect(out).toMatch(/<g class="title">[\s\S]*Demo/)
    expect(svg('A->>B: x')).not.toContain('class="title"')
  })

  it('moves participant boxes down with the actors', () => {
    const l = layout('title T\nbox Aqua G\nparticipant A\nend\nA->>A: x')
    expect(l.boxes[0]!.y).toBeGreaterThan(l.title!.y)
  })
})

describe('mirrored footer actors (#2559)', () => {
  it('repeats every actor under the lifelines, below the last message', () => {
    const l = layout('A->>B: hi')
    expect(l.footerActors.map((a) => a.id)).toEqual(['A', 'B'])
    for (const a of l.footerActors) {
      expect(a.y).toBe(l.lifelines[0]!.bottomY)
      expect(a.y + a.height).toBeLessThan(l.height)
    }
    expect(l.footerActors[0]!.y).toBeGreaterThan(l.messages[0]!.y)
    expect(svg('A->>B: hi').match(/class="actor-footer"/g)).toHaveLength(2)
  })

  it('leaves room for a stick figure label below the footer icon', () => {
    const l = layout('actor U\nU->>U: x')
    const f = l.footerActors[0]!
    expect(l.height).toBeGreaterThan(f.y + f.height + 14)
  })

  it('gives a destroyed participant no footer, and boxes enclose footers', () => {
    const l = layout(
      'box Aqua G\nparticipant A\nparticipant C\nend\nA->>C: x\ndestroy C\nC->>A: y',
    )
    expect(l.footerActors.map((a) => a.id)).toEqual(['A'])
    const f = l.footerActors[0]!
    expect(l.boxes[0]!.y + l.boxes[0]!.height).toBeGreaterThan(f.y + f.height)
  })
})
