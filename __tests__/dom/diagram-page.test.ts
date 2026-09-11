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
 * `NavIsland`, `ThemePickerIsland`, `Footer`) that
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
  DiagramAllPage,
  DiagramDetailPage,
  DiagramHubPage,
  DiagramTagPage,
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
        asciiHtml: '<span style="color:#27272A">type-ascii-output</span>',
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
          href: `sequence/gallery-${i}.html`,
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
    // The output toggle (#989 part 2): SVG is the default-visible state,
    // ASCII is present but not mounted until clicked (DetailOutputPanel
    // renders one branch at a time) -- see diagram-type-hydration.test.ts
    // for the real click-through-and-back interaction test.
    expect(screen.getByRole('button', { name: 'SVG' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ASCII' })).toBeInTheDocument()
    expect(screen.queryByText('type-ascii-output')).toBeNull()
    // Gallery cards link to each sample's own detail page, not the editor.
    expect(
      screen.getByRole('link', { name: 'Actor Stick Figures' }),
    ).toHaveAttribute('href', 'sequence/gallery-0.html')
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
        asciiHtml: '<span style="color:#27272A">type-ascii-output</span>',
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

describe('DiagramDetailPage (#989)', () => {
  const baseProps = {
    typeLabel: 'Flowchart',
    typeHref: '../flowchart.html',
    accent: 'blue' as const,
    sampleTitle: 'CI/CD Pipeline',
    sampleDescription: 'A realistic CI/CD pipeline with decision points.',
    sourceFilename: 'ci-cd-pipeline.mmd',
    sourceHtml: '<pre class="shiki"><code>graph TD</code></pre>',
    svgHtml: '<svg data-diagram="detail-svg"></svg>',
    asciiHtml: '<span style="color:#27272A">detail-ascii-output</span>',
    editorHref: '../../editor#eyJzb3VyY2UiOiJ6In0=',
    title: 'CI/CD Pipeline | Flowchart diagram | Zombie Mermaid',
    description: 'Rendered live as both SVG and ASCII.',
    canonical: 'https://example.test/diagrams/flowchart/ci-cd-pipeline.html',
    cssHref: '../assets/diagram-page.css',
    faviconHref: '../../favicon.svg',
    clientScriptSrc: '../assets/diagram-detail-client.js',
    tags: [{ label: 'Subgraph', href: '../tag/subgraph.html' }],
  }

  it('renders the breadcrumb, heading, source, and the SVG output by default', () => {
    render(createElement(DiagramDetailPage, { ...baseProps, moreFromType: [] }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'CI/CD Pipeline' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A realistic CI/CD pipeline with decision points.'),
    ).toBeInTheDocument()
    // Breadcrumb: Home > Diagrams > Flowchart > CI/CD Pipeline.
    expect(screen.getByRole('link', { name: 'Flowchart' })).toHaveAttribute(
      'href',
      '../flowchart.html',
    )
    expect(screen.getByText('graph TD')).toBeInTheDocument()
    // SVG state is the default -- ASCII hasn't been clicked yet, so only
    // the svg branch is in the DOM (DetailOutputPanel renders one branch
    // at a time, unlike DiagramTypePage's orientation variants above,
    // which render both and let CSS pick).
    expect(
      document.querySelector('.diagram-frame svg[data-diagram="detail-svg"]'),
    ).not.toBeNull()
    expect(screen.queryByText('detail-ascii-output')).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Open in the live editor' }),
    ).toHaveAttribute('href', '../../editor#eyJzb3VyY2UiOiJ6In0=')
    // Feature-tag pill (#991) -- links to that construct's tag page.
    expect(screen.getByRole('link', { name: 'Subgraph' })).toHaveAttribute(
      'href',
      '../tag/subgraph.html',
    )
  })

  // The SVG/ASCII toggle's actual click -> state-change behavior isn't
  // testable at this shell level: DiagramDetailPage embeds DiagramDetailApp
  // via `renderToString` + `dangerouslySetInnerHTML` (inert markup, no
  // React event handlers attached) -- exactly like DiagramTypePage's own
  // gallery/theme-pill content above. That interaction is covered by
  // hydrating DiagramDetailApp directly, in
  // __tests__/dom/diagram-type-hydration.test.ts's "DiagramDetailApp
  // hydration (#989)" block, the same split that file's own header comment
  // already documents for DiagramTypeApp's Nav copy-button and theme-pill
  // interactions.

  it('renders "More <type> examples" links when moreFromType is non-empty, and nothing when empty', () => {
    const { unmount } = render(
      createElement(DiagramDetailPage, {
        ...baseProps,
        moreFromType: [
          {
            title: 'Simple Flow',
            href: './simple-flow.html',
            diagramHtml: '<svg data-diagram="simple-flow"></svg>',
          },
        ],
      }),
    )
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'More Flowchart examples',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Simple Flow' })).toHaveAttribute(
      'href',
      './simple-flow.html',
    )
    unmount()

    render(createElement(DiagramDetailPage, { ...baseProps, moreFromType: [] }))
    expect(
      screen.queryByRole('heading', { level: 2, name: /More .* examples/ }),
    ).toBeNull()
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
            count: 24,
          },
          {
            slug: 'sequence',
            label: 'Sequence diagram',
            intro: 'Sequence diagrams show messages between participants.',
            accent: 'cyan',
            count: 1,
          },
        ],
        allHref: 'all.html',
      }),
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Every diagram type.' }),
    ).toBeInTheDocument()

    // #1001's "View all diagrams" CTA, alongside each row's own "View examples".
    expect(
      screen.getByRole('link', { name: /View all diagrams/ }),
    ).toHaveAttribute('href', 'all.html')

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

    // The example-count pill (#989 part 3) — plural and singular wording.
    expect(screen.getByText('24 examples')).toBeInTheDocument()
    expect(screen.getByText('1 example')).toBeInTheDocument()

    const viewExamplesLinks = screen.getAllByRole('link', {
      name: 'View examples',
    })
    expect(viewExamplesLinks.map((link) => link.getAttribute('href'))).toEqual([
      'flowchart.html',
      'sequence.html',
    ])
  })

  it('no longer renders a "Pick a look" theme-picker section', () => {
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
            count: 24,
          },
        ],
        allHref: 'all.html',
      }),
    )

    expect(screen.queryByText('Pick a look')).toBeNull()
    expect(screen.queryByText('Live in every built-in theme.')).toBeNull()
  })
})

describe('DiagramTagPage (#991)', () => {
  it('renders the tag heading, description, example count, and cross-type result cards', () => {
    render(
      createElement(DiagramTagPage, {
        label: 'Subgraph',
        description:
          'Grouping nodes inside a labeled `subgraph` container, for a diagram whose flow naturally breaks into stages or systems.',
        results: [
          {
            title: 'Subgraphs',
            typeLabel: 'Flowchart',
            typeAccent: 'blue',
            href: '../flowchart/subgraphs.html',
            diagramHtml: '<svg data-diagram="subgraphs"></svg>',
          },
          {
            title: 'CI/CD Pipeline',
            typeLabel: 'Flowchart',
            typeAccent: 'blue',
            href: '../flowchart/ci-cd-pipeline.html',
            diagramHtml: '<svg data-diagram="ci-cd"></svg>',
          },
        ],
        title: 'Subgraph — Mermaid diagram examples | Zombie Mermaid',
        metaDescription: 'Grouping nodes inside a labeled subgraph container.',
        canonical: 'https://example.test/diagrams/tag/subgraph.html',
        faviconHref: '../../favicon.svg',
        cssHref: '../assets/diagram-page.css',
        clientScriptSrc: '../assets/diagram-tag-client.js',
      }),
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Subgraph' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Grouping nodes inside a labeled/),
    ).toBeInTheDocument()
    expect(
      screen.getByText('2 examples across every diagram type'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Subgraphs/ })).toHaveAttribute(
      'href',
      '../flowchart/subgraphs.html',
    )
    expect(
      document.querySelector('.gallery-thumb svg[data-diagram="ci-cd"]'),
    ).not.toBeNull()
  })

  it('renders singular wording for a single result', () => {
    render(
      createElement(DiagramTagPage, {
        label: 'Composite State',
        description: 'A nested sub-state.',
        results: [
          {
            title: 'State: Composite States',
            typeLabel: 'State diagram',
            typeAccent: 'violet',
            href: '../state/state-composite-states.html',
            diagramHtml: '<svg></svg>',
          },
        ],
        title: 'Composite State | Zombie Mermaid',
        metaDescription: 'A nested sub-state.',
        canonical: 'https://example.test/diagrams/tag/composite-state.html',
        faviconHref: '../../favicon.svg',
        cssHref: '../assets/diagram-page.css',
        clientScriptSrc: '../assets/diagram-tag-client.js',
      }),
    )

    expect(
      screen.getByText('1 example across every diagram type'),
    ).toBeInTheDocument()
  })
})

describe('DiagramAllPage (#1001)', () => {
  it('renders every type section, grouped, with real cross-type result cards', () => {
    render(
      createElement(DiagramAllPage, {
        totalCount: 3,
        sections: [
          {
            slug: 'flowchart',
            label: 'Flowchart',
            accent: 'blue',
            items: [
              {
                title: 'Simple Flow',
                diagramHtml: '<svg data-diagram="simple-flow"></svg>',
                href: 'flowchart/simple-flow.html',
              },
              {
                title: 'Subgraphs',
                diagramHtml: '<svg data-diagram="subgraphs"></svg>',
                href: 'flowchart/subgraphs.html',
              },
            ],
          },
          {
            slug: 'sequence',
            label: 'Sequence diagram',
            accent: 'cyan',
            items: [
              {
                title: 'Sequence: Basic Messages',
                diagramHtml: '<svg data-diagram="seq-basic"></svg>',
                href: 'sequence/sequence-basic-messages.html',
              },
            ],
          },
        ],
        title: 'Every diagram, one scroll | Zombie Mermaid',
        description: 'All 3 real examples.',
        canonical: 'https://example.test/diagrams/all.html',
        cssHref: 'assets/diagram-page.css',
        faviconHref: '../favicon.svg',
      }),
    )

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Every diagram, one scroll.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/All 3 real examples/)).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { level: 2, name: 'Flowchart' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Sequence diagram' }),
    ).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /Subgraphs/ })).toHaveAttribute(
      'href',
      'flowchart/subgraphs.html',
    )
    expect(
      document.querySelector('.gallery-thumb svg[data-diagram="seq-basic"]'),
    ).not.toBeNull()

    // A "grouped by type" page shows each section's own count, not a single flat total.
    expect(screen.getByText('2 examples')).toBeInTheDocument()
    expect(screen.getByText('1 example')).toBeInTheDocument()
  })
})
