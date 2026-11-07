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
})
