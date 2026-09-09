// @vitest-environment jsdom
/**
 * Guards `demo/components/theme-picker.tsx`'s `ThemePicker` now that it's a
 * real hydrated React component (zombie-mermaid#801) rather than static
 * markup wired up after the fact by the deleted
 * `demo/components/theme-bar-client.ts`'s `initThemeBar()`. Replaces
 * `__tests__/demo-theme-bar-client.test.ts`, which tested that imperative
 * controller directly -- same behavioral coverage, driven through RTL's
 * `render()`/`fireEvent` against the real component instead of a hand-wired
 * DOM plus a separate controller object, per this repo's RTL pattern
 * (`__tests__/dom/rtl-example.test.ts`).
 *
 * Two tiers, mirroring `__tests__/dom/nav-hydration.test.ts`'s split for
 * `<Nav>`:
 *
 * 1. **Behavior** -- `render(createElement(ThemePicker, props))` directly,
 *    then drive it: theme selection persists via `theme-state.ts` (not ad
 *    hoc localStorage), the "More" dropdown's `aria-expanded`/`aria-haspopup`
 *    stay in sync (the #281 regression this component must never
 *    reintroduce), keyboard support (`Escape`/arrows/`Home`/`End`), and
 *    cross-tab sync via the `storage` event.
 * 2. **Hydration** -- proves the exact markup `demo/components/theme-
 *    picker-island.tsx`'s `ThemePickerIsland` renders server-side hydrates
 *    cleanly (no console warning/error) and is interactive immediately,
 *    plus that `demo/theme-bar-client.tsx`'s `hydrateThemeBar()` itself
 *    wires it up correctly (and no-ops harmlessly when there's no
 *    `#theme-pills` on the page).
 *
 * `ThemePicker` always renders every real pill twice (once inline, once in
 * the "More" dropdown -- see that component's own doc comment), so unlike
 * `NavInstall`'s test (one instance, `getByRole` by accessible name works
 * directly) these tests query by `.theme-pill[data-theme="…"]` instead --
 * the same disambiguator the deleted imperative test used, still the
 * pragmatic choice for a component with intentionally-duplicated real
 * affordances.
 */
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ThemePicker,
  THEME_PILLS_PROPS_ELEMENT_ID,
  THEME_PILLS_ROOT_ID,
  type ThemePickerProps,
} from '../../demo/components/theme-picker.tsx'
import { ThemePickerIsland } from '../../demo/components/theme-picker-island.tsx'
import { hydrateThemeBar } from '../../demo/theme-bar-client.tsx'
import { THEME_STORAGE_KEY, getTheme } from '../../demo/theme-state.ts'

function pill(themeKey: string): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      `.theme-pill[data-theme="${themeKey}"]`,
    ),
  )
}

function moreBtn(): HTMLButtonElement {
  const el = document.getElementById('theme-more-btn')
  if (!(el instanceof HTMLButtonElement)) throw new Error('missing more btn')
  return el
}

function moreDropdown(): HTMLElement {
  const el = document.getElementById('theme-more-dropdown')
  if (!el) throw new Error('missing dropdown')
  return el
}

const DEFAULT_PROPS: ThemePickerProps = {
  includeDefault: true,
  activeThemeKey: '',
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('initial paint', () => {
  it('marks the Default pill active when nothing is stored', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))
    for (const el of pill(''))
      expect(el.classList.contains('active')).toBe(true)
  })

  it('syncs to the stored theme once mounted, everywhere it appears', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dracula')
    render(createElement(ThemePicker, DEFAULT_PROPS))

    for (const el of pill(''))
      expect(el.classList.contains('active')).toBe(false)
    // dracula is an inline pill (INLINE_THEMES) -- appears inline + dropdown.
    for (const el of pill('dracula')) {
      expect(el.classList.contains('active')).toBe(true)
    }
  })
})

describe('picking a theme', () => {
  it('persists through theme-state.ts, not a direct localStorage write', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))
    const dracula = pill('dracula')[0]!

    fireEvent.click(dracula)

    expect(getTheme()).toBe('dracula')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dracula')
  })

  it('updates .active on every instance of the picked pill, including the dropdown copy of Default', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dracula')
    render(createElement(ThemePicker, DEFAULT_PROPS))

    fireEvent.click(pill('')[0]!) // dropdown's own Default pill

    for (const el of pill(''))
      expect(el.classList.contains('active')).toBe(true)
    for (const el of pill('dracula')) {
      expect(el.classList.contains('active')).toBe(false)
    }
  })

  it('clears the stored preference for the Default pseudo-theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'nord')
    render(createElement(ThemePicker, DEFAULT_PROPS))

    fireEvent.click(pill('')[0]!)

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('does not mistake the "More" trigger itself for a theme pill', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))

    fireEvent.click(moreBtn())

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })
})

describe('the "More" dropdown -- ARIA (#281 regression guard)', () => {
  it('starts with aria-haspopup and aria-expanded="false"', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))
    expect(moreBtn().getAttribute('aria-haspopup')).toBe('true')
    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
  })

  it('flips aria-expanded and the .open class on click, and back on a second click', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))

    fireEvent.click(moreBtn())
    expect(moreBtn().getAttribute('aria-expanded')).toBe('true')
    expect(moreDropdown().classList.contains('open')).toBe(true)

    fireEvent.click(moreBtn())
    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
    expect(moreDropdown().classList.contains('open')).toBe(false)
  })

  it('closes and resets aria-expanded on an outside click', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))
    fireEvent.click(moreBtn())

    fireEvent.click(document.body)

    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
    expect(moreDropdown().classList.contains('open')).toBe(false)
  })

  it('does not close on a click inside the dropdown wrapper that misses a pill', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))
    fireEvent.click(moreBtn())

    fireEvent.click(moreDropdown())

    expect(moreDropdown().classList.contains('open')).toBe(true)
  })

  it('resets aria-expanded when a theme is picked from inside it', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))
    fireEvent.click(moreBtn())

    // tokyo-night only appears in the dropdown (not an INLINE_THEMES entry).
    const tokyoNight = pill('tokyo-night').find((el) =>
      moreDropdown().contains(el),
    )!
    fireEvent.click(tokyoNight)

    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
    expect(moreDropdown().classList.contains('open')).toBe(false)
    expect(getTheme()).toBe('tokyo-night')
  })
})

describe('keyboard support', () => {
  it('Escape closes the dropdown and returns focus to the trigger', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))
    fireEvent.click(moreBtn())
    pill('tokyo-night')[0]!.focus()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(moreBtn())
  })

  it('does nothing on Escape when the dropdown is already closed', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))

    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow()
    expect(document.activeElement).not.toBe(moreBtn())
  })

  it('ArrowDown/ArrowUp roam the dropdown pills and wrap at both ends', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))
    fireEvent.click(moreBtn())

    const items = Array.from(
      moreDropdown().querySelectorAll<HTMLElement>('.theme-pill[data-theme]'),
    )
    expect(items.length).toBeGreaterThan(2)

    items[0]!.focus()
    fireEvent.keyDown(moreDropdown(), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])

    items[items.length - 1]!.focus()
    fireEvent.keyDown(moreDropdown(), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])

    items[0]!.focus()
    fireEvent.keyDown(moreDropdown(), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it('Home/End jump to the first/last dropdown pill', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))
    fireEvent.click(moreBtn())

    const items = Array.from(
      moreDropdown().querySelectorAll<HTMLElement>('.theme-pill[data-theme]'),
    )
    items[2]!.focus()

    fireEvent.keyDown(moreDropdown(), { key: 'End' })
    expect(document.activeElement).toBe(items[items.length - 1])

    fireEvent.keyDown(moreDropdown(), { key: 'Home' })
    expect(document.activeElement).toBe(items[0])
  })
})

describe('cross-tab sync', () => {
  it('reflects a theme change made in another tab without a click here', () => {
    render(createElement(ThemePicker, DEFAULT_PROPS))

    fireEvent(
      window,
      new StorageEvent('storage', {
        key: THEME_STORAGE_KEY,
        newValue: 'tokyo-night',
      }),
    )

    for (const el of pill('tokyo-night')) {
      expect(el.classList.contains('active')).toBe(true)
    }
    for (const el of pill(''))
      expect(el.classList.contains('active')).toBe(false)
  })

  it('treats a cross-tab clear as a return to Default', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'nord')
    render(createElement(ThemePicker, DEFAULT_PROPS))

    fireEvent(
      window,
      new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: null }),
    )

    for (const el of pill(''))
      expect(el.classList.contains('active')).toBe(true)
  })
})

describe('hydration (#801)', () => {
  let root: Root | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
  })

  /**
   * Mirrors what `ThemePickerIsland` actually renders server-side: the
   * `#theme-pills` wrapper holding `<ThemePicker .../>`'s `renderToString`
   * output. `ThemePickerIsland` itself also embeds the JSON props script
   * `hydrateThemeBar()` reads -- reused directly here (via `renderToString`
   * on the whole island, into a real document) rather than hand-built, so a
   * future prop/markup drift in that component breaks this test instead of
   * silently going unnoticed.
   */
  function renderServerHtmlIntoDocument(props: ThemePickerProps): void {
    document.body.innerHTML = renderToString(
      createElement(ThemePickerIsland, props),
    )
  }

  it('hydrates against server-rendered markup with no console warnings/errors', async () => {
    const props: ThemePickerProps = { includeDefault: true, activeThemeKey: '' }
    renderServerHtmlIntoDocument(props)
    const container = document.getElementById(THEME_PILLS_ROOT_ID)
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
        root = hydrateRoot(container, createElement(ThemePicker, props))
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
    const props: ThemePickerProps = { includeDefault: true, activeThemeKey: '' }
    renderServerHtmlIntoDocument(props)
    const container = document.getElementById(THEME_PILLS_ROOT_ID)
    if (!container) throw new Error('test setup: root container missing')

    await act(async () => {
      root = hydrateRoot(container, createElement(ThemePicker, props))
    })

    fireEvent.click(pill('dracula')[0]!)
    expect(getTheme()).toBe('dracula')
  })

  describe('hydrateThemeBar()', () => {
    it('no-ops harmlessly when there is no #theme-pills on the page', () => {
      document.body.innerHTML = '<div>no theme bar here</div>'
      expect(() => hydrateThemeBar()).not.toThrow()
    })

    it('hydrates the real island markup and makes it clickable', () => {
      renderServerHtmlIntoDocument({ includeDefault: true, activeThemeKey: '' })
      expect(
        document.getElementById(THEME_PILLS_PROPS_ELEMENT_ID),
      ).not.toBeNull()

      act(() => {
        hydrateThemeBar()
      })

      fireEvent.click(pill('dracula')[0]!)
      expect(getTheme()).toBe('dracula')
    })
  })
})
