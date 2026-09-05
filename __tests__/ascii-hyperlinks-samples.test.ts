/**
 * OSC 8 hyperlinks (issue #216): the zero-width invariant, checked against
 * every gallery sample — stripping the escape sequences from hyperlinked
 * output must yield exactly the non-hyperlinked output, in plain and in
 * colored mode, for every diagram the ASCII renderer accepts.
 *
 * Lives here rather than under src/__tests__ because it imports
 * samples-data.ts from the repo root, which sits outside tsconfig's
 * `rootDir: "src"` — see __tests__/guides-sample-counts.test.ts for the
 * same arrangement. The per-feature tests are in
 * src/__tests__/ascii-hyperlinks.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../src/ascii/index.ts'
import { stripOsc8 } from '../src/ascii/hyperlinks.ts'
import { samples } from '../samples-data.ts'

const OSC8_PREFIX = '\x1b]8;;'

describe('renderMermaidASCII – hyperlinks strip invariant across gallery samples', () => {
  // Hero samples have no ASCII panel in the demo either.
  const asciiSamples = samples.filter((s) => s.category !== 'Hero')

  it.each(['none', 'truecolor'] as const)(
    'stripping OSC 8 from hyperlinked output yields the plain output (colorMode: %s)',
    (colorMode) => {
      let rendered = 0
      let withLinks = 0
      for (const sample of asciiSamples) {
        let plain: string
        try {
          plain = renderMermaidASCII(sample.source, { colorMode })
        } catch {
          // A diagram the ASCII renderer rejects must be rejected the same
          // way with the option on — never differently.
          expect(() =>
            renderMermaidASCII(sample.source, { colorMode, hyperlinks: true }),
          ).toThrow()
          continue
        }
        const linked = renderMermaidASCII(sample.source, {
          colorMode,
          hyperlinks: true,
        })
        expect(plain, sample.title).not.toContain(OSC8_PREFIX)
        expect(stripOsc8(linked), sample.title).toBe(plain)
        rendered++
        if (linked.includes(OSC8_PREFIX)) withLinks++
      }
      // Guard against a vacuous pass: the gallery renders dozens of samples
      // and at least one ("Interactivity: Links and Tooltips") carries
      // `click` hrefs.
      expect(rendered).toBeGreaterThan(20)
      expect(withLinks).toBeGreaterThanOrEqual(1)
    },
  )
})
