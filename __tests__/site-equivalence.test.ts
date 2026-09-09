/**
 * Golden DOM tests for the five site-generator pages #589 moved from
 * template-literal HTML to React: index.ts, editor.ts, fork-fixes.ts,
 * pages.ts, and blog.ts.
 *
 * ## What actually proved equivalence, and what this file guards
 *
 * The migration's proof was a full old-vs-new comparison of the *real*
 * generator output — every page each generator produces (index.html,
 * editor.html, fork-fixes.html, the seven diagrams/*.html, the twelve
 * blog/*.html, plus sitemap.xml and blog/feed.xml), run before and after
 * the change against the real source tree and compared with
 * helpers/normalize-html.ts. That run is recorded in
 * docs/decisions/react-site-migration-plan.md; it is a one-time check, not
 * a permanent test, for the same reason `dashboard-equivalence.test.ts`
 * gave: index.html and editor.html each embed a ~1.6 MB minified browser
 * bundle, and fork-fixes/diagram pages embed freshly rendered SVG, so a
 * whole-page fixture would be enormous and invalidated by any unrelated
 * `src/**` edit.
 *
 * This file is the permanent half: each page is rendered over small
 * fixture inputs that exercise its branches, DOM-normalised, and compared
 * against a checked-in golden. An intentional markup change updates the
 * goldens with `pnpm exec vitest -u`; an unintentional one fails here.
 *
 * The goldens are stored normalised rather than raw so they ignore exactly
 * what normalize-html.ts ignores — attribute order and quoting, whitespace
 * between elements, comments — and stay readable one node per line.
 */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { JSDOM } from 'jsdom'
import { within } from '@testing-library/react'
import { renderHtmlDocument } from '../demo/render-html.ts'
import { normalizeHtml } from './helpers/normalize-html.ts'
import { IndexPage } from '../demo/components/index-page.tsx'
import { FORK_URL } from '../demo/components/site-chrome.tsx'
import { THEMES } from '@zombie-mermaid/core'
import { THEME_LABELS } from '../demo/theme-labels.ts'
import { EditorPage } from '../demo/components/editor-page.tsx'
import {
  ForkFixesPage,
  type FixSectionProps,
} from '../demo/components/fork-fixes-page.tsx'
import {
  DiagramHubPage,
  DiagramTypePage,
} from '../demo/components/diagram-page.tsx'
import { BlogIndexPage, BlogPostPage } from '../demo/components/blog-page.tsx'

/**
 * Stands in for the real stylesheets, which are thousands of lines and
 * change for reasons unrelated to markup. The `>` combinator is deliberate:
 * it proves CSS reaches the `<style>` element unescaped.
 */
const FIXTURE_CSS =
  '/* fixture stylesheet */\nbody > .content-wrapper { max-width: 60rem; }'

/** Stands in for a bundled browser script; the `<` and `&` prove no escaping. */
const FIXTURE_SCRIPT =
  'globalThis.__fixture = 1 < 2 && 3 > 2;\nconsole.log("fixture & <b>bold</b>");'

/**
 * Stands in for the bundled `demo/nav-only-client.tsx` entry
 * (zombie-mermaid#800) every page below now inlines.
 */
const FIXTURE_NAV_CLIENT_SCRIPT =
  'globalThis.__navFixture = 1 < 2 && 3 > 2;\nconsole.log("nav fixture & <b>bold</b>");'

async function expectGolden(html: string, file: string): Promise<void> {
  await expect(normalizeHtml(html) + '\n').toMatchFileSnapshot(file)
}

describe('index.ts → index.html', () => {
  const INDEX_JSON_LD = '{\n  "@type": "SoftwareApplication"\n}'
  const INDEX_CLIENT_SCRIPT_SRC = 'assets/index-page-client.js'

  /**
   * `index.ts` (like the other four generators this file guards) never
   * hydrates `IndexPage` itself -- it's rendered once, server-side, to a
   * complete `<html>` document (see `demo/render-html.ts`'s own doc
   * comment). Parsing that string with a fresh `jsdom` `Document` (the same
   * technique `helpers/normalize-html.ts` already uses) rather than
   * mounting via `@testing-library/react`'s `render()` avoids nesting a
   * second `<html>/<head>/<body>` inside the RTL container `render()`
   * appends to *this test file's own* `document.body` -- `IndexPage`'s
   * output already *is* a full document, not a fragment to mount into one.
   */
  function renderIndexPageDocument(): Document {
    const html = renderHtmlDocument(
      createElement(IndexPage, {
        jsonLd: INDEX_JSON_LD,
        clientScriptSrc: INDEX_CLIENT_SCRIPT_SRC,
        clientScript: FIXTURE_NAV_CLIENT_SCRIPT,
      }),
    )
    return new JSDOM(html).window.document
  }

  /** Narrows a possibly-null `querySelector()` result for `within()`. */
  function mustFind(element: Element | null): Element {
    if (!element) throw new Error('test setup: expected element missing')
    return element
  }

  it('renders the SEO head: title, description, canonical, and the JSON-LD block exactly', () => {
    const document = renderIndexPageDocument()

    expect(document.title).toBe(
      'Zombie Mermaid — Mermaid Rendering, Made Beautiful',
    )
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute('content'),
    ).toBe(
      'Open source diagram rendering library built for the AI era. Ultra-fast, fully themeable, outputs to SVG and ASCII. Supports Flowchart, State, Sequence, Class, ER, and XY Chart diagrams.',
    )
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://dfadler.github.io/zombie-mermaid/')

    // Structured SEO data, not free-form markup -- still worth an
    // exact-match check per docs/testing-conventions.md's golden-DOM section.
    const jsonLdScript = document.querySelector(
      'script[type="application/ld+json"]',
    )
    expect(jsonLdScript?.textContent).toBe(INDEX_JSON_LD)

    // Attribute-presence detail the golden diff caught that a role/text
    // query wouldn't naturally check: the gstatic preconnect carries a
    // (boolean, empty-string) crossorigin attribute; the googleapis one
    // doesn't (see demo/components/tokens.tsx's DesignFontLinks).
    const preconnects = [...document.querySelectorAll('link[rel="preconnect"]')]
    expect(preconnects.map((link) => link.getAttribute('href'))).toEqual([
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ])
    expect(preconnects[0]?.hasAttribute('crossorigin')).toBe(false)
    expect(preconnects[1]?.getAttribute('crossorigin')).toBe('')
  })

  it('renders the client script tags verbatim, with no escaping', () => {
    const document = renderIndexPageDocument()
    const moduleScripts = [
      ...document.querySelectorAll('script[type="module"]'),
    ]

    expect(
      moduleScripts.some(
        (script) => script.getAttribute('src') === INDEX_CLIENT_SCRIPT_SRC,
      ),
    ).toBe(true)

    // The `<` and `&` in FIXTURE_NAV_CLIENT_SCRIPT prove no escaping, same
    // as the fixture this replaces asserted via its golden text.
    const inlineScript = moduleScripts.find(
      (script) => script.textContent === FIXTURE_NAV_CLIENT_SCRIPT,
    )
    expect(inlineScript).toBeDefined()
  })

  it('renders the skip link and every top-level landmark', () => {
    const document = renderIndexPageDocument()
    const body = within(document.body)

    const skipLink = body.getByText('Skip to content')
    expect(skipLink).toHaveAttribute('href', '#main')

    expect(body.getByRole('banner')).toBeInTheDocument()
    expect(body.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(
      body.getByRole('navigation', { name: 'Main (mobile)' }),
    ).toBeInTheDocument()
    expect(body.getByRole('main')).toBeInTheDocument()
    expect(body.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('renders the desktop nav links to every top-level section, plus GitHub', () => {
    const document = renderIndexPageDocument()
    const nav = within(
      mustFind(document.querySelector('nav[aria-label="Main"]')),
    )

    expect(nav.getByRole('link', { name: 'Diagrams' })).toHaveAttribute(
      'href',
      'diagrams/',
    )
    expect(nav.getByRole('link', { name: 'Editor' })).toHaveAttribute(
      'href',
      'editor.html',
    )
    expect(nav.getByRole('link', { name: 'Fork fixes' })).toHaveAttribute(
      'href',
      'fork-fixes.html',
    )
    expect(nav.getByRole('link', { name: 'Blog' })).toHaveAttribute(
      'href',
      'blog/',
    )
    expect(nav.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      FORK_URL,
    )
  })

  it('renders the hero heading, install command, and its CTA', () => {
    const document = renderIndexPageDocument()
    const body = within(document.body)
    // "npm install zombie-mermaid" also appears in the desktop and mobile
    // nav install pills -- scope to the hero row so this only checks the
    // hero's own copy of it.
    const hero = within(mustFind(document.querySelector('.hero-row')))

    expect(
      body.getByRole('heading', {
        level: 1,
        name: 'Your diagrams deserve more than one gray theme.',
      }),
    ).toBeInTheDocument()
    expect(hero.getByText('npm install zombie-mermaid')).toBeInTheDocument()
    expect(
      hero.getByRole('link', { name: /View the live demo/ }),
    ).toHaveAttribute('href', 'editor.html')
  })

  it('renders the theme showcase heading, live count, and six pre-rendered diagram slots', () => {
    const document = renderIndexPageDocument()
    const body = within(document.body)
    const themeCount = Object.keys(THEMES).length
    const defaultTheme = THEMES.dracula
    if (!defaultTheme) throw new Error('test setup: no "dracula" theme')

    expect(
      body.getByRole('heading', {
        level: 2,
        name: 'Pick a theme. Switch it live — no re-render.',
      }),
    ).toBeInTheDocument()
    expect(
      document.querySelector('.theme-showcase-frac-total')?.textContent,
    ).toBe(`${themeCount}`)
    expect(document.getElementById('theme-showcase-counter')?.textContent).toBe(
      '1',
    )
    expect(
      document.getElementById('theme-showcase-theme-name')?.textContent,
    ).toBe(`/* ${THEME_LABELS.dracula ?? 'dracula'} */`)
    expect(document.getElementById('theme-showcase-bg-val')?.textContent).toBe(
      defaultTheme.bg,
    )

    const slots = document.querySelectorAll(
      '#theme-showcase-diagrams > [data-slug]',
    )
    expect(slots).toHaveLength(6)
    expect(slots[0]?.getAttribute('data-slug')).toBe('flowchart')
    expect(slots[0]?.classList.contains('is-active')).toBe(true)
    expect(
      [...slots].filter((slot) => slot.classList.contains('is-active')),
    ).toHaveLength(1)
  })

  it('renders the six feature-grid cards', () => {
    const document = renderIndexPageDocument()
    const body = within(document.body)

    expect(
      body.getByRole('heading', {
        level: 2,
        name: 'Six nodes, one rendering engine.',
      }),
    ).toBeInTheDocument()
    for (const label of [
      'Dual output',
      '15 built-in themes',
      'Full Shiki compatibility',
      'Mono mode',
      'Zero DOM dependencies',
      'Synchronous rendering',
    ]) {
      expect(
        body.getByRole('heading', { level: 3, name: label }),
      ).toBeInTheDocument()
    }
  })

  it('renders the CLI/MCP section with links to the full docs', () => {
    const document = renderIndexPageDocument()
    const body = within(document.body)

    expect(
      body.getByRole('heading', {
        level: 2,
        name: 'A real CLI. A real MCP server.',
      }),
    ).toBeInTheDocument()
    expect(
      body.getByRole('heading', { level: 3, name: 'CLI' }),
    ).toBeInTheDocument()
    expect(
      body.getByRole('heading', { level: 3, name: 'MCP server' }),
    ).toBeInTheDocument()
    expect(
      body.getByRole('link', { name: /Full flag reference/ }),
    ).toHaveAttribute('href', `${FORK_URL}#cli`)
    expect(
      body.getByRole('link', { name: /Read the MCP docs/ }),
    ).toHaveAttribute('href', `${FORK_URL}#mcp-server`)
  })

  it('renders the diagram gallery teaser with a tile per diagram type and a CTA', () => {
    const document = renderIndexPageDocument()
    const body = within(document.body)

    expect(
      body.getByRole('heading', {
        level: 2,
        name: 'Every shape your system needs to explain itself.',
      }),
    ).toBeInTheDocument()

    const gallery: [string, string][] = [
      ['Flowchart', 'diagrams/flowchart.html'],
      ['State', 'diagrams/state.html'],
      ['Sequence', 'diagrams/sequence.html'],
      ['Class', 'diagrams/class.html'],
      ['ER', 'diagrams/er.html'],
      ['XY Chart', 'diagrams/xy-chart.html'],
    ]
    for (const [label, href] of gallery) {
      expect(body.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      )
    }
    expect(
      body.getByRole('link', { name: 'Browse every diagram type' }),
    ).toHaveAttribute('href', 'diagrams/')
  })

  it('renders the proof section with the fork-vs-upstream stats and its CTA', () => {
    const document = renderIndexPageDocument()
    const body = within(document.body)

    expect(
      body.getByRole('heading', {
        level: 2,
        name: 'Actively maintained. Not abandoned.',
      }),
    ).toBeInTheDocument()
    expect(body.getByText('zombie-mermaid (this fork)')).toBeInTheDocument()
    expect(body.getByText('beautiful-mermaid (upstream)')).toBeInTheDocument()
    expect(body.getByRole('link', { name: 'live dashboard' })).toHaveAttribute(
      'href',
      'dashboard.html',
    )
    expect(
      body.getByRole('link', { name: 'See the evidence' }),
    ).toHaveAttribute('href', 'fork-fixes.html')
  })

  it('renders the blog teaser linking to the latest post and to the blog index', () => {
    const document = renderIndexPageDocument()
    const body = within(document.body)

    expect(
      body.getByRole('link', {
        name: '294 PRs, 14 Days — What Agent-Driven OSS Maintenance Actually Looks Like',
      }),
    ).toHaveAttribute('href', 'blog/294-prs-14-days.html')
    expect(body.getByRole('link', { name: /Read the blog/ })).toHaveAttribute(
      'href',
      'blog/',
    )
  })

  it('renders the footer landmark with its product/resources/project links', () => {
    const document = renderIndexPageDocument()
    const footer = within(mustFind(document.querySelector('footer')))

    expect(footer.getByRole('link', { name: 'Diagrams' })).toHaveAttribute(
      'href',
      'diagrams/',
    )
    expect(footer.getByRole('link', { name: 'npm package' })).toHaveAttribute(
      'href',
      'https://www.npmjs.com/package/zombie-mermaid',
    )
    expect(footer.getByText('MIT Licensed')).toBeInTheDocument()
    expect(
      footer.getByRole('link', { name: 'dfadler/zombie-mermaid' }),
    ).toHaveAttribute('href', FORK_URL)
  })
})

describe('editor.ts → editor.html', () => {
  const themes = [
    { key: 'nord', bg: '#2E3440', label: 'Nord' },
    { key: 'github-light', bg: '#ffffff', label: 'GitHub' },
  ]

  it('normalises to the golden DOM', async () => {
    const html = renderHtmlDocument(
      createElement(EditorPage, {
        css: FIXTURE_CSS,
        themes,
        rendererSetupJs: FIXTURE_SCRIPT,
        editorClientScript: FIXTURE_NAV_CLIENT_SCRIPT,
        appJs: FIXTURE_SCRIPT,
      }),
    )
    await expectGolden(html, './__fixtures__/editor-page.normalized.txt')
  })
})

describe('fork-fixes.ts → fork-fixes.html', () => {
  const fixes: FixSectionProps[] = [
    {
      id: 'svg-fix',
      title: 'Edge labels overlapped',
      symptomHtml: 'An edge label using <code>--&gt;</code> collided.',
      lookForHtml: 'Look at the <em>label</em> position.',
      pr: 42,
      fixCommit: 'abc1234',
      render: 'svg',
      upstreamIssues: [7, 9],
      source: 'flowchart LR\n  A -->|label| B',
      before: { kind: 'svg', html: '<svg data-before="1"></svg>' },
      after: { kind: 'svg', html: '<svg data-after="1"></svg>' },
    },
    {
      id: 'ascii-fix',
      title: 'ASCII junctions',
      symptomHtml: 'Junction glyphs were wrong.',
      lookForHtml: 'Compare the corners.',
      pr: 43,
      fixCommit: 'def5678',
      // No upstreamIssues: the `.fix-upstream` span must be absent.
      render: 'ascii',
      source: 'flowchart TD\n  A --> B',
      before: {
        kind: 'error',
        message: 'Cannot read property "x" of undefined',
      },
      after: { kind: 'ascii', html: '<span class="c">+--+</span>' },
    },
    {
      id: 'excerpt-fix',
      title: 'Start-arrow marker',
      symptomHtml: 'The marker was degenerate.',
      lookForHtml: 'Compare the <code>marker</code> element.',
      pr: 44,
      fixCommit: '0123abc',
      render: 'svg',
      source: 'flowchart LR\n  A <--> B',
      before: { kind: 'empty' },
      after: { kind: 'excerpt', text: '<marker id="arrow"></marker>' },
    },
    {
      id: 'screenshot-fix',
      title: 'Real-terminal capture',
      symptomHtml: 'Wide glyphs mis-measured.',
      lookForHtml: 'Compare the column widths.',
      pr: 45,
      fixCommit: '456def0',
      render: 'ascii',
      source: 'flowchart LR\n  A --> B',
      before: {
        kind: 'screenshot',
        file: 'screenshot-fix-before.png',
        side: 'before',
        fixId: 'screenshot-fix',
      },
      after: {
        kind: 'screenshot',
        file: 'screenshot-fix-after.png',
        side: 'after',
        fixId: 'screenshot-fix',
      },
    },
  ]

  it('normalises to the golden DOM', async () => {
    const html = renderHtmlDocument(
      createElement(ForkFixesPage, {
        css: FIXTURE_CSS,
        fixes,
        themeBarScript: FIXTURE_SCRIPT,
        // #802: fork-fixes.html's clientScript hydrates ForkFixesApp +
        // NavIsland in one bundle now, replacing the standalone
        // nav-only-client.tsx bundle every other page here still uses —
        // reusing FIXTURE_NAV_CLIENT_SCRIPT's content is still apt, since
        // this fixture only cares that *some* script is inlined verbatim.
        clientScript: FIXTURE_NAV_CLIENT_SCRIPT,
      }),
    )
    await expectGolden(html, './__fixtures__/fork-fixes-page.normalized.txt')
  })
})

describe('pages.ts → diagrams/*.html', () => {
  const types = [
    { slug: 'flowchart', label: 'Flowchart', accent: 'blue' as const },
    { slug: 'sequence', label: 'Sequence diagram', accent: 'cyan' as const },
  ]

  it('renders a type page with one orientation', async () => {
    const html = renderHtmlDocument(
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
        // "example" (not "examples") wording.
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
        types,
        themeDataScript: 'window.__diagramPageThemes = {"":{"bg":"#FFFFFF"}};',
        clientScriptSrc: 'assets/diagram-page-client.js',
      }),
    )
    await expectGolden(html, './__fixtures__/diagram-type-page.normalized.txt')
  })

  it('renders a type page with wide/narrow orientation variants', async () => {
    const html = renderHtmlDocument(
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
        // Empty on purpose -- exercises MoreExamplesSection's "renders
        // nothing" branch, the other half of what the sequence fixture
        // above (a non-empty galleryItems) already covers.
        galleryItems: [],
        types,
        themeDataScript: 'window.__diagramPageNarrowSource = "flowchart TD";',
        clientScriptSrc: 'assets/diagram-page-client.js',
      }),
    )
    await expectGolden(
      html,
      './__fixtures__/diagram-type-page-orientations.normalized.txt',
    )
  })

  it('renders the hub page', async () => {
    const html = renderHtmlDocument(
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
        themeBarScript: FIXTURE_SCRIPT,
        clientScript: FIXTURE_NAV_CLIENT_SCRIPT,
      }),
    )
    await expectGolden(html, './__fixtures__/diagram-hub-page.normalized.txt')
  })
})

describe('blog.ts → blog/*.html', () => {
  it('renders a post', async () => {
    const html = renderHtmlDocument(
      createElement(BlogPostPage, {
        title: 'Shipping v1 of a <zombie>',
        displayDate: 'March 4, 2026',
        description: 'What it took, & what broke.',
        canonical: 'https://example.test/blog/shipping-v1.html',
        cssHref: 'assets/blog.css',
        faviconHref: '../favicon.svg',
        publishedTime: '2026-03-04',
        bodyHtml: '<p>Body <em>markup</em> from marked.</p>',
        clientScript: FIXTURE_NAV_CLIENT_SCRIPT,
      }),
    )
    await expectGolden(html, './__fixtures__/blog-post-page.normalized.txt')
  })

  it('renders the index', async () => {
    const html = renderHtmlDocument(
      createElement(BlogIndexPage, {
        canonical: 'https://example.test/blog/',
        cssHref: 'assets/blog.css',
        faviconHref: '../favicon.svg',
        posts: [
          {
            slug: 'shipping-v1',
            title: 'Shipping v1 of a <zombie>',
            displayDate: 'March 4, 2026',
            description: 'What it took, & what broke.',
          },
          {
            slug: 'day-zero',
            title: 'Day zero of the toolchain',
            displayDate: 'February 1, 2026',
            description: 'Setting things up.',
          },
        ],
        themeBarScript: FIXTURE_SCRIPT,
        clientScript: FIXTURE_NAV_CLIENT_SCRIPT,
      }),
    )
    await expectGolden(html, './__fixtures__/blog-index-page.normalized.txt')
  })

  it('renders the empty state when there are no posts', async () => {
    const html = renderHtmlDocument(
      createElement(BlogIndexPage, {
        canonical: 'https://example.test/blog/',
        cssHref: 'assets/blog.css',
        faviconHref: '../favicon.svg',
        posts: [],
        themeBarScript: FIXTURE_SCRIPT,
        clientScript: FIXTURE_NAV_CLIENT_SCRIPT,
      }),
    )
    expect(html).toContain('<p class="empty-state"')
    expect(html).toContain('No posts yet — check back soon.')
    expect(html).not.toContain('featured-card')
    expect(html).not.toContain('archive-grid')
  })
})
