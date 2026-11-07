/**
 * #2777 stick-figure size and label gap, #2778 destroying self-message and
 * destroyed `actor` footer: sequence SVG parity with Mermaid 12.3.0.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

const svg = (src: string) => renderMermaidSVG('sequenceDiagram\n' + src)
const num = (re: RegExp, s: string): number => Number(re.exec(s)![1])

describe('actor stick figure (#2777)', () => {
  it('is 44px tall with head radius 10.15 and the label 15px below it', () => {
    const out = svg('actor A as Alice\nA->>A: x')
    const g = /<g class="actor" data-id="A"[^>]*>([\s\S]*?)<\/g>/.exec(out)![1]!
    const r = num(/<circle[^>]* r="([\d.]+)"/, g)
    const cy = num(/<circle[^>]* cy="([\d.]+)"/, g)
    const legY = num(/L[\d.]+ [\d.]+L[\d.]+ ([\d.]+)"/, g)
    const labelY = num(/<text[^>]* y="([\d.]+)"/, g)
    expect(r).toBeCloseTo(10.15, 2)
    // Head top to feet = 44; label centre sits 15 below the feet
    expect(legY - (cy - r)).toBeCloseTo(44, 1)
    expect(labelY - legY).toBeCloseTo(15, 1)
  })
})

describe('destroy (#2778)', () => {
  it('draws a destroying self-message as a straight line to the lifeline', () => {
    const out = svg('participant A\nA->>A: hi\ndestroy A\nA->>A: bye')
    const m =
      /data-label="bye"[^>]*data-self="(\w+)"[^>]*>\s*<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)"/.exec(
        out,
      )!
    expect(m[1]).toBe('false')
    expect(Number(m[2])).toBeLessThan(Number(m[4]))
    const y = Number(m[3])
    const footer =
      /class="actor-footer"[^>]*>\s*<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/.exec(
        out,
      )!
    expect(Number(footer[1]) + Number(footer[2]) / 2).toBeCloseTo(y, 1)
  })

  it('keeps the loop for a non-destroying self-message', () => {
    expect(svg('A->>A: hi')).toMatch(/data-self="true"/)
  })

  it('centres a destroyed actor footer figure on the destroying message', () => {
    const out = svg('actor A\nactor B\nA->>B: hi\ndestroy B\nB-->>A: bye')
    const y = num(
      /data-label="bye"[^>]*>\s*<line x1="[\d.]+" y1="([\d.]+)"/,
      out,
    )
    const g = /<g class="actor-footer" data-id="B"[^>]*>([\s\S]*?)<\/g>/.exec(
      out,
    )![1]!
    const cy = num(/<circle[^>]* cy="([\d.]+)"/, g)
    // Slot is 44 tall: its centre is 22 below the head top (cy - r)
    expect(cy - 10.15 + 22).toBeCloseTo(y, 1)
  })

  it('starts a destroyed sender arrow outside its footer and stops a destroyed recipient arrow short of it', () => {
    const arrow = (out: string): number[] =>
      /data-label="bye"[^>]*>\s*<line x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)"/
        .exec(out)!
        .slice(1, 3)
        .map(Number)
    // Participant lifelines sit 140 apart (centres 70 and 210), boxes 80 wide
    const sent = svg(
      'participant A\nparticipant B\nA->>B: hi\ndestroy B\nB->>A: bye',
    )
    const [x1] = arrow(sent)
    expect(x1).toBeCloseTo(210 - 41, 0)
    const recv = svg(
      'participant A\nparticipant B\nA->>B: hi\ndestroy B\nA->>B: bye',
    )
    const [, x2] = arrow(recv)
    expect(x2).toBeCloseTo(210 - 48, 0)
    const actor = svg('actor A\nactor B\nA->>B: hi\ndestroy B\nA->>B: bye')
    expect(arrow(actor)[1]).toBeCloseTo(210 - 26, 0)
  })

  it('keeps the loop and plain arrows without mirrored footers', () => {
    const out = renderMermaidSVG(
      '%%{init: {"sequence": {"mirrorActors": false}}}%%\nsequenceDiagram\nactor A\nA->>A: hi\ndestroy A\nA->>A: bye',
    )
    expect(out).not.toContain('actor-footer')
    expect(out).toMatch(/data-label="bye"[^>]*data-self="true"/)
  })

  it('draws a created-then-destroyed actor's reply arrow leftwards', () => {
    const out = svg(
      'participant A\ncreate actor B\nA->>B: hi\ndestroy B\nB->>A: bye',
    )
    const m =
      /data-label="bye"[^>]*>\s*<line x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)"/.exec(
        out,
      )!
    expect(Number(m[1]) - Number(m[2])).toBeGreaterThan(0)
    expect(out).toContain('data-type="actor"')
  })
})
