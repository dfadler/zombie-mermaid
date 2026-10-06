/**
 * Mermaid entity codes (#quot; #lt; #35; #x5B;) in labels, and HTML entities
 * in ASCII labels. Ported in spirit from lukilabs/beautiful-mermaid#158
 * (thiccyoda), reimplemented per label with a code point guard.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import {
  decodeMermaidEntities,
  decodeXmlEntitiesInLabel,
} from '@zombie-mermaid/core'
import { renderMermaidSVG, renderMermaidASCII } from '../index.ts'

describe('Mermaid entity codes', () => {
  it('decodes named and numeric codes in labels', () => {
    const g = parseMermaid(
      'flowchart LR\n  A["say #quot;hi#quot; #lt;x#gt; #35;9 #x5B;y#x5D;"]',
    )
    expect(g.nodes.get('A')!.label).toBe('say "hi" <x> #9 [y]')
  })

  it('leaves unknown codes alone', () => {
    const g = parseMermaid('flowchart LR\n  A["#nope; ok"]')
    expect(g.nodes.get('A')!.label).toBe('#nope; ok')
  })

  it('decodes edge labels, so SVG output no longer prints the raw code', () => {
    const svg = renderMermaidSVG('flowchart LR\n  A -->|#quot;go#quot;| B')
    expect(svg).not.toContain('#quot;')
    expect(svg).toContain('&quot;go&quot;')
  })

  it('does not throw on out-of-range or invalid code points', () => {
    for (const bad of ['#99999999;', '#x110000;', '#0;', '#xD800;']) {
      expect(decodeMermaidEntities(bad)).toBe(bad)
    }
    const g = parseMermaid('flowchart LR\n  A["a #99999999; b"]')
    expect(g.nodes.get('A')!.label).toBe('a #99999999; b')
  })

  it('does not touch #rrggbb; colors in style lines', () => {
    const g = parseMermaid(
      'flowchart LR\n  A --> B\n  style A fill:#123;,stroke:#ff0000;',
    )
    // #123; is a valid numeric code, so decoding the whole source would turn it into "{"
    expect(g.nodeStyles.get('A')).toEqual({ fill: '#123;', stroke: '#ff0000' })
  })

  it('keeps decoded syntax characters as label text instead of re-parsing', () => {
    const g = parseMermaid('flowchart LR\n  A["x #x5D;--> B#x5B;"]')
    expect(g.nodes.has('B')).toBe(false)
    expect(g.nodes.get('A')!.label).toBe('x ]--> B[')
  })
})

describe('ASCII entity decoding', () => {
  it('decodes HTML entities in ASCII labels as SVG does', () => {
    const out = renderMermaidASCII(
      'flowchart LR\n  A["&quot;q&quot; &lt;y&gt;"]',
      { colorMode: 'none' },
    )
    expect(out).toContain('"q" <y>')
  })

  it('decodes Mermaid codes in ASCII labels', () => {
    const out = renderMermaidASCII(
      'flowchart LR\n  A["#quot;q#quot; #lt;y#gt;"]',
      { colorMode: 'none' },
    )
    expect(out).toContain('"q" <y>')
  })

  it('decodes once: &amp;lt; stays a literal &lt;', () => {
    const out = renderMermaidASCII('flowchart LR\n  A["&amp;lt;"]', {
      colorMode: 'none',
    })
    expect(out).toContain('&lt;')
  })

  it('decodes edge labels in ASCII output', () => {
    const out = renderMermaidASCII('flowchart LR\n  A -->|&quot;go&quot;| B', {
      colorMode: 'none',
    })
    expect(out).toContain('"go"')
    expect(out).not.toContain('&quot;')
  })

  it('decodes subgraph labels, including nested ones', () => {
    const out = renderMermaidASCII(
      'flowchart TD\n  subgraph O["&lt;outer&gt;"]\n    subgraph I["&quot;inner&quot;"]\n      A\n    end\n  end',
      { colorMode: 'none' },
    )
    expect(out).toContain('<outer>')
    expect(out).toContain('"inner"')
    expect(out).not.toContain('&lt;')
    expect(out).not.toContain('&quot;')
  })

  it('decodes numeric and hex HTML entities', () => {
    expect(decodeXmlEntitiesInLabel('&#35;9 &#x5B;y&#X5d; &apos;')).toBe(
      "#9 [y] '",
    )
  })

  it('leaves invalid numeric HTML entities untouched', () => {
    for (const bad of ['&#99999999;', '&#x110000;', '&#0;', '&#xD800;']) {
      expect(decodeXmlEntitiesInLabel(bad)).toBe(bad)
    }
  })

  it('decodes an uppercase X hex marker in Mermaid codes', () => {
    expect(decodeMermaidEntities('#X5B;y#X5d;')).toBe('[y]')
  })
})
