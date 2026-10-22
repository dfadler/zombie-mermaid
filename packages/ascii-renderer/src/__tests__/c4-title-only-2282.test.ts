import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../../../../src/index.ts'

// Mermaid has no ASCII output; a title-only C4 diagram prints its title (#2282).
const src = 'C4Context\n  title Only a title'

const OUT =
  '                 \n  Only a title   \n                 \n                 '

describe('C4 ASCII title-only diagram (#2282)', () => {
  it('prints the title (Unicode)', () => {
    expect(renderMermaidASCII(src)).toBe(OUT)
  })

  it('prints the title (ASCII-only)', () => {
    expect(renderMermaidASCII(src, { useAscii: true })).toBe(OUT)
  })

  it('keeps a wide title on the canvas', () => {
    const out = renderMermaidASCII('C4Context\n  title 日本語のタイトル')
    expect(out).toContain('日本語のタイトル')
  })

  it('still prints nothing for a diagram with neither title nor elements', () => {
    expect(renderMermaidASCII('C4Context')).toBe('')
  })
})
