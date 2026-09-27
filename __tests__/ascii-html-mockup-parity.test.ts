/**
 * Cheap consistency check between the two ASCII "renderers" this repo has
 * (see the verify-ascii-terminal skill for the full rationale): the real
 * terminal path (`renderMermaidASCII`) and the HTML/CSS mockup path
 * (`ascii-html.ts`'s `asciiToHtml`, used by fork-fixes.ts and
 * scripts/visual-diff.ts to build a browser-reviewable report without a
 * real terminal).
 *
 * `asciiToHtml` doesn't re-render a diagram — it wraps `renderMermaidASCII`'s
 * own output in `<span class="fix-wide">` tags around wide (CJK/emoji)
 * clusters, using its own `clusterDisplayWidth`/`isWideChar` classification.
 * Stripping those tags and unescaping the HTML entities `asciiToHtml`
 * introduces must always recover the exact original text — if the mockup's
 * width classification (or its escaping) ever disagrees with the renderer's
 * own `packages/ascii-renderer/src/display-width.ts`, this catches it in a
 * Vitest run instead of only surfacing as a silently wrong browser
 * screenshot (see issue #1141, Option A).
 *
 * This is intentionally narrow: it's a text-content invariant, not a layout
 * check — it can't catch a CSS overflow/scroll bug in the mockup's terminal
 * chrome (`__tests__/visual/helpers/terminal-panel.ts`), the kind
 * `ascii-terminal-overflow-scroll` fixed. That category still needs the
 * Playwright visual-regression suite (for the mockup) and the
 * verify-ascii-terminal skill (for a real terminal) — this test only
 * guards the character-grid math the two renderers are supposed to agree on.
 *
 * Lives here rather than under src/__tests__ because it imports
 * samples-data.ts and ascii-html.ts from outside tsconfig's `rootDir: "src"`
 * — see __tests__/guides-sample-counts.test.ts for the same arrangement.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { asciiToHtml } from '../packages/site/ascii-html.ts'
import { samples } from '../packages/site/samples-data.ts'

/** Inverts asciiToHtml's own transform: unwrap fix-wide spans, unescape entities. */
function stripMockupHtml(html: string): string {
  return html
    .replace(
      /<span class="fix-wide" style="width:\d+ch">([^<]*)<\/span>/g,
      '$1',
    )
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

describe('asciiToHtml – character grid matches renderMermaidASCII across gallery samples', () => {
  // Hero samples have no ASCII panel in the demo either (see scripts/visual-diff.ts).
  const asciiSamples = samples.filter((s) => s.category !== 'Hero')

  it('stripping the HTML mockup yields exactly the real-terminal output', () => {
    let checked = 0
    for (const sample of asciiSamples) {
      let plain: string
      try {
        plain = renderMermaidASCII(sample.source, { colorMode: 'none' })
      } catch {
        continue
      }
      const mockup = asciiToHtml(plain)
      expect(stripMockupHtml(mockup), sample.title).toBe(plain)
      checked++
    }
    // Guard against a vacuous pass: the gallery renders dozens of samples.
    expect(checked).toBeGreaterThan(20)
  })
})
