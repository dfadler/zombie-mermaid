// @vitest-environment jsdom
/**
 * Proves two things about `<Nav>`'s install-copy button now that it's real
 * React state instead of `NAV_COPY_SCRIPT` (zombie-mermaid#800):
 *
 * 1. It actually works, driven the way a user would — this repo's RTL
 *    pattern (`__tests__/dom/rtl-example.test.ts`'s worked example): click
 *    the pill, assert the clipboard call and the "copied" flash, same for
 *    keyboard activation. `__tests__/demo-nav.test.ts` still owns the
 *    canvas-fidelity markup pinning (colors, layout, structure); this file
 *    owns the behavior those static assertions can't express.
 * 2. It hydrates cleanly — no console warning/error — against the exact
 *    markup `demo/components/nav-island.tsx`'s `NavIsland` renders
 *    server-side, the same "SSR via renderToString into jsdom, then
 *    hydrateRoot against it, assert no console noise" proof
 *    `__tests__/dom/dashboard-hydration.test.ts` established for
 *    `DashboardApp` in #799.
 *
 * Clipboard note: `@testing-library/user-event`'s `setup()` installs its
 * *own* jsdom `Clipboard` polyfill onto `navigator.clipboard` the first
 * time it runs (jsdom itself has none) — so every test below spies on
 * `navigator.clipboard.writeText` with `vi.spyOn()` *after* calling
 * `userEvent.setup()`, rather than replacing `navigator.clipboard` with a
 * hand-rolled stub beforehand. An earlier version of this file did the
 * latter and every assertion silently saw zero calls: `userEvent.setup()`
 * clobbers a pre-installed `navigator.clipboard` with its own polyfill
 * object, so a `writeText` reference captured before `setup()` stops being
 * the one `NavInstall`'s `copyCommand` actually calls. Confirmed by
 * comparing object identity before/after `setup()` while debugging this
 * test — worth recording so a future edit doesn't reintroduce it.
 */
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  NAV_INSTALL_COMMAND,
  NAV_ROOT_ID,
  Nav,
  type NavProps,
} from '../../demo/components/nav.tsx'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  // `userEvent.setup()` installs its own jsdom `Clipboard` polyfill onto
  // `navigator.clipboard` at most once and leaves it there across tests
  // (it doesn't reinstall over an existing one), and a test that stubs
  // `navigator.clipboard` directly via `Object.defineProperty` leaves that
  // object behind the same way -- either way, a leftover `writeText` from
  // one test is exactly the function a later `vi.spyOn()` starts wrapping,
  // double-counting a call that never happened in that later test. Delete
  // the property outright so every test starts from jsdom's true default
  // (no `navigator.clipboard` at all) and installs whatever it needs
  // itself.
  // @ts-expect-error -- deleting a property this file's own tests define
  // via Object.defineProperty/userEvent.setup(), not one TypeScript thinks
  // is optional on Navigator.
  delete navigator.clipboard
})

describe('NavInstall copy behavior (#800)', () => {
  it('copies the install command to the clipboard on click and flashes success', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    render(createElement(Nav))

    const pill = screen.getByRole('button', { name: 'Copy install command' })
    expect(pill).toBeInTheDocument()

    const icon = pill.querySelector('svg')
    expect(icon).toHaveAttribute('stroke', 'var(--cyan)')

    await user.click(pill)

    expect(writeText).toHaveBeenCalledWith(NAV_INSTALL_COMMAND)
    expect(icon).toHaveAttribute('stroke', 'var(--green)')
  })

  it('reverts the flash after the feedback window elapses', async () => {
    // fireEvent, not userEvent.click(): userEvent's pointer sequence has
    // its own internal real-timer waits that hang indefinitely once fake
    // timers are active and never advance them. fireEvent dispatches a
    // plain synchronous click with no such internals -- but also skips
    // userEvent.setup()'s own jsdom Clipboard install, so this test stubs
    // navigator.clipboard directly instead.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    render(createElement(Nav))

    const pill = screen.getByRole('button', { name: 'Copy install command' })
    const icon = pill.querySelector('svg')

    vi.useFakeTimers()
    try {
      await act(async () => {
        fireEvent.click(pill)
        // Flush the microtask navigator.clipboard.writeText(...).then(...)
        // queues -- fake timers don't advance real microtasks on their
        // own, so setCopied(true) wouldn't otherwise have run yet.
        await Promise.resolve()
      })
      expect(icon).toHaveAttribute('stroke', 'var(--green)')

      await act(async () => {
        vi.advanceTimersByTime(1200)
      })
      expect(icon).toHaveAttribute('stroke', 'var(--cyan)')
    } finally {
      vi.useRealTimers()
    }
  })

  it('is keyboard-activatable — Enter and Space both trigger a copy', () => {
    // fireEvent, not userEvent.keyboard(): userEvent simulates a browser's
    // own implicit "Enter/Space activates a role=button element" behavior
    // on top of whatever handler runs, double- (or triple-) counting a
    // single keypress against NavInstall's own `handleKeyDown`. fireEvent
    // dispatches exactly the keydown this component's own handler listens
    // for, with no such built-in emulation layered on top. It also skips
    // userEvent.setup()'s own jsdom Clipboard install, so this test stubs
    // navigator.clipboard directly instead.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    render(createElement(Nav))

    const pill = screen.getByRole('button', { name: 'Copy install command' })

    fireEvent.keyDown(pill, { key: 'Enter' })
    expect(writeText).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(pill, { key: ' ' })
    expect(writeText).toHaveBeenCalledTimes(2)

    // Any other key is a no-op.
    fireEvent.keyDown(pill, { key: 'a' })
    expect(writeText).toHaveBeenCalledTimes(2)
  })

  it('does nothing when the Clipboard API is unavailable', () => {
    // fireEvent, not userEvent: userEvent.setup() itself installs a jsdom
    // Clipboard polyfill onto navigator.clipboard (see the module doc
    // comment), which would defeat the exact case this test covers.
    // fireEvent dispatches a plain DOM event with no such side effect, so
    // navigator.clipboard stays whatever jsdom's default is (undefined) --
    // the same "no Clipboard API" case NAV_COPY_SCRIPT's own
    // `!navigator.clipboard` guard used to cover.
    render(createElement(Nav))

    const pill = screen.getByRole('button', { name: 'Copy install command' })
    const icon = pill.querySelector('svg')

    expect(() => fireEvent.click(pill)).not.toThrow()
    // No error thrown, and no false "copied" flash.
    expect(icon).toHaveAttribute('stroke', 'var(--cyan)')
  })

  it('lets a page override the install command, and copies that instead', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    const command = 'pnpm add zombie-mermaid'
    render(createElement(Nav, { installCommand: command } satisfies NavProps))

    await user.click(
      screen.getByRole('button', { name: 'Copy install command' }),
    )
    expect(writeText).toHaveBeenCalledWith(command)
  })
})

describe('<Nav> hydration (#800)', () => {
  let root: Root | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
  })

  /**
   * Mirrors what `demo/components/nav-island.tsx`'s `NavIsland` actually
   * renders server-side: a plain `id={NAV_ROOT_ID}` wrapper holding `<Nav
   * .../>`'s `renderToString` output -- see that component's doc comment
   * for why `renderToString` (hydration-boundary comments) rather than
   * `renderToStaticMarkup`, and `DASHBOARD_ROOT_ID`'s doc comment
   * (dashboard-app.tsx) for why the id lives on a separate wrapper rather
   * than on `<Nav>`'s own root.
   */
  function renderServerHtmlIntoDocument(props: NavProps): void {
    document.body.innerHTML = renderToString(
      createElement('div', { id: NAV_ROOT_ID }, [
        createElement(Nav, { ...props, key: 'nav' }),
      ]),
    )
  }

  it('hydrates against server-rendered markup with no console warnings/errors', async () => {
    const props: NavProps = {
      active: 'blog',
      homeHref: '../',
      hrefs: { blog: './' },
    }
    renderServerHtmlIntoDocument(props)
    const container = document.getElementById(NAV_ROOT_ID)
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
        root = hydrateRoot(container, createElement(Nav, props))
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

  it('is interactive immediately after hydration, not just on the next render', async () => {
    const props: NavProps = {}
    renderServerHtmlIntoDocument(props)
    const container = document.getElementById(NAV_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    await act(async () => {
      root = hydrateRoot(container, createElement(Nav, props))
    })

    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    const pill = screen.getByRole('button', { name: 'Copy install command' })
    await user.click(pill)

    expect(writeText).toHaveBeenCalledWith(NAV_INSTALL_COMMAND)
  })
})
