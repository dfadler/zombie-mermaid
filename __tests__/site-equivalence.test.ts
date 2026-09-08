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
import { renderHtmlDocument } from '../demo/render-html.ts'
import { normalizeHtml } from './helpers/normalize-html.ts'
import {
  IndexPage,
  type CategorySection,
  type HeroCard,
} from '../demo/components/index-page.tsx'
import { EditorPage } from '../demo/components/editor-page.tsx'
import { EditorThemeItems } from '../demo/components/editor-topbar.tsx'
import {
  ForkFixesPage,
  type FixSectionProps,
} from '../demo/components/fork-fixes-page.tsx'
import {
  DiagramHubPage,
  DiagramTypePage,
} from '../demo/components/diagram-page.tsx'
import { BlogIndexPage, BlogPostPage } from '../demo/components/blog-page.tsx'
import { ThemePicker } from '../demo/components/theme-picker.tsx'

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

async function expectGolden(html: string, file: string): Promise<void> {
  await expect(normalizeHtml(html) + '\n').toMatchFileSnapshot(file)
}

describe('index.ts → index.html', () => {
  const heroCards: HeroCard[] = [
    {
      index: 0,
      codeHtml:
        '<pre class="shiki"><code>flowchart LR\n  A --&gt; B</code></pre>',
      bg: '#101010',
    },
  ]

  const categories: CategorySection[] = [
    {
      label: 'Flowchart',
      slug: 'flowchart',
      items: [
        { index: 1, displayNum: 1, title: 'Basic Flow' },
        { index: 2, displayNum: 2, title: 'Shapes & <edges>' },
      ],
      cards: [
        {
          index: 1,
          title: 'Flowchart: Basic Flow',
          descriptionHtml: 'Uses <code>--&gt;</code> for edges.',
          highlightedSourceHtml:
            '<pre class="shiki"><code>flowchart TD</code></pre>',
          optionsJson: '{"bg":"#fff"}',
          bg: '#fff',
        },
        {
          // No options: the `.options` row must be absent entirely.
          index: 2,
          title: 'Flowchart: Shapes & <edges>',
          descriptionHtml: 'Quotes markup: <code>&lt;title&gt;</code>.',
          highlightedSourceHtml:
            '<pre class="shiki"><code>flowchart LR</code></pre>',
          optionsJson: null,
          bg: '',
        },
      ],
    },
    {
      // A second category is `hidden` on first load.
      label: 'XY Chart',
      slug: 'xy-chart',
      items: [{ index: 3, displayNum: 3, title: 'Bar' }],
      cards: [
        {
          index: 3,
          title: 'XY: Bar',
          descriptionHtml: 'A bar chart.',
          highlightedSourceHtml:
            '<pre class="shiki"><code>xychart-beta</code></pre>',
          optionsJson: '{"width":600}',
          bg: '#fafafa',
        },
      ],
    },
  ]

  it('normalises to the golden DOM', async () => {
    const html = renderHtmlDocument(
      createElement(IndexPage, {
        css: FIXTURE_CSS,
        jsonLd: '{\n  "@type": "SoftwareApplication"\n}',
        samplesJson: '[{"title":"Fixture","source":"flowchart LR"}]',
        moduleScript: FIXTURE_SCRIPT,
        totalSampleCount: 3,
        heroCards,
        categories,
      }),
    )
    await expectGolden(html, './__fixtures__/index-page.normalized.txt')
  })
})

describe('editor.ts → editor.html', () => {
  const themeItems = createElement(EditorThemeItems, {
    themes: [
      { key: 'nord', bg: '#2E3440', label: 'Nord' },
      { key: 'github-light', bg: '#ffffff', label: 'GitHub' },
    ],
  })

  it('normalises to the golden DOM', async () => {
    const html = renderHtmlDocument(
      createElement(EditorPage, {
        css: FIXTURE_CSS,
        themeItems,
        scriptJs: FIXTURE_SCRIPT,
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
      createElement(ForkFixesPage, { css: FIXTURE_CSS, fixes }),
    )
    await expectGolden(html, './__fixtures__/fork-fixes-page.normalized.txt')
  })
})

describe('pages.ts → diagrams/*.html', () => {
  const types = [
    { slug: 'flowchart', label: 'Flowchart' },
    { slug: 'sequence', label: 'Sequence diagram' },
  ]

  it('renders a type page with one orientation', async () => {
    const html = renderHtmlDocument(
      createElement(DiagramTypePage, {
        label: 'Sequence diagram',
        slug: 'sequence',
        intro: 'Sequence diagrams show messages between participants.',
        title: 'Sequence diagram examples | Zombie Mermaid',
        description: 'Rendered live in any of 15 built-in themes.',
        canonical: 'https://example.test/diagrams/sequence.html',
        cssHref: 'assets/diagram-page.css',
        faviconHref: '../favicon.svg',
        sourcePanelHtml:
          '<pre class="shiki"><code>sequenceDiagram</code></pre>',
        diagramHtml: '<svg data-diagram="sequence"></svg>',
        editorHref: '../editor#eyJzb3VyY2UiOiJ4In0=',
        types,
        themePills: createElement(ThemePicker, {
          includeDefault: true,
          activeThemeKey: '',
        }),
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
        types,
        themePills: createElement(ThemePicker, {
          includeDefault: true,
          activeThemeKey: '',
        }),
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
          },
          {
            slug: 'sequence',
            label: 'Sequence diagram',
            intro: 'Sequence diagrams show messages between participants.',
          },
        ],
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
      }),
    )
    expect(html).toContain('<p class="empty-state"')
    expect(html).toContain('No posts yet — check back soon.')
    expect(html).not.toContain('featured-card')
    expect(html).not.toContain('archive-grid')
  })
})
