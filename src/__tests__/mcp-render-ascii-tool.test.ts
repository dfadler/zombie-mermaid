import { describe, it, expect, vi } from 'vitest'
import { renderAsciiHandler } from '../mcp/tools/render-ascii.ts'
import { renderMermaidASCII } from '../ascii/index.ts'

// ============================================================================
// renderMermaidASCII is wrapped (not fully replaced) so every test above
// still exercises the real renderer — only the one test below that needs a
// non-Error throw (impossible to provoke from real Mermaid source, since
// the renderer only ever throws Error instances) overrides it per-call.
// ============================================================================
vi.mock('../ascii/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ascii/index.ts')>()
  return { ...actual, renderMermaidASCII: vi.fn(actual.renderMermaidASCII) }
})

describe('renderAsciiHandler', () => {
  it('renders a valid diagram to Unicode box-drawing art by default', () => {
    const result = renderAsciiHandler({ diagram: 'graph LR\n  A --> B' })
    expect(result.isError).toBeUndefined()
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(content.text).toContain('A')
    expect(content.text).toContain('B')
    expect(content.text).toContain('┌')
  })

  it('renders plain ASCII characters when useAscii is true', () => {
    const result = renderAsciiHandler({
      diagram: 'graph LR\n  A --> B',
      useAscii: true,
    })
    if (result.content[0]?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(result.content[0].text).not.toContain('┌')
    expect(result.content[0].text).toContain('+')
  })

  it('never emits ANSI color escapes, regardless of environment auto-detection', () => {
    const result = renderAsciiHandler({ diagram: 'graph LR\n  A --> B' })
    if (result.content[0]?.type !== 'text') {
      throw new Error('Expected text content')
    }
    const ansiEscapePrefix = String.fromCharCode(27) + '['
    expect(result.content[0].text).not.toContain(ansiEscapePrefix)
  })

  it('applies custom padding options', () => {
    const tight = renderAsciiHandler({
      diagram: 'graph LR\n  A --> B',
      paddingX: 0,
      paddingY: 0,
    })
    const wide = renderAsciiHandler({
      diagram: 'graph LR\n  A --> B',
      paddingX: 20,
      paddingY: 20,
    })
    if (tight.content[0]?.type !== 'text' || wide.content[0]?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(wide.content[0].text.length).toBeGreaterThan(
      tight.content[0].text.length,
    )
  })

  it('returns an MCP tool error instead of throwing on invalid Mermaid syntax', () => {
    const result = renderAsciiHandler({ diagram: 'this is not mermaid {{{' })
    expect(result.isError).toBe(true)
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(content.text).toContain('Failed to render diagram to ASCII')
  })

  it('stringifies a non-Error throw instead of reading a nonexistent .message', () => {
    vi.mocked(renderMermaidASCII).mockImplementationOnce(() => {
      // Deliberately not an Error, to exercise the handler's String(err) fallback.
      throw 'raw string failure'
    })
    const result = renderAsciiHandler({ diagram: 'graph LR\n  A --> B' })
    expect(result.isError).toBe(true)
    const [content] = result.content
    if (content?.type !== 'text') {
      throw new Error('Expected text content')
    }
    expect(content.text).toBe(
      'Failed to render diagram to ASCII: raw string failure',
    )
  })
})
