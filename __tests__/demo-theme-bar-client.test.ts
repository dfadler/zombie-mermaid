// @vitest-environment jsdom
/**
 * Guards demo/components/theme-bar-client.ts, the interactive controller
 * #686 adds for the global ThemeBar/ThemePicker (site-chrome.tsx +
 * theme-picker.tsx) -- proving the component works correctly in isolation
 * per the issue's own acceptance criteria, since #687 (wiring it into an
 * actual page) hasn't happened yet:
 *
 * - theme selection persists via theme-state.ts (not ad-hoc localStorage)
 * - keyboard navigation (Tab is native-button-free; Escape and arrow keys
 *   are exercised directly here)
 * - the aria-expanded/aria-haspopup regression #281 fixed on the old
 *   picker stays fixed on the rebuilt one
 * - cross-tab sync (a `storage` event, same mechanism demo-theme-state.test.ts
 *   exercises against theme-state.ts directly) is reflected in the UI
 *
 * Markup comes from actually rendering ThemeBar/ThemePicker via
 * react-dom/server, the way every page generator does, rather than a
 * hand-written HTML fixture that could drift from the real components.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ThemeBar } from '../demo/components/site-chrome.tsx'
import { ThemePicker } from '../demo/components/theme-picker.tsx'
import { initThemeBar } from '../demo/components/theme-bar-client.ts'
import { THEME_STORAGE_KEY, getTheme } from '../demo/theme-state.ts'

/** Renders the real ThemeBar+ThemePicker markup, the way pages.ts does. */
function renderThemeBar(): string {
  return renderToStaticMarkup(
    createElement(
      ThemeBar,
      { homeHref: '../' },
      createElement(ThemePicker, { includeDefault: true }),
    ),
  )
}

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

let destroy: (() => void) | undefined

beforeEach(() => {
  window.localStorage.clear()
  document.body.innerHTML = renderThemeBar()
})

afterEach(() => {
  destroy?.()
  destroy = undefined
  document.body.innerHTML = ''
})

describe('when there is no theme bar in the given root', () => {
  it('returns a harmless no-op controller instead of throwing', () => {
    document.body.innerHTML = '<div>no theme bar here</div>'
    expect(() => {
      const controller = initThemeBar(document)
      controller.destroy()
    }).not.toThrow()
  })
})

describe('initial paint', () => {
  it('marks the Default pill active when nothing is stored', () => {
    destroy = initThemeBar(document).destroy
    for (const el of pill(''))
      expect(el.classList.contains('active')).toBe(true)
  })

  it('marks the stored theme active instead, everywhere it appears', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dracula')
    destroy = initThemeBar(document).destroy

    for (const el of pill(''))
      expect(el.classList.contains('active')).toBe(false)
    // dracula is an inline pill (INLINE_THEMES) -- only one instance.
    for (const el of pill('dracula')) {
      expect(el.classList.contains('active')).toBe(true)
    }
  })
})

describe('picking a theme', () => {
  it('persists through theme-state.ts, not a direct localStorage write', () => {
    destroy = initThemeBar(document).destroy
    const dracula = pill('dracula')[0]!

    dracula.click()

    expect(getTheme()).toBe('dracula')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dracula')
  })

  it('updates .active on every instance of the picked pill, including the dropdown copy of Default', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dracula')
    destroy = initThemeBar(document).destroy

    pill('')[0]!.click() // dropdown's own Default pill

    for (const el of pill(''))
      expect(el.classList.contains('active')).toBe(true)
    for (const el of pill('dracula')) {
      expect(el.classList.contains('active')).toBe(false)
    }
  })

  it('clears the stored preference for the Default pseudo-theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'nord')
    destroy = initThemeBar(document).destroy

    pill('')[0]!.click()

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('does not mistake the "More" trigger itself for a theme pill', () => {
    destroy = initThemeBar(document).destroy

    moreBtn().click()

    // Opening the dropdown must not have called setTheme with anything --
    // the stored preference stays untouched.
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })
})

describe('the "More" dropdown -- ARIA (#281 regression guard)', () => {
  it('starts with aria-haspopup and aria-expanded="false"', () => {
    destroy = initThemeBar(document).destroy
    expect(moreBtn().getAttribute('aria-haspopup')).toBe('true')
    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
  })

  it('flips aria-expanded and the .open class on click, and back on a second click', () => {
    destroy = initThemeBar(document).destroy

    moreBtn().click()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('true')
    expect(moreDropdown().classList.contains('open')).toBe(true)

    moreBtn().click()
    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
    expect(moreDropdown().classList.contains('open')).toBe(false)
  })

  it('closes and resets aria-expanded on an outside click', () => {
    destroy = initThemeBar(document).destroy
    moreBtn().click()

    document.body.click()

    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
    expect(moreDropdown().classList.contains('open')).toBe(false)
  })

  it('does not close on a click inside the dropdown wrapper that misses a pill', () => {
    destroy = initThemeBar(document).destroy
    moreBtn().click()

    moreDropdown().click()

    expect(moreDropdown().classList.contains('open')).toBe(true)
  })

  it('resets aria-expanded when a theme is picked from inside it', () => {
    destroy = initThemeBar(document).destroy
    moreBtn().click()

    // tokyo-night only appears in the dropdown (not an INLINE_THEMES entry).
    const tokyoNight = pill('tokyo-night').find((el) =>
      moreDropdown().contains(el),
    )!
    tokyoNight.click()

    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
    expect(moreDropdown().classList.contains('open')).toBe(false)
    expect(getTheme()).toBe('tokyo-night')
  })
})

describe('keyboard support', () => {
  it('Escape closes the dropdown and returns focus to the trigger', () => {
    destroy = initThemeBar(document).destroy
    moreBtn().click()
    pill('tokyo-night')[0]!.focus()

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )

    expect(moreBtn().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(moreBtn())
  })

  it('does nothing on Escape when the dropdown is already closed', () => {
    destroy = initThemeBar(document).destroy

    expect(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    ).not.toThrow()
    expect(document.activeElement).not.toBe(moreBtn())
  })

  it('ArrowDown/ArrowUp roam the dropdown pills and wrap at both ends', () => {
    destroy = initThemeBar(document).destroy
    moreBtn().click()

    const items = Array.from(
      moreDropdown().querySelectorAll<HTMLElement>('.theme-pill[data-theme]'),
    )
    expect(items.length).toBeGreaterThan(2)

    items[0]!.focus()
    moreDropdown().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    )
    expect(document.activeElement).toBe(items[1])

    // Wraps from the last pill back to the first.
    items[items.length - 1]!.focus()
    moreDropdown().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    )
    expect(document.activeElement).toBe(items[0])

    // Wraps from the first pill back to the last with ArrowUp.
    items[0]!.focus()
    moreDropdown().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    )
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it('Home/End jump to the first/last dropdown pill', () => {
    destroy = initThemeBar(document).destroy
    moreBtn().click()

    const items = Array.from(
      moreDropdown().querySelectorAll<HTMLElement>('.theme-pill[data-theme]'),
    )
    items[2]!.focus()

    moreDropdown().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
    )
    expect(document.activeElement).toBe(items[items.length - 1])

    moreDropdown().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
    )
    expect(document.activeElement).toBe(items[0])
  })
})

describe('cross-tab sync', () => {
  it('reflects a theme change made in another tab without a click here', () => {
    destroy = initThemeBar(document).destroy

    window.dispatchEvent(
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
    destroy = initThemeBar(document).destroy

    window.dispatchEvent(
      new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: null }),
    )

    for (const el of pill(''))
      expect(el.classList.contains('active')).toBe(true)
  })
})

describe('destroy()', () => {
  it('stops reacting to clicks and cross-tab sync alike', () => {
    const controller = initThemeBar(document)
    controller.destroy()

    pill('dracula')[0]!.click()
    expect(getTheme()).toBe('')

    window.dispatchEvent(
      new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'nord' }),
    )
    for (const el of pill(''))
      expect(el.classList.contains('active')).toBe(true)
  })

  it('is safe to call on the no-op controller', () => {
    document.body.innerHTML = '<div>no theme bar here</div>'
    expect(() => initThemeBar(document).destroy()).not.toThrow()
  })
})
