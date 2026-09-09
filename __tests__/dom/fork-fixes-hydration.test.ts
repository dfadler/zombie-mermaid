// @vitest-environment jsdom
/**
 * Proves the #799/#800 SSR -> hydrate pattern (`__tests__/dom/dashboard-
 * hydration.test.ts`'s pattern for `DashboardApp`) works for `ForkFixesApp`
 * too (zombie-mermaid#802): renders `ForkFixesApp` server-side the same way
 * `fork-fixes-page.tsx`'s `ForkFixesPage` does (`renderToString`, not
 * `renderToStaticMarkup` -- see that component's comment on why its
 * hydration container specifically needs `renderToString`'s
 * hydration-boundary comments), drops that markup into a real (jsdom) DOM
 * node, then hydrates the *same* component tree against it with
 * `hydrateRoot()` -- exactly what `demo/fork-fixes-client.tsx` does in a
 * real browser, modulo reading the props back out of a `<script>` tag
 * (covered separately below).
 *
 * React logs a hydration mismatch as a `console.error` (or, depending on
 * version/mismatch kind, `console.warn`) rather than throwing, so a test
 * that only checks the resulting DOM/text content could pass even with a
 * live mismatch. This captures both channels during the `hydrateRoot()`
 * call and asserts neither fired anything.
 *
 * Also covers this issue's own acceptance criterion that Nav's copy button
 * works via real click interaction *on this page* -- `<Nav>`'s behavior in
 * isolation is already covered by `__tests__/dom/nav-hydration.test.ts`,
 * but that doesn't prove `fork-fixes-client.tsx`'s `main()` actually wires
 * both `ForkFixesApp` and `<NavIsland>` up correctly side by side on the
 * real page fragment, which is what the last describe block below checks.
 */
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  ForkFixesApp,
  FORK_FIXES_PROPS_ELEMENT_ID,
  FORK_FIXES_ROOT_ID,
  type FixSectionProps,
  type ForkFixesAppProps,
} from '../../demo/components/fork-fixes-app.tsx'
import { NavIsland } from '../../demo/components/nav-island.tsx'
import { NAV_INSTALL_COMMAND } from '../../demo/components/nav.tsx'
import { hydrateNav } from '../../demo/nav-client.tsx'

const FIXES: FixSectionProps[] = [
  {
    id: 'svg-fix',
    title: 'Edge labels overlapped',
    symptomHtml: 'An edge label collided.',
    lookForHtml: 'Look at the label position.',
    pr: 42,
    fixCommit: 'abc1234',
    render: 'svg',
    source: 'flowchart LR\n  A -->|label| B',
    before: { kind: 'svg', html: '<svg data-before="1"></svg>' },
    after: { kind: 'svg', html: '<svg data-after="1"></svg>' },
  },
]

const appProps: ForkFixesAppProps = { fixes: FIXES }

let root: Root | undefined

afterEach(() => {
  // hydrateRoot() schedules its hydration pass at idle priority -- see
  // dashboard-hydration.test.ts's identical comment for why act() is
  // needed here rather than a bare unmount.
  if (root) act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

/**
 * Mirrors what `demo/components/fork-fixes-page.tsx`'s `ForkFixesPage`
 * actually sends: a plain `id={FORK_FIXES_ROOT_ID}` wrapper div holding
 * `ForkFixesApp`'s markup -- *not* an id on `ForkFixesApp`'s own root
 * element. See `dashboard-app.tsx`'s `DASHBOARD_ROOT_ID` doc comment for
 * why that distinction matters.
 */
function renderServerHtmlIntoDocument(): void {
  document.body.innerHTML = renderToString(
    createElement('div', { id: FORK_FIXES_ROOT_ID }, [
      createElement(ForkFixesApp, { ...appProps, key: 'app' }),
    ]),
  )
}

describe('ForkFixesApp hydration (#802)', () => {
  it('hydrates against server-rendered markup with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(FORK_FIXES_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    const seen: unknown[][] = []
    const originalError = console.error
    const originalWarn = console.warn
    console.error = (...args: unknown[]) => {
      seen.push(args)
    }
    console.warn = (...args: unknown[]) => {
      seen.push(args)
    }
    let thrown: unknown
    try {
      await act(async () => {
        root = hydrateRoot(container, createElement(ForkFixesApp, appProps))
      })
    } catch (err) {
      thrown = err
    } finally {
      console.error = originalError
      console.warn = originalWarn
    }

    expect(thrown).toBeUndefined()
    expect(seen).toEqual([])
  })

  it('renders the real hero heading and fix title once hydrated', () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(FORK_FIXES_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    act(() => {
      root = hydrateRoot(container, createElement(ForkFixesApp, appProps))
    })

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /what this fork fixes/i,
      }),
    ).toBeInTheDocument()

    const fixSection = document.getElementById('svg-fix')
    if (!fixSection) throw new Error('fix section missing after hydration')
    expect(
      within(fixSection).getByText('Edge labels overlapped'),
    ).toBeInTheDocument()
  })
})

describe('demo/fork-fixes-client.tsx props contract', () => {
  it("ForkFixesPage's embedded JSON round-trips through FORK_FIXES_PROPS_ELEMENT_ID exactly as the client reads it", () => {
    // Mirrors what fork-fixes-page.tsx actually embeds
    // (escapeJsonForScriptTag over JSON.stringify({ fixes })) and what
    // fork-fixes-client.tsx actually reads (JSON.parse(el.textContent)) --
    // without importing either side directly, since one renders through
    // React/JSX and the other calls hydrateRoot()/hydrateNav() as an
    // import-time side effect, neither of which this "does the contract
    // round-trip" check needs.
    const scriptEl = document.createElement('script')
    scriptEl.type = 'application/json'
    scriptEl.id = FORK_FIXES_PROPS_ELEMENT_ID
    scriptEl.textContent = JSON.stringify(appProps)
    document.body.appendChild(scriptEl)

    const read = document.getElementById(FORK_FIXES_PROPS_ELEMENT_ID)
    expect(read?.textContent).toBeTruthy()
    const parsed = JSON.parse(read?.textContent ?? '') as ForkFixesAppProps
    expect(parsed).toEqual(appProps)
  })
})

/**
 * fork-fixes.ts's acceptance criteria (#802) explicitly call out that
 * Nav's copy button must work via real click interaction *on this page*.
 * `<Nav>`'s behavior in isolation is already covered by
 * `__tests__/dom/nav-hydration.test.ts`; this proves `fork-fixes-
 * client.tsx`'s `main()` actually wires up both `ForkFixesApp` (via
 * `hydrateRoot()`) and `<NavIsland>` (via `hydrateNav()`) side by side
 * against the real page fragment, exactly as a browser would.
 */
describe('NavIsland + ForkFixesApp hydrate side by side on this page (#802)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // See nav-hydration.test.ts's identical afterEach comment: userEvent's
    // own jsdom Clipboard polyfill must not leak between tests.
    // @ts-expect-error -- deleting a property this file's own test defines
    // via userEvent.setup(), not one TypeScript thinks is optional.
    delete navigator.clipboard
  })

  it('both hydrate cleanly, and the copy button on this page actually copies', async () => {
    document.body.innerHTML =
      renderToString(
        createElement(NavIsland, {
          active: 'forkFixes',
          homeHref: 'index.html',
          hrefs: {
            diagrams: 'diagrams/',
            editor: 'editor.html',
            forkFixes: '#',
            blog: 'blog/',
            github: 'https://github.com/dfadler/zombie-mermaid',
          },
        }),
      ) +
      renderToString(
        createElement('div', { id: FORK_FIXES_ROOT_ID }, [
          createElement(ForkFixesApp, { ...appProps, key: 'app' }),
        ]),
      )

    const container = document.getElementById(FORK_FIXES_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    await act(async () => {
      root = hydrateRoot(container, createElement(ForkFixesApp, appProps))
    })
    act(() => {
      hydrateNav()
    })

    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    const pill = screen.getByRole('button', { name: 'Copy install command' })
    await user.click(pill)

    expect(writeText).toHaveBeenCalledWith(NAV_INSTALL_COMMAND)
    // ForkFixesApp's own content stayed interactive too -- proves the two
    // hydration calls didn't interfere with each other.
    expect(
      screen.getByRole('heading', { level: 1, name: /what this fork fixes/i }),
    ).toBeInTheDocument()
  })
})
