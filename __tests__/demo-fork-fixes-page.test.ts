/**
 * Unit coverage for demo/components/fork-fixes-page.tsx's own logic (#608
 * redesign) — the pieces the golden DOM test in site-equivalence.test.ts
 * exercises but doesn't pin down precisely: the light Mermaid syntax
 * highlighter, and FixPanel's per-kind rendering.
 *
 * fork-fixes.ts's own guarantees (the identical-pair build guard, the
 * real-terminal capture pipeline) are untouched by #608 and are not
 * re-tested here — see fork-fixes.ts's own header and
 * scripts/capture-fork-fixes-terminal.ts.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  FixPanel,
  tokenizeMermaidSource,
  type PanelContent,
} from '../demo/components/fork-fixes-page.tsx'

describe('tokenizeMermaidSource', () => {
  it('colours the opening diagram-type keyword, only on the first line', () => {
    const lines = tokenizeMermaidSource('flowchart LR\n  A --> B')
    expect(lines[0]?.[0]).toEqual({ text: 'flowchart', kind: 'keyword' })
    // "LR" is not a keyword — it stays plain text, matching the canvas.
    expect(lines[0]?.some((t) => t.text === 'LR' && t.kind === 'keyword')).toBe(
      false,
    )
  })

  it('does not colour a diagram-type word appearing after the first line', () => {
    // A node literally named "graph" should never be mistaken for the
    // diagram-type keyword — only line 0's leading word is checked.
    const lines = tokenizeMermaidSource('flowchart LR\n  graph --> B')
    expect(
      lines[1]?.some((t) => t.text === 'graph' && t.kind === 'keyword'),
    ).toBe(false)
  })

  it('colours connector tokens, longest match first', () => {
    const lines = tokenizeMermaidSource('flowchart LR\n  A --> B\n  B --- C')
    expect(lines[1]).toContainEqual({ text: '-->', kind: 'connector' })
    expect(lines[2]).toContainEqual({ text: '---', kind: 'connector' })
  })

  it('recognizes the class-diagram relationship connectors', () => {
    const lines = tokenizeMermaidSource(
      'classDiagram\n  A <|-- B\n  C *-- D\n  E o-- F\n  G ..> H\n  I ..|> J',
    )
    expect(lines[1]).toContainEqual({ text: '<|--', kind: 'connector' })
    expect(lines[2]).toContainEqual({ text: '*--', kind: 'connector' })
    expect(lines[3]).toContainEqual({ text: 'o--', kind: 'connector' })
    expect(lines[4]).toContainEqual({ text: '..>', kind: 'connector' })
    expect(lines[5]).toContainEqual({ text: '..|>', kind: 'connector' })
  })

  it('colours a bracket label as one token, including its brackets', () => {
    const lines = tokenizeMermaidSource('flowchart LR\n  A[Start] --> B[End]')
    expect(lines[1]).toContainEqual({ text: '[Start]', kind: 'label' })
    expect(lines[1]).toContainEqual({ text: '[End]', kind: 'label' })
  })

  it('keeps a bracket that contains a quoted string with its own inner brackets intact', () => {
    // The literal `quoted-brackets` fix source: the quoted text "test []
    // brackets" carries its own [] that must not close the outer bracket
    // early — a naive `\[.*?\]` regex would stop at that inner `]`.
    const lines = tokenizeMermaidSource(
      'flowchart LR\n  A["test [] brackets"] --> B["fine"]',
    )
    expect(lines[1]).toContainEqual({
      text: '["test [] brackets"]',
      kind: 'label',
    })
    expect(lines[1]).toContainEqual({ text: '["fine"]', kind: 'label' })
  })

  it('colours a pipe-delimited edge label', () => {
    const lines = tokenizeMermaidSource(
      'flowchart LR\n  A -->|Yes| B[Do thing]',
    )
    expect(lines[1]).toContainEqual({ text: '|Yes|', kind: 'label' })
  })

  it('colours a bare quoted string outside any bracket', () => {
    const lines = tokenizeMermaidSource(
      'erDiagram\n  CUSTOMER ||--o{ ORDER : "places an"',
    )
    expect(lines[1]).toContainEqual({ text: '"places an"', kind: 'label' })
  })

  it('falls back to plain text for a connector it does not recognize, without throwing', () => {
    // ER crow's-foot notation isn't in the recognized connector list; the
    // highlighter must degrade gracefully rather than mis-tokenize or throw.
    const lines = tokenizeMermaidSource(
      'erDiagram\n  TAG }o--|| PRODUCT : labels',
    )
    expect(() => lines).not.toThrow()
    const rebuilt = lines.map((line) => line.map((t) => t.text).join(''))
    expect(rebuilt.join('\n')).toBe('erDiagram\n  TAG }o--|| PRODUCT : labels')
  })

  it('round-trips every token back to the original line for a representative mixed source', () => {
    const source =
      'flowchart TD\n  A(Start) --> B{Is it sunny?}\n  B -- Yes --> C[Go to the park]\n  B ~~~ D'
    const lines = tokenizeMermaidSource(source)
    const rebuilt = lines.map((line) => line.map((t) => t.text).join(''))
    expect(rebuilt.join('\n')).toBe(source)
  })

  it('produces one line of tokens per input line', () => {
    const lines = tokenizeMermaidSource('flowchart TD\n  A --> B\n  B --> C')
    expect(lines).toHaveLength(3)
  })
})

/** Renders FixPanel to static markup with a fixed side accent, mirroring how fork-fixes-page.tsx's BeforeAfterPanel calls it. */
function renderPanel(
  content: PanelContent,
  accent: 'amber' | 'green' = 'amber',
) {
  return renderToStaticMarkup(createElement(FixPanel, { content, accent }))
}

describe('FixPanel', () => {
  it('renders an error with the side accent colour and the message', () => {
    const html = renderPanel({ kind: 'error', message: 'boom' }, 'amber')
    expect(html).toContain('<strong>Threw:</strong>')
    expect(html).toContain('boom')
    expect(html).toContain('color:var(--amber)')
  })

  it('uses the green accent for an after-side error', () => {
    const html = renderPanel({ kind: 'error', message: 'boom' }, 'green')
    expect(html).toContain('color:var(--green)')
  })

  it('renders the empty-output note', () => {
    const html = renderPanel({ kind: 'empty' })
    expect(html).toContain('Rendered nothing')
  })

  it('renders an excerpt verbatim inside a <pre class="fix-ascii">', () => {
    const html = renderPanel({
      kind: 'excerpt',
      text: '<marker id="x"></marker>',
    })
    expect(html).toContain('class="fix-ascii mono"')
    // React text-escapes the excerpt content (it's a child, not raw HTML).
    expect(html).toContain('&lt;marker id=&quot;x&quot;&gt;&lt;/marker&gt;')
  })

  it('renders a screenshot as a plain, full-width <img>', () => {
    const html = renderPanel({
      kind: 'screenshot',
      file: 'foo-before.png',
      side: 'before',
      fixId: 'foo',
    })
    expect(html).toContain('src="fork-fixes-screenshots/foo-before.png"')
    expect(html).toContain('width:100%')
    expect(html).not.toContain('padding') // no inset frame around a terminal screenshot
  })

  it('injects ascii-html.ts output verbatim inside a <pre class="fix-ascii">', () => {
    const html = renderPanel({
      kind: 'ascii',
      html: '<span class="fix-wide" style="width:2ch">日</span>',
    })
    expect(html).toContain('class="fix-ascii mono"')
    expect(html).toContain('<span class="fix-wide" style="width:2ch">日</span>')
  })

  it('injects rendered SVG verbatim inside a <div class="fix-svg">', () => {
    const html = renderPanel({ kind: 'svg', html: '<svg data-x="1"></svg>' })
    expect(html).toContain('class="fix-svg"')
    expect(html).toContain('<svg data-x="1"></svg>')
  })
})
