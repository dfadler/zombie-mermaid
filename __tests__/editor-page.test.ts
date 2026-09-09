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
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EditorApp, EditorPage } from '../demo/components/editor-page.tsx'
import { renderHtmlDocument } from '../demo/render-html.ts'

const THEMES = [{ key: 'nord', bg: '#2E3440', label: 'Nord' }]

function render(scriptJs: string, css = 'body { color: red; }'): string {
  return renderHtmlDocument(
    createElement(EditorPage, {
      css,
      themes: THEMES,
      scriptJs,
      navClientScript: '',
    }),
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

  it('keeps the layout-critical elements as direct children of .editor-tool-shell', () => {
    // editor/css/variables.css lays `body` out as a flex column and gives
    // `.main` `flex: 1`; #609 reproduces that same contract one level down,
    // on `.editor-tool-shell` (see editor-page.tsx's module doc comment),
    // since `body` itself now also carries the shared nav/hero/footer chrome
    // above and below the tool. `<EditorChrome>` still renders a fragment,
    // so `.topbar`/`.main`/the toast land as `.editor-tool-shell`'s direct
    // children with no wrapper `<div>` in between — assert the resulting
    // shape rather than trusting a reviewer to spot a stray one. As of
    // #806, `.editor-tool-shell` also carries `id="editor-root"` (the
    // hydration container EDITOR_ROOT_ID) and its children arrive via
    // `renderToString` (not `renderToStaticMarkup`), so React's own
    // hydration-boundary `<!-- -->` comments may appear between adjacent
    // elements -- the regexes below tolerate an optional one after each
    // opening tag rather than assuming none.
    const html = render('')
    const shellStart = html.indexOf('<div class="editor-tool-shell"')
    expect(shellStart).toBeGreaterThan(-1)
    const shell = html.slice(shellStart)
    expect(shell).toMatch(
      /^<div class="editor-tool-shell" id="editor-root">(<!-- -->)?<div class="topbar">/,
    )
    expect(shell).toMatch(
      /<div class="main">(<!-- -->)?<div class="panel-left"/,
    )
    expect(shell).toMatch(
      /<div class="resize-handle" id="resize-handle"><\/div>(<!-- -->)?<div class="panel-right"/,
    )
    expect(shell).toMatch(
      /<\/div>(<!-- -->)?<div class="toast" id="toast"><\/div><\/div>/,
    )
  })

  it('renders the shared Nav and Footer around the tool', () => {
    const html = render('')
    expect(html).toContain('class="nav-bar"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('>Editor</a>')
    expect(html).toContain('<footer class="section-px"')
  })

  it('renders the same chrome the editor test harness mounts', () => {
    // editor/__tests__/support/harness.ts builds its jsdom document from
    // <EditorApp>, so the two must stay the same markup. Compared via
    // renderToString on both sides (not renderToStaticMarkup) since
    // editor-page.tsx's own hydration container (EDITOR_ROOT_ID) renders
    // EditorApp that way too -- see that component's doc comment for why.
    const page = render('')
    const chromeHtml = renderToString(
      createElement(EditorApp, { themes: THEMES }),
    )
    expect(page).toContain(chromeHtml)
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
