// @vitest-environment jsdom
/**
 * RTL coverage for `DiagramTypePage`/`DiagramHubPage`
 * (demo/components/diagram-page.tsx) — replaces the three
 * `toMatchFileSnapshot` goldens `__tests__/site-equivalence.test.ts` used to
 * guard (zombie-mermaid#821), since deleted along with the rest of the
 * golden-fixture infrastructure in zombie-mermaid#828:
 * `diagram-type-page.normalized.txt` (single orientation),
 * `diagram-type-page-orientations.normalized.txt` (wide/narrow variant),
 * and `diagram-hub-page.normalized.txt` (the hub page).
 *
 * Per docs/testing-conventions.md, a semantic RTL query is the default over
 * a literal/snapshot pin. These pages have no source of truth outside their
 * own component logic — unlike the design-canvas fidelity checks or the
 * genuinely enormous full-page goldens that doc names as deliberate
 * exceptions — so asserting on heading/intro/source-panel/diagram-svg
 * presence (type page) and the list of types + their links (hub page) is
 * the right level, not a whole-document string/snapshot comparison.
 *
 * `DiagramTypePage`/`DiagramHubPage` are page *shells* (`<html>`/`<head>`,
 * `NavIsland`, `ThemePickerIsland`/`ThemePickerSection`, `Footer`) that
 * embed their hydrated body content (`DiagramTypeApp`/`DiagramHubApp`) via
 * a `renderToString` call — see diagram-page.tsx's own header comment. That
 * hydrated content already has its own dedicated coverage:
 *
 * - clean hydration (no console noise), both orientation shapes, and the
 *   Nav copy-button interaction: `__tests__/dom/diagram-type-hydration.test.ts`
 * - the theme-pill click → CSS-variable-change behavior end to end:
 *   `__tests__/demo-diagram-page-client.test.ts`'s "#theme-pills wiring…"
 *   and "cross-source re-theme…" describe blocks
 *
 * This file doesn't re-test either of those — only the page-shell-level
 * composition (heading/intro/source-panel/diagram-svg presence, and the
 * hub's list + links) that only `DiagramTypePage`/`DiagramHubPage`
 * themselves, not `DiagramTypeApp`/`DiagramHubApp` in isolation, can prove.
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  DiagramHubPage,
  DiagramTypePage,
} from '../../demo/components/diagram-page.tsx'

const TYPES = [
  { slug: 'flowchart', label: 'Flowchart', accent: 'blue' as const },
  { slug: 'sequence', label: 'Sequence diagram', accent: 'cyan' as const },
]

describe('DiagramTypePage (#821)', () => {
  it('renders the heading, intro, source panel, and diagram svg for a single-orientation type', () => {
    render(
      createElement(DiagramTypePage, {
        label: 'Sequence diagram',
        slug: 'sequence',
        intro: 'Sequence diagrams show messages between participants.',
        accent: 'cyan',
        exampleHeading: 'An API handshake, message by message.',
        sourceFilename: 'handshake.mmd',
        title: 'Sequence diagram examples | Zombie Mermaid',
        description: 'Rendered live in any of 15 built-in themes.',
        canonical: 'https://example.test/diagrams/sequence.html',
        cssHref: 'assets/diagram-page.css',
        faviconHref: '../favicon.svg',
        sourcePanelHtml:
          '<pre class="shiki"><code>sequenceDiagram</code></pre>',
        diagramHtml: '<svg data-diagram="sequence"></svg>',
        editorHref: '../editor#eyJzb3VyY2UiOiJ4In0=',
        // 7 items (> GALLERY_VISIBLE_COUNT's 6) exercises the "Show N
        // more" <details> branch too, with N=1 covering the singular
        // "example" (not "examples") wording — matching the old golden
        // fixture's own gallery input.
        galleryItems: [
          'Actor Stick Figures',
          'Arrow Types',
          'Activation Boxes',
          'Self-Messages',
          'Loop Block',
          'Alt/Else Block',
          'OAuth 2.0 Flow',
        ].map((title, i) => ({
          title,
          diagramHtml: `<svg data-diagram="sequence-gallery-${i}"></svg>`,
          editorHref: `../editor#gallery-${i}`,
        })),
        types: TYPES,
        themeDataScript: 'window.__diagramPageThemes = {"":{"bg":"#FFFFFF"}};',
        clientScriptSrc: 'assets/diagram-page-client.js',
      }),
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sequence diagram' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sequence diagrams show messages between participants.'),
    ).toBeInTheDocument()
    expect(screen.getByText('sequenceDiagram')).toBeInTheDocument()
    expect(
      document.querySelector('.diagram-frame svg[data-diagram="sequence"]'),
    ).not.toBeNull()
    // The "Show N more" disclosure branch (7 gallery items > the 6-visible
    // cap) — see MoreExamplesSection's doc comment.
    expect(screen.getByText('Show 1 more example')).toBeInTheDocument()
  })

  it('renders both the wide and narrow source-panel/diagram-svg variants for an orientation-alternate type', () => {
    render(
      createElement(DiagramTypePage, {
        label: 'Flowchart',
        slug: 'flowchart',
        intro: 'Flowcharts show a process as boxes and arrows.',
        accent: 'blue',
        exampleHeading: 'A deploy pipeline, start to finish.',
        sourceFilename: 'pipeline.mmd',
        title: 'Flowchart examples | Zombie Mermaid',
        description: 'Rendered live in any of 15 built-in themes.',
        canonical: 'https://example.test/diagrams/flowchart.html',
        cssHref: 'assets/diagram-page.css',
        faviconHref: '../favicon.svg',
        sourcePanelHtml: {
          wide: '<pre class="shiki"><code>flowchart LR</code></pre>',
          narrow: '<pre class="shiki"><code>flowchart TD</code></pre>',
        },
        diagramHtml: {
          wide: '<svg data-diagram="flowchart-w"></svg>',
          narrow: '<svg data-diagram="flowchart-n"></svg>',
        },
        editorHref: '../editor#eyJzb3VyY2UiOiJ5In0=',
        // Empty on purpose — exercises MoreExamplesSection's "renders
        // nothing" branch, the other half of what the sequence case above
        // (a non-empty galleryItems) already covers.
        galleryItems: [],
        types: TYPES,
        themeDataScript: 'window.__diagramPageNarrowSource = "flowchart TD";',
        clientScriptSrc: 'assets/diagram-page-client.js',
      }),
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Flowchart' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Flowcharts show a process as boxes and arrows.'),
    ).toBeInTheDocument()

    // Both orientation variants render server-side at once — demo/
    // styles.css's `.orientation-variant` media query is what actually
    // shows/hides each at runtime, not conditional markup — so both must
    // be present in the DOM regardless of viewport.
    expect(screen.getByText('flowchart LR')).toBeInTheDocument()
    expect(screen.getByText('flowchart TD')).toBeInTheDocument()
    expect(
      document.querySelector('.diagram-frame svg[data-diagram="flowchart-w"]'),
    ).not.toBeNull()
    expect(
      document.querySelector('.diagram-frame svg[data-diagram="flowchart-n"]'),
    ).not.toBeNull()

    // galleryItems: [] — MoreExamplesSection renders nothing.
    expect(screen.queryByText('More real-world examples.')).toBeNull()
  })
})

describe('DiagramHubPage (#821)', () => {
  it('renders the list of diagram types with correct links', () => {
    render(
      createElement(DiagramHubPage, {
        title: 'Diagram gallery: every type | Zombie Mermaid',
        description: 'Browse every zombie-mermaid diagram type.',
        canonical: 'https://example.test/diagrams/',
        cssHref: 'assets/diagram-page.css',
        faviconHref: '../favicon.svg',
        themeCount: 15,
        types: [
          {
            slug: 'flowchart',
            label: 'Flowchart',
            intro: 'Flowcharts show a process as boxes and arrows.',
            accent: 'blue',
          },
          {
            slug: 'sequence',
            label: 'Sequence diagram',
            intro: 'Sequence diagrams show messages between participants.',
            accent: 'cyan',
          },
        ],
        themeBarScript: 'globalThis.__themeBar = 1;',
      }),
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Every diagram type.' }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { level: 2, name: 'Flowchart' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Flowcharts show a process as boxes and arrows.'),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { level: 2, name: 'Sequence diagram' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sequence diagrams show messages between participants.'),
    ).toBeInTheDocument()

    const viewExamplesLinks = screen.getAllByRole('link', {
      name: 'View examples',
    })
    expect(viewExamplesLinks.map((link) => link.getAttribute('href'))).toEqual([
      'flowchart.html',
      'sequence.html',
    ])
  })
})
