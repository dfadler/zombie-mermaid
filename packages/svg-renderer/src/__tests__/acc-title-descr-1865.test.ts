/**
 * `accTitle` / `accDescr` on every diagram type (#1865): the front door reads
 * them once and `svgOpenTag` emits <title>/<desc> + aria-labelledby/
 * aria-describedby (WCAG 1.1.1 / 4.1.2; see docs/accessibility.md).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, validateMermaid } from '@zombie-mermaid/svg-renderer'

const BODIES: Record<string, string> = {
  flowchart: 'graph LR\n  A --> B',
  state: 'stateDiagram-v2\n  [*] --> A',
  sequence: 'sequenceDiagram\n  A->>B: hi',
  class: 'classDiagram\n  Animal <|-- Dog',
  er: 'erDiagram\n  A ||--o{ B : has',
  xychart: 'xychart-beta\n  line [1, 2, 3]',
  architecture:
    'architecture-beta\n  service a(server)[A]\n  service b(server)[B]\n  a:R -- L:b',
  c4: 'C4Context\n  Person(u, "User")\n  System(s, "System")\n  Rel(u, s, "uses")',
  pie: 'pie\n  "Yes" : 70\n  "No" : 30',
}

/** Insert the acc statements right after the header line. */
function withAcc(body: string, acc: string): string {
  const [header, ...rest] = body.split('\n')
  return [header, acc, ...rest].join('\n')
}

const ACC = '  accTitle: Big <Decisions>\n  accDescr: How we decide'

describe.each(Object.entries(BODIES))('%s', (_type, body) => {
  const svg = renderMermaidSVG(withAcc(body, ACC))

  it('names and describes the root from accTitle / accDescr', () => {
    expect(svg).toMatch(/<svg [^>]*aria-labelledby="zm-title-\d+"/)
    expect(svg).toMatch(/<svg [^>]*aria-describedby="zm-desc-\d+"/)
    expect(svg).toMatch(
      /<title id="zm-title-\d+">Big &lt;Decisions&gt;<\/title>/,
    )
    expect(svg).toMatch(/<desc id="zm-desc-\d+">How we decide<\/desc>/)
  })

  it('does not draw the statements as diagram text', () => {
    expect(svg).not.toContain('accTitle')
    expect(svg).not.toContain('accDescr')
  })

  it('lets the title option win and keeps accDescr', () => {
    const named = renderMermaidSVG(withAcc(body, ACC), { title: 'Opt' })
    expect(named).toMatch(/<title id="[^"]+">Opt<\/title>/)
    expect(named).not.toContain('Big &lt;Decisions')
    expect(named).toContain('How we decide')
  })

  it('drops both when decorative', () => {
    const deco = renderMermaidSVG(withAcc(body, ACC), { decorative: true })
    expect(deco).toContain('aria-hidden="true"')
    expect(deco).not.toContain('<desc')
  })

  it('keeps ids unique across renders (#1405)', () => {
    const ids = [svg, renderMermaidSVG(withAcc(body, ACC))].flatMap(
      (s) => s.match(/id="zm-(?:title|desc)-\d+"/g) ?? [],
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('accepts the multi-line block, indentation and comments', () => {
    const src = withAcc(
      body,
      '    accTitle: T %% a comment\n    accDescr {\n      line one\n\n      line two\n    }\n  %% note',
    )
    expect(() => validateMermaid(src)).not.toThrow()
    const out = renderMermaidSVG(src)
    expect(out).toMatch(/<title id="[^"]+">T<\/title>/)
    expect(out).toMatch(/<desc id="[^"]+">line one\nline two<\/desc>/)
  })
})

it('adds no root name without the statements', () => {
  expect(renderMermaidSVG(BODIES.flowchart!)).not.toContain('<title id=')
})
