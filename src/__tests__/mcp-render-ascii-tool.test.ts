import { describe, it, expect } from 'vitest'
import { renderAsciiHandler } from '../mcp/tools/render-ascii.ts'

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
})
