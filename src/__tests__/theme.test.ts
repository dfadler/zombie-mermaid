/**
 * Tests for the theme/color-math helpers in src/theme.ts.
 */
import { describe, it, expect } from 'vitest'
import { getReadableTextColor, buildStyleBlock } from '../theme.ts'

describe('getReadableTextColor', () => {
  it('returns dark text for a light pastel fill (6-digit hex)', () => {
    expect(getReadableTextColor('#FF6B6B', 'var(--_text)')).toBe('#000000')
    expect(getReadableTextColor('#90EE90', 'var(--_text)')).toBe('#000000')
  })

  it('returns light text for a dark fill (6-digit hex)', () => {
    expect(getReadableTextColor('#111111', 'var(--_text)')).toBe('#FFFFFF')
    expect(getReadableTextColor('#000000', 'var(--_text)')).toBe('#FFFFFF')
  })

  it('handles 3-digit shorthand hex', () => {
    expect(getReadableTextColor('#fff', 'var(--_text)')).toBe('#000000')
    expect(getReadableTextColor('#000', 'var(--_text)')).toBe('#FFFFFF')
  })

  it('ignores alpha channel in 4/8-digit hex and uses RGB luminance', () => {
    expect(getReadableTextColor('#ffffffff', 'var(--_text)')).toBe('#000000')
    expect(getReadableTextColor('#000000ff', 'var(--_text)')).toBe('#FFFFFF')
  })

  it('falls back when fill is undefined', () => {
    expect(getReadableTextColor(undefined, 'var(--_text)')).toBe('var(--_text)')
  })

  it('falls back when fill is a CSS variable reference', () => {
    expect(getReadableTextColor('var(--surface)', 'var(--_text)')).toBe(
      'var(--_text)',
    )
  })

  it('falls back when fill is a named CSS color', () => {
    expect(getReadableTextColor('lightpink', 'var(--_text)')).toBe(
      'var(--_text)',
    )
  })

  it('falls back when fill is malformed or an injection attempt', () => {
    expect(
      getReadableTextColor('red" onmouseover="alert(1)', 'var(--_text)'),
    ).toBe('var(--_text)')
    expect(getReadableTextColor('#gggggg', 'var(--_text)')).toBe('var(--_text)')
  })
})

describe('buildStyleBlock – font handling', () => {
  it('quotes a normal font name and emits a Google Fonts @import (no regression)', () => {
    const block = buildStyleBlock('Inter', false)
    expect(block).toContain(
      "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap');",
    )
    expect(block).toContain(
      "text { font-family: 'Inter', system-ui, sans-serif; }",
    )
  })

  it('skips the Google Fonts @import and emits an unquoted value for a CSS var() reference', () => {
    const block = buildStyleBlock('var(--font-family-body)', false)
    expect(block).not.toContain('fonts.googleapis.com')
    expect(block).toContain(
      'text { font-family: var(--font-family-body), system-ui, sans-serif; }',
    )
  })

  it('handles a var() reference with a quoted fallback argument', () => {
    const block = buildStyleBlock("var(--font, 'Fallback Font')", false)
    expect(block).not.toContain('fonts.googleapis.com')
    expect(block).toContain(
      "text { font-family: var(--font, 'Fallback Font'), system-ui, sans-serif; }",
    )
  })

  it('treats a var()-like value with unbalanced parens/semicolons as untrusted and falls back to a quoted literal', () => {
    const block = buildStyleBlock('var(--x); } .evil{color:red', false)
    // Not treated as a var() reference: still gets a (sanitized) Google Fonts import + quoting.
    expect(block).toContain('fonts.googleapis.com')
    expect(block).not.toMatch(/text \{ font-family: var\(/)
    // The sanitizer stripped the `;` and `{`/`}`, so the payload can't
    // terminate the declaration/rule early — exactly one <style> block.
    expect(block.match(/<style>/g)?.length).toBe(1)
    expect(block.match(/<\/style>/g)?.length).toBe(1)
  })

  it('sanitizes a malicious font value so it cannot break out of the generated <style> block', () => {
    const malicious = '</style><script>alert(1)</script><style>'
    const block = buildStyleBlock(malicious, false)
    expect(block).not.toContain('</style><script>')
    expect(block).not.toContain('<script>')
    // The <style> block must still be well-formed: exactly one open/close pair.
    expect(block.match(/<style>/g)?.length).toBe(1)
    expect(block.match(/<\/style>/g)?.length).toBe(1)
  })

  it('sanitizes an attempted CSS-injection payload disguised as a var() reference', () => {
    const malicious = "var(--x, 'y'); } .evil { fill: red } /*"
    const block = buildStyleBlock(malicious, false)
    // Contains a semicolon, so it fails the strict var() check and is
    // treated (and sanitized) as a literal, quoted font name instead.
    expect(block).not.toMatch(/text \{ font-family: var\(/)
    expect(block).not.toContain('.evil { fill: red }')
  })

  it('skips the Google Fonts @import for a comma-separated font stack (#223)', () => {
    const block = buildStyleBlock('ui-sans-serif, system-ui, sans-serif', false)
    expect(block).not.toContain('fonts.googleapis.com')
  })

  it('skips the Google Fonts @import for a bare CSS generic family keyword', () => {
    const block = buildStyleBlock('system-ui', false)
    expect(block).not.toContain('fonts.googleapis.com')
  })

  it('still emits the Google Fonts @import for a single real font name (regression guard)', () => {
    const block = buildStyleBlock('Roboto', false)
    expect(block).toContain(
      "@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&amp;display=swap');",
    )
  })

  it('still renders a font stack literally in the text { font-family: ... } rule', () => {
    const block = buildStyleBlock('ui-sans-serif, system-ui, sans-serif', false)
    expect(block).toContain(
      "text { font-family: 'ui-sans-serif, system-ui, sans-serif', system-ui, sans-serif; }",
    )
  })
})
