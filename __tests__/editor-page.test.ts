/**
 * Unit tests for demo/components/editor-page.tsx and the topbar/panel
 * components it composes.
 *
 * #423 ported the document shell only, leaving the body as one raw
 * `dangerouslySetInnerHTML` splice; #589 finished the port; #806
 * (zombie-mermaid#797's editor hydration epic) replaced that splice with a
 * real server-render-then-hydrate boundary (`<EditorAppIsland>`, see
 * demo/components/editor-app.tsx's header comment): two ordered
 * `<script type="module">` tags, plus the legacy `editor/js/*.js` bundle
 * embedded as inert data (a `<script>` with a `type` no browser executes —
 * see `EditorPageProps.appJs`'s doc comment for why it isn't a third
 * `type="module"` tag).
 *
 * Unlike dashboard-equivalence.test.ts, this isn't a golden-file comparison
 * against the pre-React generator's real output: editor.ts's real output
 * embeds a multi-hundred-KB minified browser bundle that changes whenever
 * any `src/**` file does, so a full-page golden snapshot would be both
 * enormous and constantly invalidated by unrelated source changes — a poor
 * fit for a checked-in regression test. Byte-for-byte equivalence against
 * the pre-React generator was verified by running both generators over the
 * real repo state and comparing DOM-normalised output with a
 * since-removed helper (see docs/decisions/react-site-migration-plan.md
 * for that evidence, for both the #423 step and the #589 one).
 * `__tests__/site-equivalence.test.ts` holds this page's RTL shell
 * assertions (zombie-mermaid#819); this file guards what is specific to
 * `<EditorPage>` and stable across bundle content: the document shell, the
 * flex-layout-critical body structure, the ordering of the three scripts,
 * and that raw script content survives untouched.
 */
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { EditorApp } from '../demo/components/editor-app.tsx'
import { EditorPage } from '../demo/components/editor-page.tsx'
import { renderHtmlDocument } from '../demo/render-html.ts'

const THEMES = [{ key: 'nord', bg: '#2E3440', label: 'Nord' }]

function render(
  scripts: {
    rendererSetupJs?: string
    editorClientScript?: string
    appJs?: string
  } = {},
  css = 'body { color: red; }',
): string {
  return renderHtmlDocument(
    createElement(EditorPage, {
      css,
      themes: THEMES,
      rendererSetupJs: scripts.rendererSetupJs ?? '',
      editorClientScript: scripts.editorClientScript ?? '',
      appJs: scripts.appJs ?? '',
    }),
  )
}

/** Strips React's hydration-boundary comments (`renderToString` emits these; `renderToStaticMarkup` never does) so output from either can be compared. */
function stripHydrationComments(html: string): string {
  return html.replace(/<!--.*?-->/g, '')
}

describe('EditorPage', () => {
  it('renders a complete document with the expected head metadata', () => {
    const html = render()
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<title>ZombieMermaid — Live Editor</title>')
    // SiteHead's own favicon plus the two links it doesn't cover (see the
    // component's header comment) — both must survive, since dropping
    // either would be a real regression (Windows/old-browser favicon
    // fallback and the iOS home-screen icon respectively).
    expect(html).toContain('favicon.ico')
    expect(html).toContain('apple-touch-icon.png')
    expect(html).toContain('favicon.svg')
  })

  it('inlines the given CSS into a <style> element', () => {
    const html = render({}, '.topbar { display: flex; }')
    expect(html).toContain('.topbar { display: flex; }')
  })

  it('preserves each inlined script byte-for-byte via dangerouslySetInnerHTML', () => {
    // Deliberately includes the characters React would normally escape in a
    // text child (<, >, &, quotes) — the exact risk this page was chosen to
    // prove out (see the component's doc comment): renderToStaticMarkup must
    // not corrupt or double-escape raw JS, which isn't text content.
    const rendererSetupJs = `if (a < b) { console.log("renderer & <b>bold</b>"); }`
    const editorClientScript = `if (c > d) { console.log("client & <i>italic</i>"); }`
    const appJs = `if (e < f && g > h) { console.log("app's \\"quoted\\" & <em>text</em>"); }`

    const html = render({ rendererSetupJs, editorClientScript, appJs })
    expect(html).toContain(`<script type="module">${rendererSetupJs}</script>`)
    expect(html).toContain(
      `<script type="module">${editorClientScript}</script>`,
    )
    // appJs is inert data, not a type="module" script — see
    // EditorPageProps.appJs's doc comment.
    expect(html).toContain(
      `<script type="application/x-zm-legacy-js" id="editor-legacy-app-js">${appJs}</script>`,
    )
  })

  it('orders the renderer-setup and editor-client scripts, with the legacy app bundle embedded after both as inert data', () => {
    // demo/editor-client.tsx's header comment: editorClientScript must
    // hydrate <EditorApp> against pristine markup before ever loading
    // appJs's legacy init.ts, which mutates DOM inside that same hydration
    // boundary. Both real scripts are type="module", so document order is
    // execution order for them; appJs isn't executed by the browser at all
    // until editorClientScript explicitly loads it (see that file's
    // runLegacyEditorBundle()), so its *position* in the document doesn't
    // by itself determine when it runs — only that it comes after both
    // real scripts, so a reader scanning top-to-bottom sees it last.
    const html = render({
      rendererSetupJs: '/*renderer-marker*/',
      editorClientScript: '/*client-marker*/',
      appJs: '/*app-marker*/',
    })
    const rendererIdx = html.indexOf('/*renderer-marker*/')
    const clientIdx = html.indexOf('/*client-marker*/')
    const appIdx = html.indexOf('/*app-marker*/')
    expect(rendererIdx).toBeGreaterThan(-1)
    expect(clientIdx).toBeGreaterThan(rendererIdx)
    expect(appIdx).toBeGreaterThan(clientIdx)
  })

  it('embeds the legacy app bundle as inert data no browser will auto-execute', () => {
    // A real browser only ever recognizes a handful of specific `type`
    // values (or an absent type) as executable JavaScript; anything else
    // -- including this made-up type -- is inert, parsed but never run.
    // See demo/editor-client.tsx's runLegacyEditorBundle() for the
    // explicit load step that actually runs this content.
    const html = render({ appJs: 'const marker = 1' })
    expect(html).toContain(
      '<script type="application/x-zm-legacy-js" id="editor-legacy-app-js">',
    )
    expect(html).not.toContain(
      '<script type="module" id="editor-legacy-app-js">',
    )
  })

  it('keeps the layout-critical elements as direct children of .editor-tool-shell', () => {
    // editor/css/variables.css lays `body` out as a flex column and gives
    // `.main` `flex: 1`; #609 reproduces that same contract one level down,
    // on `.editor-tool-shell` (see editor-page.tsx's module doc comment),
    // since `body` itself now also carries the shared nav/hero/footer chrome
    // above and below the tool. `.editor-tool-shell`'s only child is now
    // `#editor-root` (the hydration container `<EditorAppIsland>` renders —
    // zombie-mermaid#806), inside which `.topbar`/`.main`/the toast still
    // land with no wrapper `<div>` between them.
    const html = render()
    const shellStart = html.indexOf('<div class="editor-tool-shell">')
    expect(shellStart).toBeGreaterThan(-1)
    const shell = html.slice(shellStart)
    expect(shell).toMatch(
      /^<div class="editor-tool-shell"><div id="editor-root">(?:<!--.*?-->)?<div class="topbar">/,
    )
    expect(shell).toMatch(/<div class="main"><div class="panel-left"/)
    expect(shell).toMatch(
      /<div class="resize-handle" id="resize-handle"><\/div><div class="panel-right"/,
    )
    expect(shell).toMatch(
      /<\/div>(?:<!--.*?-->)?<div class="toast" id="toast"><\/div>/,
    )
    // Followed by the hydration props payload, still inside .editor-tool-shell.
    expect(shell).toMatch(/<script type="application\/json" id="editor-props">/)
  })

  it('embeds the theme list as JSON-serialisable hydration props', () => {
    const html = render()
    const marker = '<script type="application/json" id="editor-props">'
    const start = html.indexOf(marker)
    expect(start).toBeGreaterThan(-1)
    const jsonStart = start + marker.length
    const jsonEnd = html.indexOf('</script>', jsonStart)
    const payload = JSON.parse(html.slice(jsonStart, jsonEnd)) as {
      themes: typeof THEMES
    }
    expect(payload).toEqual({ themes: THEMES })
  })

  it('renders the shared Nav and Footer around the tool', () => {
    const html = render()
    expect(html).toContain('class="nav-bar"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('>Editor</a>')
    expect(html).toContain('<footer class="section-px"')
  })

  it('renders the same chrome the editor test harness mounts', () => {
    // editor/__tests__/support/harness.ts builds its jsdom document by
    // renderToStaticMarkup-ing <EditorApp> directly; the page embeds the
    // same component's renderToString output inside #editor-root (see
    // EditorAppIsland's doc comment for why renderToString specifically).
    // The two must render the same underlying markup modulo
    // renderToString's hydration-boundary comments, which
    // renderToStaticMarkup never emits.
    const page = render()
    const rootMarker = '<div id="editor-root">'
    const rootStart = page.indexOf(rootMarker) + rootMarker.length
    const rootEnd = page.indexOf(
      '<script type="application/json" id="editor-props">',
    )
    const pageChrome = stripHydrationComments(page.slice(rootStart, rootEnd))
    // Trim the trailing </div> that closes #editor-root itself.
    const pageChromeTrimmed = pageChrome.slice(
      0,
      pageChrome.lastIndexOf('</div>'),
    )

    const harnessChrome = renderHtmlDocument(
      createElement('html', null, createElement(EditorApp, { themes: THEMES })),
    )
    const bodyMarker = '<div class="topbar">'
    const harnessInner = harnessChrome.slice(
      harnessChrome.indexOf(bodyMarker),
      harnessChrome.lastIndexOf('</html>'),
    )

    expect(pageChromeTrimmed).toBe(harnessInner)
  })

  it('does not hoist or duplicate body content into <head>', () => {
    const html = render({ appJs: 'const markerOnlyInBody = 1' })
    const headEnd = html.indexOf('</head>')
    const bodyStart = html.indexOf('<body')
    expect(headEnd).toBeGreaterThan(-1)
    expect(bodyStart).toBeGreaterThan(headEnd)
    expect(html.slice(0, headEnd)).not.toContain('markerOnlyInBody')
  })
})
