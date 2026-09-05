/**
 * Guards the demo generator's description formatting.
 *
 * Lives here rather than under src/__tests__ because it imports from demo/,
 * which sits outside tsconfig's `rootDir: "src"`.
 */
import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  formatDescription,
  escapeJsonForScriptTag,
  buildSoftwareApplicationJsonLd,
  type SoftwareApplicationPackageInfo,
} from '../demo/format.ts'
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

describe('escapeJsonForScriptTag', () => {
  /*
   * The regression this function exists for (see its doc comment in
   * demo/format.ts): an HTML parser ends a `<script>` element at the first
   * `</script`, wherever it appears — including inside a JSON string
   * embedded via JSON.stringify, which does not escape `<`. Without this
   * escaping, a payload containing that sequence truncates the page.
   */
  it('breaks up a literal </script sequence so it cannot close the tag', () => {
    const json = JSON.stringify({ note: 'end with </script> now' })
    const escaped = escapeJsonForScriptTag(json)
    expect(escaped).not.toContain('</script')
    expect(escaped).toContain('<\\/script')
  })

  it('is case-insensitive', () => {
    expect(escapeJsonForScriptTag('</SCRIPT>')).toBe('<\\/SCRIPT>')
    expect(escapeJsonForScriptTag('</Script>')).toBe('<\\/Script>')
  })

  it('escapes every occurrence, not just the first', () => {
    const escaped = escapeJsonForScriptTag('a</script>b</script>c')
    expect(escaped).toBe('a<\\/script>b<\\/script>c')
    expect(escaped.match(/<\\\/script/gi)).toHaveLength(2)
  })

  it('leaves ordinary JSON content untouched', () => {
    const json = JSON.stringify({ a: 1, b: 'hello <b>world</b>' })
    expect(escapeJsonForScriptTag(json)).toBe(json)
  })

  it('does not touch a closing tag for a different element', () => {
    const escaped = escapeJsonForScriptTag('</style>')
    expect(escaped).toBe('</style>')
  })
})

describe('buildSoftwareApplicationJsonLd', () => {
  const pkg: SoftwareApplicationPackageInfo = {
    description: 'ASCII and SVG Mermaid diagram rendering.',
    version: '1.2.3',
    license: 'MIT',
    repository: { url: 'https://github.com/dfadler/zombie-mermaid' },
  }

  it('pulls description and version straight from package.json', () => {
    const jsonLd = buildSoftwareApplicationJsonLd(pkg)
    expect(jsonLd.description).toBe(pkg.description)
    expect(jsonLd.softwareVersion).toBe(pkg.version)
  })

  it('derives sameAs from the repository URL', () => {
    const jsonLd = buildSoftwareApplicationJsonLd(pkg)
    expect(jsonLd.sameAs).toBe('https://github.com/dfadler/zombie-mermaid')
  })

  it('derives license as a link to the LICENSE file in the repository', () => {
    const jsonLd = buildSoftwareApplicationJsonLd(pkg)
    expect(jsonLd.license).toBe(
      'https://github.com/dfadler/zombie-mermaid/blob/main/LICENSE',
    )
  })

  /*
   * Note: package.json's own `license` field (an SPDX identifier like "MIT")
   * is intentionally NOT what ends up in the JSON-LD `license` field —
   * schema.org's SoftwareApplication expects `license` to be a URL, not an
   * identifier, so it's derived from the repository URL instead. This test
   * pins that choice so it isn't "fixed" by accident later.
   */
  it('does not use package.json license identifier verbatim', () => {
    const jsonLd = buildSoftwareApplicationJsonLd(pkg)
    expect(jsonLd.license).not.toBe(pkg.license)
  })

  it('matches the expected SoftwareApplication shape', () => {
    const jsonLd = buildSoftwareApplicationJsonLd(pkg)
    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Zombie Mermaid',
      description: pkg.description,
      softwareVersion: pkg.version,
      applicationCategory: 'DeveloperApplication',
      license: 'https://github.com/dfadler/zombie-mermaid/blob/main/LICENSE',
      url: 'https://dfadler.github.io/zombie-mermaid/',
      sameAs: 'https://github.com/dfadler/zombie-mermaid',
    })
  })

  it('produces output that JSON.stringify accepts and round-trips through JSON.parse', () => {
    const jsonLd = buildSoftwareApplicationJsonLd(pkg)
    const serialized = JSON.stringify(jsonLd)
    expect(() => JSON.parse(serialized)).not.toThrow()
    expect(JSON.parse(serialized)).toEqual(jsonLd)
  })

  /*
   * Deliberate omission documented on buildSoftwareApplicationJsonLd itself:
   * Google's Software App rich-result eligibility wants one of these, but
   * this repo has no real ratings/reviews to report and won't fabricate
   * one. Pin the omission so it isn't added back without that tradeoff
   * being revisited on purpose.
   */
  it('does not include aggregateRating, review, or offers', () => {
    const jsonLd = buildSoftwareApplicationJsonLd(pkg)
    expect(jsonLd).not.toHaveProperty('aggregateRating')
    expect(jsonLd).not.toHaveProperty('review')
    expect(jsonLd).not.toHaveProperty('offers')
  })
})
