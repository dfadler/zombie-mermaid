/**
 * Unit tests for demo/components/editor-page.tsx — step two of the #423
 * site-generator migration (after the dashboard.ts pilot).
 *
 * Unlike dashboard-equivalence.test.ts, this isn't a golden-file comparison
 * against the pre-React generator's real output: editor.ts's real output
 * embeds a multi-hundred-KB minified browser bundle that changes whenever
 * any `src/**` file does, so a full-page golden snapshot would be both
 * enormous and constantly invalidated by unrelated source changes — a poor
 * fit for a checked-in regression test. Byte-for-byte equivalence against
 * the pre-React generator was instead verified once, manually, by running
 * both generators over the real repo state and comparing DOM-normalised
 * output with the same helpers/normalize-html.ts used here (see
 * docs/decisions/react-site-migration-plan.md's "Editor.ts prototype"
 * section for that evidence) — this suite guards the two things that are
 * actually specific to `<EditorPage>` and stable across bundle content:
 * the document shell it owns, and that arbitrary raw HTML/script content
 * spliced in via `dangerouslySetInnerHTML` survives untouched.
 */
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { EditorPage } from '../demo/components/editor-page.tsx'
import { renderHtmlDocument } from '../demo/render-html.ts'

function render(bodyHtml: string, css = 'body { color: red; }'): string {
  return renderHtmlDocument(createElement(EditorPage, { css, bodyHtml }))
}

describe('EditorPage', () => {
  it('renders a complete document with the expected head metadata', () => {
    const html = render('<div class="topbar">hi</div>')
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<title>zombie-mermaid — Live Editor</title>')
    // SiteHead's own favicon plus the two links it doesn't cover (see the
    // component's header comment) — both must survive, since dropping
    // either would be a real regression (Windows/old-browser favicon
    // fallback and the iOS home-screen icon respectively).
    expect(html).toContain('favicon.ico')
    expect(html).toContain('apple-touch-icon.png')
    expect(html).toContain('favicon.svg')
  })

  it('inlines the given CSS into a <style> element', () => {
    const html = render('<div></div>', '.topbar { display: flex; }')
    expect(html).toContain('.topbar { display: flex; }')
  })

  it('preserves arbitrary raw body content byte-for-byte via dangerouslySetInnerHTML', () => {
    // Deliberately includes the characters React would normally escape in a
    // text child (<, >, &, quotes) plus a real <script> tag with JS that
    // itself contains a comparison operator and quote characters — the
    // exact risk this page was chosen to prove out (see the file header
    // and the component's own doc comment): renderToStaticMarkup must not
    // corrupt or double-escape this, since it is not text content, it is
    // raw markup replacing what the body's innerHTML always was.
    const bodyHtml = [
      '<div class="topbar">A &amp; B &lt;tag&gt;</div>',
      '<script type="module">',
      `if (a < b && c > d) { console.log("it's \\"quoted\\""); }`,
      '</script>',
    ].join('\n')

    const html = render(bodyHtml)
    expect(html).toContain(bodyHtml)
  })

  it('does not hoist or duplicate body content into <head>', () => {
    const bodyHtml = '<div class="marker-only-in-body"></div>'
    const html = render(bodyHtml)
    const headEnd = html.indexOf('</head>')
    const bodyStart = html.indexOf('<body')
    expect(headEnd).toBeGreaterThan(-1)
    expect(bodyStart).toBeGreaterThan(headEnd)
    expect(html.slice(0, headEnd)).not.toContain('marker-only-in-body')
  })
})
