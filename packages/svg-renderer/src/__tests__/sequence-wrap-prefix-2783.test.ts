// `wrap:` / `nowrap:` prefixes (#2783) and mid-word splitting of over-long
// block label words (#2773), checked on mermaid@12.3.0.
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

const L =
  'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron'
// Drawn text only (the SVG also repeats labels in its description).
const count = (svg: string, s: string) =>
  (svg.match(/<text[\s\S]*?<\/text>/g) ?? []).join('\n').split(s).length - 1

describe('sequence wrap:/nowrap: prefixes (#2783)', () => {
  it('wrap: wraps that message only; the prefix is not drawn', () => {
    const svg = renderMermaidSVG(
      `sequenceDiagram\n A->>B: wrap: ${L}\n B->>A: ${L}`,
    )
    expect(svg).not.toContain('wrap:')
    expect(count(svg, L)).toBe(1) // Only the unprefixed one stays whole
    expect(count(svg, 'alpha beta gamma')).toBe(2)
  })
  it('nowrap: overrides init wrap:true', () => {
    const svg = renderMermaidSVG(
      `%%{init: {"sequence": {"wrap": true}}}%%\nsequenceDiagram\n A->>B: nowrap: ${L}\n B->>A: ${L}`,
    )
    expect(svg).not.toContain('nowrap')
    expect(count(svg, L)).toBe(1)
  })
})

describe('note wrap prefixes (#2783)', () => {
  const init = '%%{init: {"sequence": {"wrap": true}}}%%\n'
  it('nowrap: keeps one note whole under init wrap, wrap: wraps one without it', () => {
    const a = renderMermaidSVG(
      `${init}sequenceDiagram\n A->>B: x\n Note over A: nowrap: ${L}\n Note over B: ${L}`,
    )
    expect(count(a, L)).toBe(1)
    const b = renderMermaidSVG(
      `sequenceDiagram\n A->>B: x\n Note over A: ${L}\n Note over B: wrap: ${L}`,
    )
    expect(count(b, L)).toBe(1)
  })
})

describe('long block label word (#2773)', () => {
  it('splits mid-word with a hyphen like mermaid 12.3.0', () => {
    const svg = renderMermaidSVG(
      'sequenceDiagram\n participant A\n participant B\n alt Supercalifragilisticexpialidocious_and_pneumonoultramicroscopicsilicovolcanoconiosis\n A->>B: hi\n end',
    )
    expect(svg).toMatch(/Supercalifragilistic\w*-/)
    expect(svg).toContain('coniosis]')
  })
})
