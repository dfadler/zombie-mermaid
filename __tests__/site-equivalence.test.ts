/**
 * RTL coverage for the five site-generator pages #589 moved from
 * template-literal HTML to React: index.ts, editor.ts, fork-fixes.ts,
 * pages.ts, and blog.ts.
 *
 * ## What actually proved equivalence, and what this file guards
 *
 * The migration's proof was a full old-vs-new comparison of the *real*
 * generator output — every page each generator produces (index.html,
 * editor.html, fork-fixes.html, the seven diagrams/*.html, the twelve
 * blog/*.html, plus sitemap.xml and blog/feed.xml), run before and after
 * the change against the real source tree and DOM-normalised. That run is
 * recorded in docs/decisions/react-site-migration-plan.md; it was a
 * one-time check, not a permanent test, for the same reason
 * `dashboard-equivalence.test.ts` gave: index.html and editor.html each
 * embed a ~1.6 MB minified browser bundle, and fork-fixes/diagram pages
 * embed freshly rendered SVG, so a whole-page fixture would be enormous and
 * invalidated by any unrelated `src/**` edit.
 *
 * This file is the permanent half: each page is rendered over small
 * fixture inputs that exercise its branches and asserted against with
 * `@testing-library/react`'s semantic queries (`getByRole`, `getByText`,
 * ...) rather than a whole-document string/snapshot comparison. Earlier
 * revisions of this file instead pinned each page's rendered output as a
 * DOM-normalised, checked-in golden text file — zombie-mermaid#828 (the
 * final cleanup in the #797/#815 epic) finished converting every remaining
 * block to RTL assertions and deleted that now-unused fixture
 * infrastructure (`__tests__/helpers/normalize-html.ts`,
 * `__tests__/__fixtures__/*.normalized.txt`).
 */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { JSDOM } from 'jsdom'
import { within } from '@testing-library/react'
import { renderHtmlDocument } from '../demo/render-html.ts'
import { IndexPage } from '../demo/components/index-page.tsx'
import { FORK_URL } from '../demo/components/site-chrome.tsx'
import { THEMES } from '@zombie-mermaid/core'
import { THEME_LABELS } from '../demo/theme-labels.ts'
import { EditorPage } from '../demo/components/editor-page.tsx'
import {
  ForkFixesPage,
  type FixSectionProps,
} from '../demo/components/fork-fixes-page.tsx'
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

describe('index.ts → index.html', () => {
  const INDEX_JSON_LD = '{\n  "@type": "SoftwareApplication"\n}'
  const INDEX_CLIENT_SCRIPT_SRC = 'assets/index-page-client.js'

  /**
   * `index.ts` (like the other four generators this file guards) never
   * hydrates `IndexPage` itself -- it's rendered once, server-side, to a
   * complete `<html>` document (see `demo/render-html.ts`'s own doc
   * comment). Parsing that string with a fresh `jsdom` `Document` (the same
   * approach `withinRenderedPage()` below uses for the other pages in this
   * file) rather than mounting via `@testing-library/react`'s `render()`
   * avoids nesting a second `<html>/<head>/<body>` inside the RTL container
   * `render()` appends to *this test file's own* `document.body` --
   * `IndexPage`'s output already *is* a full document, not a fragment to
   * mount into one.
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

  /**
   * zombie-mermaid#819 replaces this block's former whole-page golden
   * (`toMatchFileSnapshot` against the now-deleted
   * `editor-page.normalized.txt`) with RTL assertions scoped to what's
   * still meaningfully server-rendered *shell*: the topbar, the two-panel
   * layout with its resize handle, and the theme dropdown's items as
   * rendered from real props. `<EditorAppIsland>`'s own hydrated behavior
   * (tab switching, dark mode, export, toast, config, rendering, sharing,
   * zoom/pan/resize) is already covered by `__tests__/dom/editor-*.test.ts`
   * against `<EditorApp>` directly -- this file doesn't repeat any of that,
   * only the page-assembly concern of "does editor.ts's real props shape
   * reach the rendered document the way editor-page.tsx says it should."
   */
  function renderEditorPageDocument() {
    const html = renderHtmlDocument(
      createElement(EditorPage, {
        css: FIXTURE_CSS,
        themes,
        rendererSetupJs: FIXTURE_SCRIPT,
        editorClientScript: FIXTURE_NAV_CLIENT_SCRIPT,
        appJs: FIXTURE_SCRIPT,
      }),
    )
    return withinRenderedPage(html)
  }

  /** Narrows a possibly-null `querySelector()`/`getElementById()` result. */
  function mustFind(element: Element | null): Element {
    if (!element) throw new Error('test setup: expected element missing')
    return element
  }

  it('renders the page title and the hero heading above the tool', () => {
    const { document, page } = renderEditorPageDocument()

    expect(document.title).toBe('zombie-mermaid — Live Editor')
    expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Write Mermaid, watch it render as you type.',
      }),
    ).toBeInTheDocument()
  })

  it('renders the page-level landmarks: the shared nav and footer', () => {
    // NavIsland/Footer's own markup is pinned byte-for-byte against the
    // design canvas by demo-nav.test.ts/demo-footer.test.ts -- this only
    // checks that editor.ts's page assembly actually includes them.
    const { page } = renderEditorPageDocument()

    expect(page.getByRole('banner')).toBeInTheDocument()
    expect(page.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(page.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('renders the topbar: logo, code/config tabs, dark-mode toggle, theme button, and export button', () => {
    const { document } = renderEditorPageDocument()
    const topbar = within(mustFind(document.querySelector('.topbar')))

    expect(
      topbar.getByRole('link', { name: /zombie-mermaid/ }),
    ).toHaveAttribute('href', '/zombie-mermaid/')
    expect(document.getElementById('tab-code')).toHaveClass('active')
    expect(document.getElementById('tab-config')).not.toHaveClass('active')
    expect(document.getElementById('dark-light-btn')).toBeInTheDocument()
    expect(document.getElementById('theme-dropdown-btn')).toBeInTheDocument()
    expect(document.getElementById('export-main-btn')).toHaveAttribute(
      'title',
      'Save PNG (⌘S)',
    )
  })

  it('renders the theme dropdown items from the themes prop, plus the built-in Default entry', () => {
    const { document } = renderEditorPageDocument()
    const menu = mustFind(document.getElementById('theme-dropdown-menu'))
    const items = [...menu.querySelectorAll('.theme-dropdown-item')]

    expect(items.map((item) => item.getAttribute('data-theme'))).toEqual([
      '',
      'nord',
      'github-light',
    ])
    expect(items[0]).toHaveClass('active')
    expect(items[0]).toHaveTextContent('Default')
    expect(items[1]).toHaveTextContent('Nord')
    expect(items[2]).toHaveTextContent('GitHub')

    // Each real theme's swatch renders the theme's own bg colour -- the
    // Default entry has no swatch at all (editor-topbar.tsx's
    // EditorThemeItems only renders one for entries backed by a real theme).
    const swatches = [...menu.querySelectorAll('.theme-swatch')]
    expect(swatches[0]).toHaveStyle({ background: 'rgb(46, 52, 64)' })
    expect(swatches[1]).toHaveStyle({ background: 'rgb(255, 255, 255)' })
  })

  it('renders the two-panel layout with a resize handle between the source and preview panels', () => {
    const { document } = renderEditorPageDocument()
    const main = mustFind(document.querySelector('.main'))

    expect([...main.children].map((el) => el.id)).toEqual([
      'panel-left',
      'resize-handle',
      'panel-right',
    ])
    expect(document.getElementById('code-editor')).toBeInTheDocument()
    expect(document.getElementById('preview-body')).toBeInTheDocument()
  })

  it('inlines the renderer-setup, editor-client, and legacy app-js scripts verbatim, with no escaping', () => {
    const { document } = renderEditorPageDocument()
    const moduleScripts = [
      ...document.querySelectorAll('script[type="module"]'),
    ].map((script) => script.textContent)

    // The `<` and `&` in these fixtures prove no escaping, same as the
    // golden diff this replaces asserted via its normalized text.
    expect(moduleScripts).toContain(FIXTURE_SCRIPT)
    expect(moduleScripts).toContain(FIXTURE_NAV_CLIENT_SCRIPT)
    expect(document.getElementById('editor-legacy-app-js')).toHaveTextContent(
      FIXTURE_SCRIPT,
      { normalizeWhitespace: false },
    )
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
      // No upstreamIssues: no upstream-issue pill (UpstreamPills) must render.
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

  /**
   * Renders the full document exactly as fork-fixes.ts's real `generate()`
   * does, then parses it with `jsdom` (the same tool `withinRenderedPage()`
   * below uses, for the same reason: RTL/jest-dom's matchers key off each
   * element's own `ownerDocument`, so a
   * standalone `JSDOM` instance queries and asserts correctly without
   * opting this whole file into `@vitest-environment jsdom` just for this
   * one describe block).
   *
   * zombie-mermaid#820 replaces this block's former whole-page golden
   * (`toMatchFileSnapshot` against the now-deleted
   * `fork-fixes-page.normalized.txt`) with per-fix-kind RTL assertions
   * below — see each `it` for what it covers instead.
   */
  function renderDocument(): Document {
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
    return new JSDOM(html).window.document
  }

  /** The `<section id={fix.id}>` FixSection renders — scopes every query below to one fix, so e.g. "PR #42" from one card can't accidentally satisfy an assertion meant for another. */
  function fixSection(doc: Document, id: string): HTMLElement {
    const section = doc.getElementById(id)
    if (!section) throw new Error(`test setup: #${id} section missing`)
    return section as HTMLElement
  }

  // Each `it` below exercises the full ForkFixesPage -> FixSection ->
  // BeforeAfterPanel -> FixPanel chain against one of fixes[]'s four
  // fix-kind fixtures, proving the real props shape fork-fixes.ts produces
  // reaches the page's rendered markup end to end (ids, metadata pills,
  // upstream-issue pills, and the before/after content together).
  // __tests__/demo-fork-fixes-page.test.ts already unit-tests FixPanel's
  // per-kind branches in isolation (every PanelContent kind, both accent
  // colours) — this file doesn't repeat those per-kind assertions, only the
  // page-level wiring they don't cover.

  it('renders the svg-kind before/after panels as real <svg> elements, plus its upstream-issue pills', () => {
    const section = fixSection(renderDocument(), 'svg-fix')
    const scope = within(section)

    // Both sides of this fix are `{ kind: 'svg', html: ... }` — FixPanel's
    // svg branch injects that html verbatim into a `.fix-svg` div.
    const svgs = [...section.querySelectorAll('.fix-svg svg')]
    expect(svgs).toHaveLength(2)
    const [beforeSvg, afterSvg] = svgs
    if (!beforeSvg || !afterSvg)
      throw new Error('test setup: svg panels missing')
    expect(beforeSvg).toHaveAttribute('data-before', '1')
    expect(afterSvg).toHaveAttribute('data-after', '1')

    // This is the one fixture with `upstreamIssues: [7, 9]` — both render
    // as their own link pill (UpstreamPills in fork-fixes-app.tsx).
    expect(scope.getByRole('link', { name: 'upstream #7' })).toHaveAttribute(
      'href',
      'https://github.com/lukilabs/beautiful-mermaid/issues/7',
    )
    expect(scope.getByRole('link', { name: 'upstream #9' })).toBeInTheDocument()
  })

  it("renders the ascii/error-kind panels' distinguishing content, and omits any upstream-issue pill when none are given", () => {
    const section = fixSection(renderDocument(), 'ascii-fix')
    const scope = within(section)

    // before: { kind: 'error', message: ... } — FixPanel's error branch.
    expect(
      scope.getByText('Cannot read property "x" of undefined'),
    ).toBeInTheDocument()

    // after: { kind: 'ascii', html: ... } — ascii-html.ts's own HTML
    // approximation, injected verbatim; the fixture's glyphs are real text
    // content of the resulting <pre class="fix-ascii">.
    expect(section.querySelector('pre.fix-ascii')).not.toBeNull()
    expect(scope.getByText('+--+')).toBeInTheDocument()

    // No `upstreamIssues` on this fix — the presence/absence check the
    // pre-RTL golden used to cover: no upstream pill of any kind renders.
    expect(scope.queryByRole('link', { name: /^upstream #/ })).toBeNull()
  })

  it("renders the excerpt-kind after panel's text verbatim, and the empty-kind before panel's note", () => {
    const section = fixSection(renderDocument(), 'excerpt-fix')
    const scope = within(section)

    // before: { kind: 'empty' }
    expect(
      scope.getByText('Rendered nothing — the diagram was dropped entirely.'),
    ).toBeInTheDocument()

    // after: { kind: 'excerpt', text: '<marker id="arrow"></marker>' } —
    // React text-escapes this (it's a child, not raw HTML via
    // dangerouslySetInnerHTML), so the accessible text is the literal
    // excerpt string, angle brackets and all.
    expect(scope.getByText('<marker id="arrow"></marker>')).toBeInTheDocument()
  })

  it('renders the screenshot-kind before/after panels as real, alt-described <img> elements', () => {
    const section = fixSection(renderDocument(), 'screenshot-fix')
    const scope = within(section)

    expect(
      scope.getByAltText(
        'before terminal output of `zombie-mermaid render screenshot-fix.mmd --ascii`',
      ),
    ).toHaveAttribute('src', 'fork-fixes-screenshots/screenshot-fix-before.png')
    expect(
      scope.getByAltText(
        'after terminal output of `zombie-mermaid render screenshot-fix.mmd --ascii`',
      ),
    ).toHaveAttribute('src', 'fork-fixes-screenshots/screenshot-fix-after.png')
  })
})

/**
 * Parses a page's rendered HTML string with a fresh `jsdom` document (not
 * the ambient `render()` container RTL normally uses — these page
 * components render a whole `<html>` document, and mounting that inside an
 * RTL container div would nest `<html>`/`<body>` under a `<div>`, which
 * React's DOM-nesting validation warns about) and returns
 * `@testing-library/react`'s `within(...)` scoped to that document's body,
 * so the RTL query helpers (`getByRole`, `getByText`, ...) work against the
 * real generator output the same way every describe block in this file
 * does.
 */
function withinRenderedPage(html: string) {
  const { document } = new JSDOM(html).window
  return { document, page: within(document.body) }
}

describe('blog.ts → blog/*.html', () => {
  it('renders a post', () => {
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
    const { document, page } = withinRenderedPage(html)

    expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Shipping v1 of a <zombie>',
      }),
    ).toBeInTheDocument()
    expect(page.getByText('March 4, 2026')).toBeInTheDocument()
    // The meta description isn't rendered text, so it's checked as an
    // attribute rather than via a screen.getByText-style query.
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute('content'),
    ).toBe('What it took, & what broke.')
    // bodyHtml's `dangerouslySetInnerHTML` splice from marked, verified by
    // the rendered text it produces rather than a raw-HTML string match.
    expect(page.getByText('markup')).toBeInTheDocument()
  })

  it('renders the index', () => {
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
    const { page } = withinRenderedPage(html)

    // The featured post (newest first: shipping-v1).
    const featuredLink = page.getByRole('link', {
      name: 'Shipping v1 of a <zombie>',
    })
    expect(featuredLink).toHaveAttribute('href', 'shipping-v1.html')
    expect(page.getByText('What it took, & what broke.')).toBeInTheDocument()
    const readPostLink = page.getByRole('link', { name: /read the post/i })
    expect(readPostLink).toHaveAttribute('href', 'shipping-v1.html')

    // The archive grid (everything but the featured post: day-zero).
    const archiveLink = page.getByRole('link', {
      name: 'Day zero of the toolchain',
    })
    expect(archiveLink).toHaveAttribute('href', 'day-zero.html')
    expect(page.getByText('Setting things up.')).toBeInTheDocument()
    const readMoreLink = page.getByRole('link', { name: /read more/i })
    expect(readMoreLink).toHaveAttribute('href', 'day-zero.html')

    // Both posts' dates render, once each, on their respective cards.
    expect(page.getByText('March 4, 2026')).toBeInTheDocument()
    expect(page.getByText('February 1, 2026')).toBeInTheDocument()
  })

  it('renders the empty state when there are no posts', () => {
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
    const { document, page } = withinRenderedPage(html)

    expect(
      page.getByText('No posts yet — check back soon.'),
    ).toBeInTheDocument()
    expect(document.querySelector('.featured-card')).toBeNull()
    expect(document.querySelector('.archive-grid')).toBeNull()
  })
})
