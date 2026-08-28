/**
 * Guards the demo generator's description formatting.
 *
 * Lives here rather than under src/__tests__ because it imports from demo/,
 * which sits outside tsconfig's `rootDir: "src"`.
 */
import { describe, it, expect } from 'vitest'
import { escapeHtml, formatDescription } from '../demo/format.ts'
import { samples } from '../samples-data.ts'

describe('formatDescription', () => {
  it('turns backtick spans into code elements', () => {
    expect(formatDescription('use `click` here')).toBe(
      'use <code>click</code> here',
    )
  })

  /*
   * The regression this file exists for. formatDescription used to apply the
   * backtick transform to unescaped text, so a description quoting markup
   * emitted real elements into the page.
   *
   * `<title>` was the one that mattered: in body position the HTML parser
   * switches to text mode and consumes the rest of the document, including the
   * module script that boots the gallery. The page rendered a permanent
   * loading spinner and the console was empty — the script was never parsed,
   * so it never ran and never threw. Nothing about the failure pointed at a
   * sample description.
   */
  it('escapes markup quoted inside a code span', () => {
    expect(formatDescription('a native `<title>` element')).toBe(
      'a native <code>&lt;title&gt;</code> element',
    )
    expect(formatDescription('a real SVG `<a href>`')).toBe(
      'a real SVG <code>&lt;a href&gt;</code>',
    )
    expect(formatDescription('emits `<polyline class="edge">`')).toBe(
      'emits <code>&lt;polyline class=&quot;edge&quot;&gt;</code>',
    )
  })

  it('escapes markup outside a code span too', () => {
    expect(formatDescription('an <img> tag')).toBe('an &lt;img&gt; tag')
  })

  it('does not double-escape an ampersand', () => {
    expect(formatDescription('A &amp; B')).toBe('A &amp;amp; B')
    expect(escapeHtml('&')).toBe('&amp;')
  })
})

describe('sample descriptions', () => {
  /*
   * A description reaches the page through formatDescription, so any markup it
   * quotes must survive as text. Asserting on the formatted output rather than
   * the raw string keeps this honest: quoting markup in prose is fine and
   * expected — emitting it unescaped is not.
   */
  it('never emit an element the page did not intend', () => {
    const risky = /<\/?(?:title|script|style|textarea|iframe|a)\b/i
    for (const sample of samples) {
      const formatted = formatDescription(sample.description)
      // <code> is the only tag formatDescription is allowed to introduce.
      const withoutCode = formatted.replace(/<\/?code>/g, '')
      expect(
        risky.test(withoutCode),
        `${sample.title}: description emits raw markup`,
      ).toBe(false)
    }
  })
})
