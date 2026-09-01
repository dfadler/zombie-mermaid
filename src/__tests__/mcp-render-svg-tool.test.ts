import { describe, it, expect, vi } from 'vitest'
import {
  renderSvgHandler,
  renderSvgInputShape,
} from '../mcp/tools/render-svg.ts'
import { THEMES } from '../theme.ts'
import { renderMermaidSVG } from '../index.ts'

// ============================================================================
// renderMermaidSVG is wrapped (not fully replaced) so every test above still
// exercises the real renderer — only the one test below that needs a
// non-Error throw (impossible to provoke from real Mermaid source, since the
// renderer only ever throws Error instances) overrides it per-call.
// ============================================================================
vi.mock('../index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../index.ts')>()
  return { ...actual, renderMermaidSVG: vi.fn(actual.renderMermaidSVG) }
})

describe('renderSvgHandler', () => {
  it('renders a valid diagram to an SVG string', () => {
    const result = renderSvgHandler({ diagram: 'graph LR\n  A --> B' })
    expect(result.isError).toBeUndefined()
    expect(result.content).toHaveLength(1)
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(content.text).toContain('<svg')
    expect(content.text).toContain('A')
    expect(content.text).toContain('B')
  })

  it('applies a built-in theme by name', () => {
    const themed = renderSvgHandler({
      diagram: 'graph LR\n  A --> B',
      theme: 'tokyo-night',
    })
    const plain = renderSvgHandler({ diagram: 'graph LR\n  A --> B' })
    if (
      themed.content[0]?.type !== 'text' ||
      plain.content[0]?.type !== 'text'
    ) {
      throw new Error('Expected text content')
    }
    // tokyo-night's bg (#1a1b26) differs from the library default
    // (#FFFFFF) — theming should visibly change the output.
    expect(themed.content[0].text).toContain(
      THEMES['tokyo-night']?.bg ?? 'MISSING_THEME',
    )
    expect(themed.content[0].text).not.toEqual(plain.content[0].text)
  })

  it('renders with a transparent background when requested', () => {
    const opaque = renderSvgHandler({ diagram: 'graph LR\n  A --> B' })
    const transparent = renderSvgHandler({
      diagram: 'graph LR\n  A --> B',
      transparent: true,
    })
    if (
      opaque.content[0]?.type !== 'text' ||
      transparent.content[0]?.type !== 'text'
    ) {
      throw new Error('Expected text content')
    }
    // transparent:true omits the `background:var(--bg)` style declaration
    // (the --bg custom property itself is still declared either way).
    expect(opaque.content[0].text).toContain('background:var(--bg)')
    expect(transparent.content[0].text).not.toContain('background:var(--bg)')
  })

  it('applies a custom font family', () => {
    const result = renderSvgHandler({
      diagram: 'graph LR\n  A --> B',
      font: 'Comic Sans MS',
    })
    if (result.content[0]?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(result.content[0].text).toContain('Comic Sans MS')
  })

  it('returns an MCP tool error instead of throwing on invalid Mermaid syntax', () => {
    const result = renderSvgHandler({ diagram: 'this is not mermaid {{{' })
    expect(result.isError).toBe(true)
    expect(result.content).toHaveLength(1)
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(content.text).toContain('Failed to render diagram to SVG')
  })

  it('exposes every built-in theme name in the input schema description', () => {
    const description = renderSvgInputShape.theme.description ?? ''
    for (const name of Object.keys(THEMES)) {
      expect(description).toContain(name)
    }
  })

  it('stringifies a non-Error throw instead of reading a nonexistent .message', () => {
    vi.mocked(renderMermaidSVG).mockImplementationOnce(() => {
      // Deliberately not an Error, to exercise the handler's String(err) fallback.
      throw 'raw string failure'
    })
    const result = renderSvgHandler({ diagram: 'graph LR\n  A --> B' })
    expect(result.isError).toBe(true)
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(content.text).toBe(
      'Failed to render diagram to SVG: raw string failure',
    )
  })
})
