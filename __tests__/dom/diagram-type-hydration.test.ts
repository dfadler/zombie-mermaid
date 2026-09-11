// @vitest-environment jsdom
/**
 * Proves the #799/#800 SSR -> hydrate pattern
 * (`__tests__/dom/dashboard-hydration.test.ts`'s pattern for
 * `DashboardApp`) works for `DiagramTypeApp`/`DiagramHubApp` too
 * (zombie-mermaid#805): hydrates cleanly against server-rendered markup,
 * including the embedded `<svg>`/shiki `dangerouslySetInnerHTML` content
 * (the source panel, the primary diagram, and every "More examples"
 * gallery thumbnail), for both the single-orientation and wide/narrow
 * orientation-alternate shapes `OrientationVariants` supports.
 *
 * This file covers the *clean* hydration case (no theme pre-selected) --
 * `demo/diagram-type-client.tsx`'s own re-theming behavior (the legacy
 * key migration, cross-tab sync, per-property CSS variable swap) is
 * already covered end to end by `__tests__/demo-diagram-page-client.test.ts`,
 * including confirming (via `flushSync()`) that a *returning* visitor's
 * immediate re-theme after hydration produces no hydration-mismatch
 * warning either -- not just the clean case this file exercises.
 *
 * Also covers this issue's acceptance criterion that Nav's copy button
 * works via real click interaction on both page types.
 */
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  DiagramTypeApp,
  DIAGRAM_TYPE_PROPS_ELEMENT_ID,
  DIAGRAM_TYPE_ROOT_ID,
  type DiagramTypeAppProps,
} from '../../demo/components/diagram-type-app.tsx'
import {
  DiagramHubApp,
  DIAGRAM_HUB_PROPS_ELEMENT_ID,
  DIAGRAM_HUB_ROOT_ID,
  type DiagramHubAppProps,
} from '../../demo/components/diagram-hub-app.tsx'
import {
  DiagramDetailApp,
  DIAGRAM_DETAIL_PROPS_ELEMENT_ID,
  DIAGRAM_DETAIL_ROOT_ID,
  type DiagramDetailAppProps,
} from '../../demo/components/diagram-detail-app.tsx'
import { NavIsland } from '../../demo/components/nav-island.tsx'
import { NAV_INSTALL_COMMAND } from '../../demo/components/nav.tsx'
import { hydrateNav } from '../../demo/nav-client.tsx'

const SINGLE_ORIENTATION_PROPS: DiagramTypeAppProps = {
  label: 'Flowchart',
  slug: 'flowchart',
  intro: 'Flowcharts show a process as boxes and arrows.',
  accent: 'blue',
  exampleHeading: 'A deploy pipeline, start to finish.',
  sourceFilename: 'pipeline.mmd',
  sourcePanelHtml: '<pre class="shiki"><code>flowchart LR</code></pre>',
  diagramHtml: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  editorHref: '../editor#test',
  galleryItems: [
    {
      title: 'Gallery sample',
      diagramHtml: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      editorHref: '../editor#gallery-test',
    },
  ],
  types: [{ slug: 'sequence', label: 'Sequence diagram', accent: 'cyan' }],
}

const ORIENTATION_ALTERNATE_PROPS: DiagramTypeAppProps = {
  ...SINGLE_ORIENTATION_PROPS,
  sourcePanelHtml: {
    wide: '<pre class="shiki"><code>flowchart LR</code></pre>',
    narrow: '<pre class="shiki"><code>flowchart TD</code></pre>',
  },
  diagramHtml: {
    wide: '<svg xmlns="http://www.w3.org/2000/svg" data-o="wide"></svg>',
    narrow: '<svg xmlns="http://www.w3.org/2000/svg" data-o="narrow"></svg>',
  },
}

const HUB_PROPS: DiagramHubAppProps = {
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
}

const DETAIL_PROPS: DiagramDetailAppProps = {
  typeLabel: 'Flowchart',
  typeHref: '../flowchart.html',
  accent: 'blue',
  sampleTitle: 'CI/CD Pipeline',
  sampleDescription: 'A realistic CI/CD pipeline with decision points.',
  sourceFilename: 'ci-cd-pipeline.mmd',
  sourceHtml: '<pre class="shiki"><code>graph TD</code></pre>',
  svgHtml:
    '<svg xmlns="http://www.w3.org/2000/svg" data-diagram="detail-svg"></svg>',
  asciiHtml: '<span style="color:#27272A">detail-ascii-output</span>',
  editorHref: '../../editor#test',
  moreFromType: [
    {
      title: 'Simple Flow',
      href: './simple-flow.html',
      diagramHtml: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    },
  ],
}

let root: Root | undefined

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

describe.each([
  ['single orientation', SINGLE_ORIENTATION_PROPS],
  ['wide/narrow orientation alternate', ORIENTATION_ALTERNATE_PROPS],
])('DiagramTypeApp hydration (#805) — %s', (_label, props) => {
  function renderServerHtmlIntoDocument(): void {
    document.body.innerHTML = renderToString(
      createElement('div', { id: DIAGRAM_TYPE_ROOT_ID }, [
        createElement(DiagramTypeApp, { ...props, key: 'app' }),
      ]),
    )
  }

  it('hydrates against server-rendered markup, including the embedded svg/shiki content, with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(DIAGRAM_TYPE_ROOT_ID)
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
        root = hydrateRoot(container, createElement(DiagramTypeApp, props))
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

  it('renders the real heading and gallery content once hydrated', () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(DIAGRAM_TYPE_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    act(() => {
      root = hydrateRoot(container, createElement(DiagramTypeApp, props))
    })

    expect(
      screen.getByRole('heading', { level: 1, name: /flowchart/i }),
    ).toBeInTheDocument()
    expect(document.querySelector('.diagram-frame svg')).not.toBeNull()
    expect(document.querySelector('.gallery-thumb svg')).not.toBeNull()
  })
})

describe('demo/diagram-type-client.tsx props contract', () => {
  it("diagram-page.tsx's embedded JSON round-trips through DIAGRAM_TYPE_PROPS_ELEMENT_ID exactly as the client reads it", () => {
    const scriptEl = document.createElement('script')
    scriptEl.type = 'application/json'
    scriptEl.id = DIAGRAM_TYPE_PROPS_ELEMENT_ID
    scriptEl.textContent = JSON.stringify(SINGLE_ORIENTATION_PROPS)
    document.body.appendChild(scriptEl)

    const read = document.getElementById(DIAGRAM_TYPE_PROPS_ELEMENT_ID)
    expect(read?.textContent).toBeTruthy()
    expect(JSON.parse(read?.textContent ?? '')).toEqual(
      SINGLE_ORIENTATION_PROPS,
    )
  })
})

describe('DiagramHubApp hydration (#805)', () => {
  function renderServerHtmlIntoDocument(): void {
    document.body.innerHTML = renderToString(
      createElement('div', { id: DIAGRAM_HUB_ROOT_ID }, [
        createElement(DiagramHubApp, { ...HUB_PROPS, key: 'app' }),
      ]),
    )
  }

  it('hydrates against server-rendered markup with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(DIAGRAM_HUB_ROOT_ID)
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
        root = hydrateRoot(container, createElement(DiagramHubApp, HUB_PROPS))
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

  it('renders the real type rows once hydrated', () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(DIAGRAM_HUB_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    act(() => {
      root = hydrateRoot(container, createElement(DiagramHubApp, HUB_PROPS))
    })

    expect(
      screen.getByRole('heading', { level: 2, name: /^flowchart$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /sequence diagram/i }),
    ).toBeInTheDocument()
  })
})

/**
 * #805's acceptance criterion: Nav's copy button must work via real click
 * interaction. `<Nav>`'s behavior in isolation is already covered by
 * `nav-hydration.test.ts`; this proves `diagram-type-client.tsx`'s (and,
 * for the hub, `diagram-hub-client.tsx`'s) `main()`/top-level code
 * actually wires up both the page's own app and `<NavIsland>` side by
 * side against the real page fragment.
 */
describe('demo/diagram-hub-client.tsx props contract', () => {
  it("diagram-page.tsx's embedded JSON round-trips through DIAGRAM_HUB_PROPS_ELEMENT_ID exactly as the client reads it", () => {
    const scriptEl = document.createElement('script')
    scriptEl.type = 'application/json'
    scriptEl.id = DIAGRAM_HUB_PROPS_ELEMENT_ID
    scriptEl.textContent = JSON.stringify(HUB_PROPS)
    document.body.appendChild(scriptEl)

    const read = document.getElementById(DIAGRAM_HUB_PROPS_ELEMENT_ID)
    expect(read?.textContent).toBeTruthy()
    expect(JSON.parse(read?.textContent ?? '')).toEqual(HUB_PROPS)
  })
})

describe('NavIsland hydrates side by side with each diagram app (#805)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // See nav-hydration.test.ts's identical afterEach comment: userEvent's
    // own jsdom Clipboard polyfill must not leak between tests.
    // @ts-expect-error -- deleting a property this file's own test defines
    // via userEvent.setup(), not one TypeScript thinks is optional.
    delete navigator.clipboard
  })

  const navHrefs = {
    diagrams: './',
    editor: '../editor',
    forkFixes: '../fork-fixes.html',
    blog: '../blog/',
    github: 'https://github.com/dfadler/zombie-mermaid',
  }

  it('on a type page: both hydrate cleanly, and the copy button copies', async () => {
    document.body.innerHTML =
      renderToString(
        createElement(NavIsland, {
          active: 'diagrams',
          homeHref: '../',
          hrefs: navHrefs,
        }),
      ) +
      renderToString(
        createElement('div', { id: DIAGRAM_TYPE_ROOT_ID }, [
          createElement(DiagramTypeApp, {
            ...SINGLE_ORIENTATION_PROPS,
            key: 'app',
          }),
        ]),
      )

    const container = document.getElementById(DIAGRAM_TYPE_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    await act(async () => {
      root = hydrateRoot(
        container,
        createElement(DiagramTypeApp, SINGLE_ORIENTATION_PROPS),
      )
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
  })

  it('on the hub page: both hydrate cleanly, and the copy button copies', async () => {
    document.body.innerHTML =
      renderToString(
        createElement(NavIsland, {
          active: 'diagrams',
          homeHref: '../',
          hrefs: navHrefs,
        }),
      ) +
      renderToString(
        createElement('div', { id: DIAGRAM_HUB_ROOT_ID }, [
          createElement(DiagramHubApp, { ...HUB_PROPS, key: 'app' }),
        ]),
      )

    const container = document.getElementById(DIAGRAM_HUB_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    await act(async () => {
      root = hydrateRoot(container, createElement(DiagramHubApp, HUB_PROPS))
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
  })
})

describe('DiagramDetailApp hydration (#989)', () => {
  function renderServerHtmlIntoDocument(): void {
    document.body.innerHTML = renderToString(
      createElement('div', { id: DIAGRAM_DETAIL_ROOT_ID }, [
        createElement(DiagramDetailApp, { ...DETAIL_PROPS, key: 'app' }),
      ]),
    )
  }

  it('hydrates against server-rendered markup, including the embedded svg/shiki content, with no console warnings/errors', async () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(DIAGRAM_DETAIL_ROOT_ID)
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
          createElement(DiagramDetailApp, DETAIL_PROPS),
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

  it('renders the real heading and SVG output once hydrated, then switches to ASCII and back on click', async () => {
    renderServerHtmlIntoDocument()
    const container = document.getElementById(DIAGRAM_DETAIL_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    act(() => {
      root = hydrateRoot(
        container,
        createElement(DiagramDetailApp, DETAIL_PROPS),
      )
    })

    expect(
      screen.getByRole('heading', { level: 1, name: 'CI/CD Pipeline' }),
    ).toBeInTheDocument()
    expect(
      document.querySelector('.diagram-frame svg[data-diagram="detail-svg"]'),
    ).not.toBeNull()
    expect(screen.queryByText('detail-ascii-output')).toBeNull()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'ASCII' }))
    expect(screen.getByText('detail-ascii-output')).toBeInTheDocument()
    expect(
      document.querySelector('.diagram-frame svg[data-diagram="detail-svg"]'),
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: 'SVG' }))
    expect(
      document.querySelector('.diagram-frame svg[data-diagram="detail-svg"]'),
    ).not.toBeNull()
    expect(screen.queryByText('detail-ascii-output')).toBeNull()
  })
})

describe('demo/diagram-detail-client.tsx props contract', () => {
  it("diagram-page.tsx's embedded JSON round-trips through DIAGRAM_DETAIL_PROPS_ELEMENT_ID exactly as the client reads it", () => {
    const scriptEl = document.createElement('script')
    scriptEl.type = 'application/json'
    scriptEl.id = DIAGRAM_DETAIL_PROPS_ELEMENT_ID
    scriptEl.textContent = JSON.stringify(DETAIL_PROPS)
    document.body.appendChild(scriptEl)

    const read = document.getElementById(DIAGRAM_DETAIL_PROPS_ELEMENT_ID)
    expect(read?.textContent).toBeTruthy()
    expect(JSON.parse(read?.textContent ?? '')).toEqual(DETAIL_PROPS)
  })
})
