/**
 * Smoke tests for `renderMermaidSVG` — the "Mermaid text in, SVG out" front
 * door moved into this package under #1111, for parity with
 * `@zombie-mermaid/ascii-renderer`'s `renderMermaidASCII`. The umbrella's own
 * extensive `src/__tests__/*` suite already exercises this function
 * end-to-end (through the re-export in `src/index.ts`), so this file only
 * checks what's specific to *this* package: every registered diagram type
 * dispatches to real SVG output through `./registry.ts`'s `diagramRegistry`
 * when called directly from `@zombie-mermaid/svg-renderer`, not just via the
 * umbrella.
 */
import { describe, it, expect } from 'vitest'
import {
  renderMermaidSVG,
  renderMermaidSVGAsync,
  renderMermaidSync,
  renderMermaid,
  themeCssVariables,
} from '@zombie-mermaid/svg-renderer'

describe('renderMermaidSVG', () => {
  it.each([
    ['flowchart', 'graph TD\n  A --> B'],
    ['state', 'stateDiagram-v2\n  [*] --> A'],
    ['sequence', 'sequenceDiagram\n  A->>B: hi'],
    ['class', 'classDiagram\n  Animal <|-- Dog'],
    ['er', 'erDiagram\n  A ||--o{ B : has'],
    ['xychart', 'xychart-beta\n  line [1, 2, 3]'],
  ])('renders a %s diagram to an SVG string', (_label, source) => {
    const svg = renderMermaidSVG(source)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('embeds the original source when embedSource is set', () => {
    const svg = renderMermaidSVG('graph TD\n  A --> B', { embedSource: true })
    expect(svg).toContain('data-src=')
  })
})

describe('renderMermaidSVGAsync', () => {
  it('resolves to the same output as the sync render', async () => {
    const source = 'graph TD\n  A --> B'
    expect(await renderMermaidSVGAsync(source)).toBe(renderMermaidSVG(source))
  })
})

describe('themeCssVariables', () => {
  it('includes the resolved --bg/--fg custom properties', () => {
    const css = themeCssVariables({ bg: '#111111', fg: '#eeeeee' })
    expect(css).toContain('--bg:#111111')
    expect(css).toContain('--fg:#eeeeee')
  })
})

describe('deprecated aliases', () => {
  it('renderMermaidSync matches renderMermaidSVG', () => {
    expect(renderMermaidSync).toBe(renderMermaidSVG)
  })

  it('renderMermaid matches renderMermaidSVGAsync', () => {
    expect(renderMermaid).toBe(renderMermaidSVGAsync)
  })
})
