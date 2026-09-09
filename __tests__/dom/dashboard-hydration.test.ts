// @vitest-environment jsdom
/**
 * Proves the #799 SSR -> hydrate pattern actually hydrates cleanly: renders
 * `DashboardApp` server-side the same way `dashboard-page.tsx`'s
 * `DashboardPage` does (`renderToString`, not `renderToStaticMarkup` — see
 * that component's comment on why its hydration container specifically
 * needs `renderToString`'s hydration-boundary comments), drops that markup
 * into a real (jsdom) DOM node, then hydrates the *same* component tree
 * against it with `hydrateRoot()` — exactly what `demo/dashboard-client.tsx`
 * does in a real browser, modulo reading the props back out of a `<script>`
 * tag (covered separately below).
 *
 * React logs a hydration mismatch as a `console.error` (or, depending on
 * version/mismatch kind, `console.warn`) rather than throwing, so a test
 * that only checks the resulting DOM/text content could pass even with a
 * live mismatch. This captures both channels during the `hydrateRoot()`
 * call and asserts neither fired anything — the automated form of this
 * issue's "no hydration-mismatch warnings in a real browser" acceptance
 * criterion (a real-browser check, via the console, is also part of this
 * PR's manual verification — see the PR description).
 */
import { act, createElement } from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import {
  DASHBOARD_PROPS_ELEMENT_ID,
  DASHBOARD_ROOT_ID,
  DashboardApp,
} from '../../demo/components/dashboard-page.tsx'
import { dashboardFooterColumns } from '../../demo/components/dashboard-app.tsx'
import { ThemePickerSection } from '../../demo/components/theme-picker-section.tsx'
import { Footer } from '../../demo/components/footer.tsx'
import { hydrateThemeBar } from '../../demo/theme-bar-client.tsx'
import { THEME_PILLS_ROOT_ID } from '../../demo/components/theme-picker.tsx'
import { THEME_STORAGE_KEY, getTheme } from '../../demo/theme-state.ts'
import {
  buildDashboardViewModel,
  parseDashboardData,
  type DashboardViewModel,
} from '../../demo/dashboard-model.ts'
import dashboardData from '../../demo/dashboard-data.json' with { type: 'json' }

const viewModel: DashboardViewModel = buildDashboardViewModel(
  parseDashboardData(dashboardData),
)

let root: Root | undefined

afterEach(() => {
  // `hydrateRoot()` schedules its hydration pass at idle priority rather
  // than running it fully synchronously, even though jsdom's DOM already
  // contains the server-rendered content the moment it's called (which is
  // why a plain `getByRole()` right after `hydrateRoot()` succeeds
  // regardless of whether the hydration pass itself has actually finished
  // -- see the second test below). Unmounting from a bare `afterEach`
  // without `act()` interrupts that still-pending pass, which React
  // reports as an uncaught "received an early update, before anything was
  // able hydrate" exception -- not a real bug in the app, but real test
  // noise. `act()` flushes the pending work first.
  if (root) act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

/**
 * Mirrors what `demo/components/dashboard-page.tsx`'s `DashboardPage`
 * actually sends: a plain `id={DASHBOARD_ROOT_ID}` wrapper div holding
 * `DashboardApp`'s markup -- *not* an id on `DashboardApp`'s own root
 * element. See `DASHBOARD_ROOT_ID`'s doc comment for why that distinction
 * matters: `hydrateRoot(container, node)` expects `container` itself to be
 * inert and `node`'s render output to match `container`'s *children*, not
 * `container` itself. An earlier version of this helper gave `DashboardApp`
 * the id directly and then hydrated using that same element as the
 * container, which produced a real (if entirely self-inflicted) hydration
 * mismatch — exactly the bug class this test exists to catch, so it's worth
 * keeping this comment as a record of it.
 */
function renderServerHtmlIntoDocument(): void {
  document.body.innerHTML = renderToString(
    createElement('div', { id: DASHBOARD_ROOT_ID }, [
      createElement(DashboardApp, { viewModel, key: 'app' }),
    ]),
  )
}

describe('DashboardApp hydration (#799)', () => {
  it('hydrates against server-rendered markup with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(DASHBOARD_ROOT_ID)
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
      // `hydrateRoot()` schedules its hydration pass at idle priority
      // rather than running it fully synchronously, so even an `async`
      // `act()` callback (awaited here so at least the initial hydration
      // pass flushes before the assertions below run) doesn't guarantee a
      // *mismatch* error surfaces synchronously inside this try/catch --
      // confirmed via sabotage (passing a deliberately wrong prop here):
      // the mismatch still throws, but as an uncaught exception outside
      // this function's stack, which fails the overall `vitest run` (a
      // non-zero exit code CI treats as a real failure) rather than this
      // specific `expect()`. `thrown`/`seen` still catch a hydration
      // problem that manifests synchronously or via console.error/warn
      // (most do); the exit-code path is the backstop for the rest.
      await act(async () => {
        root = hydrateRoot(
          container,
          createElement(DashboardApp, { viewModel }),
        )
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

  it('renders the real heading and metric numbers once hydrated', () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(DASHBOARD_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    act(() => {
      root = hydrateRoot(container, createElement(DashboardApp, { viewModel }))
    })

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /still shipping every week/i,
      }),
    ).toBeInTheDocument()

    const metrics = document.getElementById('metrics')
    if (!metrics) throw new Error('metrics section missing after hydration')
    expect(
      within(metrics).getByText('zombie-mermaid (this fork)'),
    ).toBeInTheDocument()
    expect(
      within(metrics).getByText('beautiful-mermaid (upstream)'),
    ).toBeInTheDocument()
  })
})

describe('demo/dashboard-client.tsx props contract', () => {
  it("DashboardPage's embedded JSON round-trips through DASHBOARD_PROPS_ELEMENT_ID exactly as the client reads it", () => {
    // Mirrors what dashboard-page.tsx actually embeds (escapeJsonForScriptTag
    // over JSON.stringify(viewModel)) and what dashboard-client.tsx actually
    // reads (JSON.parse(el.textContent)) -- without importing either side
    // directly, since one renders through React/JSX and the other calls
    // hydrateRoot() as an import-time side effect (see that file's own doc
    // comment), neither of which this "does the contract round-trip" check
    // needs.
    const scriptEl = document.createElement('script')
    scriptEl.type = 'application/json'
    scriptEl.id = DASHBOARD_PROPS_ELEMENT_ID
    scriptEl.textContent = JSON.stringify(viewModel)
    document.body.appendChild(scriptEl)

    const read = document.getElementById(DASHBOARD_PROPS_ELEMENT_ID)
    expect(read?.textContent).toBeTruthy()
    const parsed = JSON.parse(read?.textContent ?? '') as DashboardViewModel
    expect(parsed).toEqual(viewModel)
  })
})

/**
 * Regression guard for the bug found (and fixed) during #802's
 * investigation, before it ever reached `main` (#801/PR833 was still
 * open): `DashboardApp` used to nest `<ThemePickerSection>` directly in
 * its own hydrated tree. That both leaked `react-dom/server` into
 * `dashboard-client.tsx`'s browser bundle (covered by
 * `__tests__/dashboard-client-bundle.test.ts`) and meant *two* independent
 * hydration calls would end up targeting the same {@link
 * THEME_PILLS_ROOT_ID} DOM node for one page render: `DashboardApp`'s own
 * `hydrateRoot(DASHBOARD_ROOT_ID, ...)` call (since `ThemePickerSection`
 * sat inside that tree) and `demo/theme-bar-client.tsx`'s
 * `hydrateThemeBar()` (bundled separately, via `demo/theme-bar-only-
 * client.ts`, and mounted by every page that renders `ThemePickerSection`
 * -- dashboard.html included).
 *
 * Renders the *actual* page fragment `dashboard-page.tsx` produces --
 * `DASHBOARD_ROOT_ID`'s container (via `renderToString`, matching that
 * file's own technique) followed by the real `<ThemePickerSection>`/
 * `<Footer>` siblings (via `renderToStaticMarkup`, matching how the rest of
 * the outer document renders) -- then runs both real hydration entry
 * points against it, exactly as a browser would: `DashboardApp`'s own
 * `hydrateRoot()` and `hydrateThemeBar()`.
 */
describe('no double hydration of #theme-pills (#802 investigation fix)', () => {
  let root: Root | undefined

  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
  })

  function renderDashboardPageFragmentIntoDocument(): void {
    const dashboardRootHtml = renderToString(
      createElement(DashboardApp, { viewModel }),
    )
    const siblingsHtml = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(ThemePickerSection),
        createElement(Footer, { columns: dashboardFooterColumns() }),
      ),
    )
    document.body.innerHTML = `
      <div class="dc-root">
        <div id="${DASHBOARD_ROOT_ID}">${dashboardRootHtml}</div>
        ${siblingsHtml}
      </div>
    `
  }

  it("DashboardApp's hydrated subtree never contains #theme-pills", () => {
    renderDashboardPageFragmentIntoDocument()
    const dashboardRoot = document.getElementById(DASHBOARD_ROOT_ID)
    if (!dashboardRoot) throw new Error('test setup: root container missing')
    expect(dashboardRoot.querySelector(`#${THEME_PILLS_ROOT_ID}`)).toBeNull()
    // Sanity: the page still has exactly one #theme-pills, just outside
    // DashboardApp's own boundary.
    expect(document.querySelectorAll(`#${THEME_PILLS_ROOT_ID}`)).toHaveLength(1)
  })

  it('both real hydration entry points can run against the same page fragment with no console warnings/errors, and the picker stays interactive', async () => {
    renderDashboardPageFragmentIntoDocument()
    const dashboardRoot = document.getElementById(DASHBOARD_ROOT_ID)
    if (!dashboardRoot) throw new Error('test setup: root container missing')

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
        root = hydrateRoot(
          dashboardRoot,
          createElement(DashboardApp, { viewModel }),
        )
      })
      act(() => {
        hydrateThemeBar()
      })
    } catch (err) {
      thrown = err
    } finally {
      console.error = originalError
      console.warn = originalWarn
    }

    expect(thrown).toBeUndefined()
    expect(seen).toEqual([])

    // Real interactivity: hydrateThemeBar() -- not DashboardApp's own root
    // -- is the only thing that ever owns #theme-pills, and it still works.
    const dracula = document.querySelector<HTMLElement>(
      '.theme-pill[data-theme="dracula"]',
    )
    if (!dracula) throw new Error('test setup: dracula pill missing')
    fireEvent.click(dracula)
    expect(getTheme()).toBe('dracula')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dracula')
  })
})
