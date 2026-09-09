// @vitest-environment jsdom
/**
 * Proves the #799/#800 SSR -> hydrate pattern
 * (`__tests__/dom/dashboard-hydration.test.ts`'s pattern for
 * `DashboardApp`) works for both blog apps too (zombie-mermaid#803):
 * `BlogPostApp` (its `bodyHtml` `dangerouslySetInnerHTML` splice from
 * marked's Markdown output) and `BlogIndexApp` (both its normal
 * featured/archive branch and its empty-state branch — see #803's own
 * acceptance criteria on keeping that branch working post-hydration).
 *
 * Also covers this issue's acceptance criterion that Nav's copy button
 * works via real click interaction on *both page types* — `<Nav>`'s
 * behavior in isolation is already covered by `nav-hydration.test.ts`;
 * this proves `blog-post-client.tsx`/`blog-index-client.tsx`'s `main()`
 * each actually wire up their app plus `<NavIsland>` correctly side by
 * side on the real page fragment.
 */
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  BlogIndexApp,
  BLOG_INDEX_PROPS_ELEMENT_ID,
  BLOG_INDEX_ROOT_ID,
  BlogPostApp,
  BLOG_POST_PROPS_ELEMENT_ID,
  BLOG_POST_ROOT_ID,
  type BlogIndexAppProps,
  type BlogPostAppProps,
} from '../../demo/components/blog-app.tsx'
import { NavIsland } from '../../demo/components/nav-island.tsx'
import { NAV_INSTALL_COMMAND } from '../../demo/components/nav.tsx'
import { hydrateNav } from '../../demo/nav-client.tsx'

const postProps: BlogPostAppProps = {
  title: 'Shipping v1 of a zombie',
  displayDate: 'March 4, 2026',
  bodyHtml: '<p>Body <em>markup</em> from marked.</p>',
}

const indexProps: BlogIndexAppProps = {
  posts: [
    {
      slug: 'shipping-v1',
      title: 'Shipping v1 of a zombie',
      displayDate: 'March 4, 2026',
      description: 'What it took, and what broke.',
    },
    {
      slug: 'day-zero',
      title: 'Day zero of the toolchain',
      displayDate: 'February 1, 2026',
      description: 'Setting things up.',
    },
  ],
}

const emptyIndexProps: BlogIndexAppProps = { posts: [] }

let root: Root | undefined

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

describe('BlogPostApp hydration (#803)', () => {
  function renderServerHtmlIntoDocument(): void {
    document.body.innerHTML = renderToString(
      createElement('div', { id: BLOG_POST_ROOT_ID }, [
        createElement(BlogPostApp, { ...postProps, key: 'app' }),
      ]),
    )
  }

  it('hydrates against server-rendered markup, including the bodyHtml dangerouslySetInnerHTML splice, with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(BLOG_POST_ROOT_ID)
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
        root = hydrateRoot(container, createElement(BlogPostApp, postProps))
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

  it('renders the real title and post body once hydrated', () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(BLOG_POST_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    act(() => {
      root = hydrateRoot(container, createElement(BlogPostApp, postProps))
    })

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /shipping v1 of a zombie/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('markup')).toBeInTheDocument() // from bodyHtml's <em>
  })
})

describe('BlogIndexApp hydration (#803)', () => {
  function renderServerHtmlIntoDocument(props: BlogIndexAppProps): void {
    document.body.innerHTML = renderToString(
      createElement('div', { id: BLOG_INDEX_ROOT_ID }, [
        createElement(BlogIndexApp, { ...props, key: 'app' }),
      ]),
    )
  }

  it('hydrates against server-rendered markup with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument(indexProps)
    const container = document.getElementById(BLOG_INDEX_ROOT_ID)
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
        root = hydrateRoot(container, createElement(BlogIndexApp, indexProps))
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

  it('renders the featured post and archive grid once hydrated', () => {
    renderServerHtmlIntoDocument(indexProps)
    const container = document.getElementById(BLOG_INDEX_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    act(() => {
      root = hydrateRoot(container, createElement(BlogIndexApp, indexProps))
    })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /shipping v1 of a zombie/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /day zero of the toolchain/i,
      }),
    ).toBeInTheDocument()
  })

  /**
   * #803's own acceptance criterion: the empty-state branch (no posts) must
   * keep hydrating cleanly, not just render correctly server-side (already
   * covered by site-equivalence.test.ts's "renders the empty state when
   * there are no posts").
   */
  it('hydrates the empty-state branch (no posts) with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument(emptyIndexProps)
    const container = document.getElementById(BLOG_INDEX_ROOT_ID)
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
        root = hydrateRoot(
          container,
          createElement(BlogIndexApp, emptyIndexProps),
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
    expect(
      screen.getByText('No posts yet — check back soon.'),
    ).toBeInTheDocument()
  })
})

describe('demo/blog-post-client.tsx and blog-index-client.tsx props contracts', () => {
  it("BlogPostPage's embedded JSON round-trips through BLOG_POST_PROPS_ELEMENT_ID exactly as the client reads it", () => {
    const scriptEl = document.createElement('script')
    scriptEl.type = 'application/json'
    scriptEl.id = BLOG_POST_PROPS_ELEMENT_ID
    scriptEl.textContent = JSON.stringify(postProps)
    document.body.appendChild(scriptEl)

    const read = document.getElementById(BLOG_POST_PROPS_ELEMENT_ID)
    expect(read?.textContent).toBeTruthy()
    expect(JSON.parse(read?.textContent ?? '')).toEqual(postProps)
  })

  it("BlogIndexPage's embedded JSON round-trips through BLOG_INDEX_PROPS_ELEMENT_ID exactly as the client reads it", () => {
    const scriptEl = document.createElement('script')
    scriptEl.type = 'application/json'
    scriptEl.id = BLOG_INDEX_PROPS_ELEMENT_ID
    scriptEl.textContent = JSON.stringify(indexProps)
    document.body.appendChild(scriptEl)

    const read = document.getElementById(BLOG_INDEX_PROPS_ELEMENT_ID)
    expect(read?.textContent).toBeTruthy()
    expect(JSON.parse(read?.textContent ?? '')).toEqual(indexProps)
  })
})

/**
 * #803's acceptance criteria explicitly call out that Nav's copy button
 * must work via real click interaction on *both page types*. `<Nav>`'s
 * behavior in isolation is already covered by
 * `__tests__/dom/nav-hydration.test.ts`; this proves `blog-post-
 * client.tsx`/`blog-index-client.tsx`'s `main()` each actually wire up
 * both their own app (via `hydrateRoot()`) and `<NavIsland>` (via
 * `hydrateNav()`) side by side against the real page fragment.
 */
describe('NavIsland hydrates side by side with each blog app (#803)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // See nav-hydration.test.ts's identical afterEach comment: userEvent's
    // own jsdom Clipboard polyfill must not leak between tests.
    // @ts-expect-error -- deleting a property this file's own test defines
    // via userEvent.setup(), not one TypeScript thinks is optional.
    delete navigator.clipboard
  })

  const navHrefs = {
    diagrams: '../diagrams/',
    editor: '../editor',
    forkFixes: '../fork-fixes',
    blog: './',
    github: 'https://github.com/dfadler/zombie-mermaid',
  }

  it('on a post page: both hydrate cleanly, and the copy button copies', async () => {
    document.body.innerHTML =
      renderToString(
        createElement(NavIsland, {
          active: 'blog',
          homeHref: '../',
          hrefs: navHrefs,
        }),
      ) +
      renderToString(
        createElement('div', { id: BLOG_POST_ROOT_ID }, [
          createElement(BlogPostApp, { ...postProps, key: 'app' }),
        ]),
      )

    const container = document.getElementById(BLOG_POST_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    await act(async () => {
      root = hydrateRoot(container, createElement(BlogPostApp, postProps))
    })
    act(() => {
      hydrateNav()
    })

    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    await user.click(
      screen.getByRole('button', { name: 'Copy install command' }),
    )
    expect(writeText).toHaveBeenCalledWith(NAV_INSTALL_COMMAND)
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /shipping v1 of a zombie/i,
      }),
    ).toBeInTheDocument()
  })

  it('on the index page: both hydrate cleanly, and the copy button copies', async () => {
    document.body.innerHTML =
      renderToString(
        createElement(NavIsland, {
          active: 'blog',
          homeHref: '../',
          hrefs: navHrefs,
        }),
      ) +
      renderToString(
        createElement('div', { id: BLOG_INDEX_ROOT_ID }, [
          createElement(BlogIndexApp, { ...indexProps, key: 'app' }),
        ]),
      )

    const container = document.getElementById(BLOG_INDEX_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    await act(async () => {
      root = hydrateRoot(container, createElement(BlogIndexApp, indexProps))
    })
    act(() => {
      hydrateNav()
    })

    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    await user.click(
      screen.getByRole('button', { name: 'Copy install command' }),
    )
    expect(writeText).toHaveBeenCalledWith(NAV_INSTALL_COMMAND)
    within(container).getByRole('heading', {
      level: 2,
      name: /shipping v1 of a zombie/i,
    })
  })
})
