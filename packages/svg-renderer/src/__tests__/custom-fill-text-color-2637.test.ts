import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

// Mermaid 12.3.0 emits no text color for a node with only a custom `fill`
// (flowchart, class, state, ER alike) and honours an explicit `color:`.
// The fork used to pick black/white from the fill's luminance (#55); that
// was removed to match Mermaid (#2637).
const textFills = (svg: string): string[] =>
  [...svg.matchAll(/<text\b[^>]*\bfill="([^"]*)"/g)].map((m) => m[1]!)

describe('text color on a custom fill (#2637)', () => {
  it.each([
    ['flowchart', 'flowchart LR\n  A[x]\n  style A fill:#1e293b'],
    ['state', 'stateDiagram-v2\n  [*] --> S1\n  style S1 fill:#1e293b'],
    ['er', 'erDiagram\n  A { string x }\n  style A fill:#1e293b'],
  ])('%s: keeps theme text, never black/white from the fill', (_n, src) => {
    const fills = textFills(renderMermaidSVG(src))
    expect(fills.length).toBeGreaterThan(0)
    expect(fills).not.toContain('#FFFFFF')
    expect(fills).not.toContain('#000000')
  })

  it.each([
    ['flowchart', 'flowchart LR\n  A[x]\n  style A fill:#1e293b,color:#ff0000'],
    [
      'state',
      'stateDiagram-v2\n  [*] --> S1\n  style S1 fill:#1e293b,color:#ff0000',
    ],
    ['er', 'erDiagram\n  A { string x }\n  style A fill:#1e293b,color:#ff0000'],
  ])('%s: an explicit color still wins', (_n, src) => {
    expect(textFills(renderMermaidSVG(src))).toContain('#ff0000')
  })
})
