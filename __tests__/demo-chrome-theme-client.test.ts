// @vitest-environment jsdom
/**
 * Guards `demo/chrome-theme-client.ts`'s `initChromeTheme()` — #772's fix
 * for site chrome (Nav/Footer/cards) not re-theming, only diagrams. Builds
 * a minimal DOM standing in for `tokens.tsx`'s `:root{}` defaults and
 * `nav.tsx`'s `.nav-bar`, rather than rendering the real page components,
 * since only the reactive-override mechanics are under test here (the
 * derivation itself is `__tests__/demo-chrome-theme.test.ts`'s job).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { initChromeTheme } from '../demo/chrome-theme-client.ts'
import { THEME_STORAGE_KEY, setTheme } from '../demo/theme-state.ts'

const COLORS = {
  nord: { bg: '#2e3440', fg: '#d8dee9' },
  dracula: { bg: '#282a36', fg: '#f8f8f2' },
}

// jsdom normalizes an assigned `rgba(r,g,b,a)` background to spaced commas
// when read back via `.style.background` — match that normalization rather
// than the compact format `chrome-theme-client.ts` itself writes.
const DEFAULT_NAV_BG = 'rgba(10, 13, 22, 0.85)'

let controller: ReturnType<typeof initChromeTheme> | undefined

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('style')
  document.body.innerHTML = `<div class="nav-bar" style="background: ${DEFAULT_NAV_BG}"></div>`
})

afterEach(() => {
  controller?.destroy()
  controller = undefined
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('style')
})

describe('initial paint', () => {
  it('leaves the root untouched when nothing is stored', () => {
    controller = initChromeTheme(COLORS)
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('')
    expect(
      document.querySelector<HTMLElement>('.nav-bar')!.style.background,
    ).toBe(DEFAULT_NAV_BG)
  })

  it('applies a previously stored theme immediately', () => {
    setTheme('nord')
    controller = initChromeTheme(COLORS)
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe(
      '#2e3440',
    )
    expect(
      document.querySelector<HTMLElement>('.nav-bar')!.style.background,
    ).toBe('rgba(46, 52, 64, 0.85)')
  })

  it('ignores a stored key with no matching color entry', () => {
    setTheme('not-a-real-theme')
    controller = initChromeTheme(COLORS)
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('')
  })
})

describe('live changes', () => {
  it('re-applies every reactive token when the theme changes', () => {
    controller = initChromeTheme(COLORS)
    setTheme('dracula')
    const root = document.documentElement.style
    expect(root.getPropertyValue('--bg')).toBe('#282a36')
    expect(root.getPropertyValue('--text')).toBe('#f8f8f2')
    expect(root.getPropertyValue('--panel')).toContain('color-mix(')
    expect(
      document.querySelector<HTMLElement>('.nav-bar')!.style.background,
    ).toBe('rgba(40, 42, 54, 0.85)')
  })

  it('restores the exact original nav-bar background on Default', () => {
    controller = initChromeTheme(COLORS)
    setTheme('nord')
    setTheme('')
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('')
    expect(
      document.querySelector<HTMLElement>('.nav-bar')!.style.background,
    ).toBe(DEFAULT_NAV_BG)
  })

  it('reacts to cross-tab changes via the storage event, same as theme-bar-client', () => {
    controller = initChromeTheme(COLORS)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: THEME_STORAGE_KEY,
        newValue: 'dracula',
      }),
    )
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe(
      '#282a36',
    )
  })
})

describe('destroy()', () => {
  it('stops reacting to further theme changes', () => {
    controller = initChromeTheme(COLORS)
    controller.destroy()
    setTheme('nord')
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('')
  })
})

describe('when there is no .nav-bar in the document', () => {
  it('still applies the root tokens without throwing', () => {
    document.body.innerHTML = ''
    setTheme('nord')
    expect(() => {
      controller = initChromeTheme(COLORS)
    }).not.toThrow()
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe(
      '#2e3440',
    )
  })
})

// editor-page.tsx's own literal-value .zm-shell rule shadows anything
// inherited from document.documentElement, so a root-only override would
// be invisible there -- see chrome-theme-client.ts's own module doc
// comment for the full explanation. These guard the extra per-element
// pass that makes it visible anyway.
describe('.zm-shell elements (editor-page.tsx)', () => {
  beforeEach(() => {
    // No inline style, matching production: the default palette there comes
    // from editor-page.tsx's own `.zm-shell { --bg: #0a0d16; … }` stylesheet
    // rule, not an inline one -- unlike `.nav-bar`'s background, this module
    // never needs to capture/restore an original value for these elements.
    document.body.innerHTML += `
      <div class="zm-shell"></div>
      <div class="zm-shell"></div>
    `
  })

  it('overrides every .zm-shell element inline, not just the root', () => {
    controller = initChromeTheme(COLORS)
    setTheme('dracula')
    const shells = document.querySelectorAll<HTMLElement>('.zm-shell')
    expect(shells).toHaveLength(2)
    for (const shell of shells) {
      expect(shell.style.getPropertyValue('--bg')).toBe('#282a36')
    }
  })

  it('restores each .zm-shell element to its own authored rule on Default', () => {
    controller = initChromeTheme(COLORS)
    setTheme('nord')
    setTheme('')
    for (const shell of document.querySelectorAll<HTMLElement>('.zm-shell')) {
      // removeProperty(), not reset to the pre-theme literal: the same
      // "fall back to the stylesheet cleanly" contract initChromeTheme()
      // already documents for the root.
      expect(shell.style.getPropertyValue('--bg')).toBe('')
    }
  })
})
