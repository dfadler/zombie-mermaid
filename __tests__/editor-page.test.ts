/**
 * Unit tests for demo/components/editor-page.tsx and the topbar/panel
 * components it composes.
 *
 * #423 ported the document shell only, leaving the body as one raw
 * `dangerouslySetInnerHTML` splice; #589 finished the port, so the tests
 * that used to feed arbitrary body HTML now exercise the real component
 * tree plus the one raw splice that remains — the inlined
 * `<script type="module">`.
 *
 * Unlike dashboard-equivalence.test.ts, this isn't a golden-file comparison
 * against the pre-React generator's real output: editor.ts's real output
 * embeds a multi-hundred-KB minified browser bundle that changes whenever
 * any `src/**` file does, so a full-page golden snapshot would be both
 * enormous and constantly invalidated by unrelated source changes — a poor
 * fit for a checked-in regression test. Byte-for-byte equivalence against
 * the pre-React generator was verified by running both generators over the
 * real repo state and comparing DOM-normalised output with the same
 * helpers/normalize-html.ts (see docs/decisions/react-site-migration-plan.md
 * for that evidence, for both the #423 step and the #589 one).
 * `__tests__/site-equivalence.test.ts` holds the page's fixture-sized
 * golden; this file guards what is specific to `<EditorPage>` and stable
 * across bundle content: the document shell, the flex-layout-critical body
 * structure, and that raw script content survives untouched.
 */
import { createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { EditorChrome, EditorPage } from '../demo/components/editor-page.tsx'
import { EditorThemeItems } from '../demo/components/editor-topbar.tsx'
import { renderHtmlDocument } from '../demo/render-html.ts'

const THEME_ITEMS: ReactNode = createElement(EditorThemeItems, {
  themes: [{ key: 'nord', bg: '#2E3440', label: 'Nord' }],
})

function render(scriptJs: string, css = 'body { color: red; }'): string {
  return renderHtmlDocument(
    createElement(EditorPage, { css, themeItems: THEME_ITEMS, scriptJs }),
  )
}

describe('EditorPage', () => {
  it('renders a complete document with the expected head metadata', () => {
    const html = render('')
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
    const html = render('', '.topbar { display: flex; }')
    expect(html).toContain('.topbar { display: flex; }')
  })

  it('preserves the inlined script byte-for-byte via dangerouslySetInnerHTML', () => {
    // Deliberately includes the characters React would normally escape in a
    // text child (<, >, &, quotes) — the exact risk this page was chosen to
    // prove out (see the component's doc comment): renderToStaticMarkup must
    // not corrupt or double-escape the bundled renderer plus every
    // editor/js/*.js module, which is raw JS, not text content.
    const scriptJs = `if (a < b && c > d) { console.log("it's \\"quoted\\" & <b>bold</b>"); }`

    const html = render(scriptJs)
    expect(html).toContain(`<script type="module">${scriptJs}</script>`)
  })

  it('keeps the layout-critical elements as direct children of <body>', () => {
    // editor/css/variables.css lays `body` out as a flex column and gives
    // `.main` `flex: 1`, so any extra wrapper element would become the flex
    // item instead and visibly break the page. That hazard is exactly why
    // the HTML partials had to become real components rather than
    // per-fragment `dangerouslySetInnerHTML` splices — assert the resulting
    // shape rather than trusting a reviewer to spot a stray <div>.
    const html = render('')
    const body = html.slice(html.indexOf('<body>'))
    expect(body).toMatch(/^<body><div class="topbar">/)
    expect(body).toMatch(/<div class="main"><div class="panel-left"/)
    expect(body).toMatch(
      /<div class="resize-handle" id="resize-handle"><\/div><div class="panel-right"/,
    )
    expect(body).toMatch(
      /<\/div><div class="toast" id="toast"><\/div><script type="module">/,
    )
  })

  it('renders the same chrome the editor test harness mounts', () => {
    // editor/__tests__/support/harness.ts builds its jsdom document from
    // <EditorChrome>, so the two must stay the same markup.
    const page = render('')
    const chrome = renderHtmlDocument(
      createElement(
        'html',
        null,
        createElement(EditorChrome, { themeItems: THEME_ITEMS }),
      ),
    )
    const inner = chrome.slice(
      chrome.indexOf('<div class="topbar">'),
      chrome.lastIndexOf('</html>'),
    )
    expect(page).toContain(inner)
  })

  it('does not hoist or duplicate body content into <head>', () => {
    const html = render('const markerOnlyInBody = 1')
    const headEnd = html.indexOf('</head>')
    const bodyStart = html.indexOf('<body')
    expect(headEnd).toBeGreaterThan(-1)
    expect(bodyStart).toBeGreaterThan(headEnd)
    expect(html.slice(0, headEnd)).not.toContain('markerOnlyInBody')
  })
})
