// @vitest-environment jsdom
/**
 * Proves the #799/#800 SSR -> hydrate pattern
 * (`__tests__/dom/dashboard-hydration.test.ts`'s pattern for
 * `DashboardApp`) works for the homepage's two hydrated apps too
 * (zombie-mermaid#804): `IndexHeroApp` and `IndexMainApp`. Also proves
 * both hydrate side by side with no interference (they're two independent
 * `hydrateRoot()` calls in the same bundle — see `demo/index-client.tsx`'s
 * header comment for why), and that Nav's copy button works via real click
 * interaction on this page — `<Nav>`'s behavior in isolation is already
 * covered by `nav-hydration.test.ts`; this proves `index-client.tsx`'s
 * `main()` actually wires up all three (both apps plus `<NavIsland>`)
 * correctly.
 *
 * `ThemeShowcase`'s own hydration (`demo/index-page-client.ts`) is
 * unrelated to this issue and untested here — it predates #804 and has no
 * new coverage need from this split (its `#theme-pills` island is
 * unaffected: still a plain sibling, still hydrated the same way).
 */
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  IndexHeroApp,
  IndexMainApp,
  INDEX_HERO_ROOT_ID,
  INDEX_MAIN_ROOT_ID,
  type IndexHeroAppProps,
} from '../../demo/components/index-app.tsx'
import { NavIsland } from '../../demo/components/nav-island.tsx'
import { NAV_INSTALL_COMMAND, NAV_ROOT_ID } from '../../demo/components/nav.tsx'
import { hydrateNav } from '../../demo/nav-client.tsx'

/**
 * A fixture, not real `renderMermaidASCII()` output -- this file tests
 * hydration plumbing, not ASCII rendering (that's `ascii-html.ts`/
 * `packages/ascii-renderer`'s own coverage). Passed identically at every
 * `IndexHeroApp` call site below, the same fixture pattern
 * `diagram-type-hydration.test.ts`'s `SINGLE_ORIENTATION_PROPS` uses.
 */
const INDEX_HERO_APP_PROPS: IndexHeroAppProps = {
  asciiHtml: '<pre>fixture</pre>',
}

let heroRoot: Root | undefined
let mainRoot: Root | undefined

afterEach(() => {
  if (heroRoot) act(() => heroRoot?.unmount())
  if (mainRoot) act(() => mainRoot?.unmount())
  heroRoot = undefined
  mainRoot = undefined
  document.body.innerHTML = ''
})

describe('IndexHeroApp hydration (#804)', () => {
  function renderServerHtmlIntoDocument(): void {
    document.body.innerHTML = renderToString(
      createElement('div', { id: INDEX_HERO_ROOT_ID }, [
        createElement(IndexHeroApp, { key: 'app', ...INDEX_HERO_APP_PROPS }),
      ]),
    )
  }

  it('hydrates against server-rendered markup with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(INDEX_HERO_ROOT_ID)
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
        heroRoot = hydrateRoot(
          container,
          createElement(IndexHeroApp, INDEX_HERO_APP_PROPS),
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

  it('renders the real hero heading once hydrated', () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(INDEX_HERO_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    act(() => {
      heroRoot = hydrateRoot(
        container,
        createElement(IndexHeroApp, INDEX_HERO_APP_PROPS),
      )
    })

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /your diagrams deserve more than one gray theme/i,
      }),
    ).toBeInTheDocument()
  })
})

/**
 * HeroInstall's package-manager selector (zombie-mermaid#902): the hero's
 * own instance of `nav.tsx`'s `usePackageManagerInstall` hook, reusing
 * `NavInstallPrefix`/`NavInstallPopover` verbatim. The underlying
 * popover/keyboard/copy behavior is already exhaustively covered by
 * `nav-hydration.test.ts`'s "package-manager selector (#719)" suite against
 * `NavInstall`, which drives the identical code path — this only proves the
 * hero's own wiring of that shared hook actually works end to end.
 */
describe('HeroInstall package-manager selector (#902)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // See nav-hydration.test.ts's identical afterEach comment: userEvent's
    // own jsdom Clipboard polyfill must not leak between tests.
    // @ts-expect-error -- deleting a property this file's own test defines
    // via userEvent.setup(), not one TypeScript thinks is optional.
    delete navigator.clipboard
  })

  function renderServerHtmlIntoDocument(): void {
    document.body.innerHTML = renderToString(
      createElement('div', { id: INDEX_HERO_ROOT_ID }, [
        createElement(IndexHeroApp, { key: 'app', ...INDEX_HERO_APP_PROPS }),
      ]),
    )
  }

  it('defaults to npm, and switching to pnpm updates the copied command', async () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(INDEX_HERO_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    act(() => {
      heroRoot = hydrateRoot(
        container,
        createElement(IndexHeroApp, INDEX_HERO_APP_PROPS),
      )
    })

    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')

    expect(
      screen.getByRole('button', { name: 'Choose package manager' }),
    ).toHaveTextContent('npm')

    await user.click(
      screen.getByRole('button', { name: 'Choose package manager' }),
    )
    await user.click(screen.getByRole('option', { name: 'pnpm' }))

    expect(
      screen.getByRole('button', { name: 'Copy install command' }),
    ).toHaveTextContent('pnpm add zombie-mermaid')

    await user.click(
      screen.getByRole('button', { name: 'Copy install command' }),
    )
    expect(writeText).toHaveBeenCalledWith('pnpm add zombie-mermaid')
  })
})

describe('IndexMainApp hydration (#804)', () => {
  function renderServerHtmlIntoDocument(): void {
    document.body.innerHTML = renderToString(
      createElement('div', { id: INDEX_MAIN_ROOT_ID }, [
        createElement(IndexMainApp, { key: 'app' }),
      ]),
    )
  }

  it('hydrates against server-rendered markup with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(INDEX_MAIN_ROOT_ID)
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
        mainRoot = hydrateRoot(container, createElement(IndexMainApp))
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

  it('renders the real "why this fork exists" section and blog teaser once hydrated', () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(INDEX_MAIN_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    act(() => {
      mainRoot = hydrateRoot(container, createElement(IndexMainApp))
    })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /what zombie-mermaid adds on top/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/294 prs, 14 days/i)).toBeInTheDocument()
  })
})

/**
 * #804's acceptance criterion: Nav's copy button must work via real click
 * interaction on this page. `<Nav>`'s behavior in isolation is already
 * covered by `nav-hydration.test.ts`; this proves `index-client.tsx`'s
 * `main()` actually wires up both hydrated apps and `<NavIsland>` side by
 * side against the real page fragment, with no interference between the
 * three separate hydrateRoot()/hydrateNav() calls.
 */
describe('NavIsland hydrates side by side with both index apps (#804)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // See nav-hydration.test.ts's identical afterEach comment: userEvent's
    // own jsdom Clipboard polyfill must not leak between tests.
    // @ts-expect-error -- deleting a property this file's own test defines
    // via userEvent.setup(), not one TypeScript thinks is optional.
    delete navigator.clipboard
  })

  it('all three hydrate cleanly, and the copy button copies', async () => {
    document.body.innerHTML =
      renderToString(
        createElement(NavIsland, {
          homeHref: '/zombie-mermaid/',
          hrefs: {
            diagrams: 'diagrams/',
            editor: 'editor.html',
            forkFixes: 'fork-fixes.html',
            blog: 'blog/',
            github: 'https://github.com/dfadler/zombie-mermaid',
          },
          sticky: true,
        }),
      ) +
      renderToString(
        createElement('div', { id: INDEX_HERO_ROOT_ID }, [
          createElement(IndexHeroApp, { key: 'hero', ...INDEX_HERO_APP_PROPS }),
        ]),
      ) +
      renderToString(
        createElement('div', { id: INDEX_MAIN_ROOT_ID }, [
          createElement(IndexMainApp, { key: 'main' }),
        ]),
      )

    const heroContainer = document.getElementById(INDEX_HERO_ROOT_ID)
    const mainContainer = document.getElementById(INDEX_MAIN_ROOT_ID)
    if (!heroContainer || !mainContainer) {
      throw new Error('test setup: root container missing')
    }

    await act(async () => {
      heroRoot = hydrateRoot(
        heroContainer,
        createElement(IndexHeroApp, INDEX_HERO_APP_PROPS),
      )
    })
    await act(async () => {
      mainRoot = hydrateRoot(mainContainer, createElement(IndexMainApp))
    })
    act(() => {
      hydrateNav()
    })

    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    const navContainer = document.getElementById(NAV_ROOT_ID)
    if (!navContainer) throw new Error('test setup: nav root missing')
    // Scoped to the nav bar specifically: the hero now carries its own
    // "Copy install command" button too (zombie-mermaid#902's hero package-
    // manager selector), so the bare page-wide query would find both.
    await user.click(
      within(navContainer).getByRole('button', {
        name: 'Copy install command',
      }),
    )
    expect(writeText).toHaveBeenCalledWith(NAV_INSTALL_COMMAND)

    // Both apps stayed interactive/rendered correctly too -- proves the
    // three hydration calls didn't interfere with each other.
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /your diagrams deserve more than one gray theme/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /what zombie-mermaid adds on top/i,
      }),
    ).toBeInTheDocument()
  })
})
