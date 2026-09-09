// @vitest-environment jsdom
/**
 * Guards demo/diagram-page-client.ts's #687 reconciliation onto the shared
 * demo/theme-state.ts + (as of #801) `demo/theme-bar-client.tsx`'s
 * `hydrateThemeBar()` (see that file's header comment for the full
 * rationale). Two behaviors are new/changed and worth locking in directly,
 * since neither had unit coverage before this file existed:
 *
 * - the legacy 'zm-diagram-page-theme' key migration now goes through
 *   setTheme() (persist + notify), not a raw localStorage write
 * - this page's own re-theming (svg + page chrome + editor link) now runs
 *   as a theme-state.ts subscribe() listener, so it reacts to a theme
 *   change made anywhere -- not just this page's own (now-hydrated)
 *   `#theme-pills` click handling, which `__tests__/dom/theme-picker.test.ts`
 *   already covers directly.
 *
 * The module runs its wiring as side effects at import time (mirroring how
 * it actually runs in a real page load), so every test builds the DOM/
 * window globals it expects *before* a fresh dynamic import -- `vi.
 * resetModules()` between tests, since a second import would otherwise
 * reuse the first run's already-executed top-level code.
 *
 * `#theme-pills` itself is now a hydration island (#801): `buildDom()`
 * renders the real `ThemePickerIsland` server-side (via `renderToString`,
 * the same technique `pages.ts` actually uses) rather than hand-typing
 * static pill markup, so `hydrateThemeBar()` -- called by
 * `diagram-page-client.ts`'s own top-level code -- has real, matching
 * markup plus the JSON props script to hydrate against.
 */
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemePickerIsland } from '../demo/components/theme-picker-island.tsx'
import { THEME_STORAGE_KEY, getTheme } from '../demo/theme-state.ts'

const THEMES = {
  '': { bg: '#FFFFFF', fg: '#27272A' },
  dracula: { bg: '#282a36', fg: '#f8f8f2', accent: '#bd93f9' },
  nord: { bg: '#2e3440', fg: '#d8dee9', accent: '#88c0d0' },
  'one-dark': {
    bg: '#282c34',
    fg: '#abb2bf',
    line: '#4b5263',
    accent: '#c678dd',
    muted: '#5c6370',
    surface: '#21252b',
    border: '#3e4451',
  },
}

/**
 * Builds the DOM a diagram-type page renders, per diagram-page.tsx --
 * `#theme-pills` is the real `ThemePickerIsland` server output (matching
 * what `pages.ts` actually generates), not hand-typed markup, so
 * `hydrateThemeBar()` has real matching structure + JSON props to hydrate.
 */
function buildDom(): void {
  const themePillsHtml = renderToString(
    createElement(ThemePickerIsland, {
      includeDefault: true,
      activeThemeKey: '',
    }),
  )
  document.body.innerHTML = `
    ${themePillsHtml}
    <div class="diagram-frame">
      <svg xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
    <div class="gallery-thumb">
      <svg xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
    <a class="cta-btn primary" href="../editor"></a>
  `
}

function svg(): SVGSVGElement {
  const el = document.querySelector('.diagram-frame svg')
  if (!(el instanceof SVGSVGElement)) throw new Error('missing diagram svg')
  return el
}

function galleryThumbSvg(): SVGSVGElement {
  const el = document.querySelector('.gallery-thumb svg')
  if (!(el instanceof SVGSVGElement))
    throw new Error('missing gallery thumb svg')
  return el
}

beforeEach(() => {
  vi.resetModules()
  window.localStorage.clear()
  buildDom()
  window.__diagramPageThemes = THEMES
  window.__diagramPageSource = 'graph TD\n  A --> B'
  window.__diagramPageNarrowSource = null
  // jsdom doesn't implement matchMedia -- stub a MediaQueryList-shaped
  // object wide enough for the narrow-viewport code paths to no-op safely.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    media: '(max-width: 640px)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('legacy theme-key migration', () => {
  it('migrates zm-diagram-page-theme through setTheme (persist + notify)', async () => {
    window.localStorage.setItem('zm-diagram-page-theme', 'nord')
    await import('../demo/diagram-page-client.ts')

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('nord')
    expect(getTheme()).toBe('nord')
    // The re-theme this migration triggers (via setTheme's subscribe()
    // notification) actually ran -- not just the persistence.
    expect(svg().style.getPropertyValue('--bg')).toBe('#2e3440')
  })

  it('discards the legacy key either way, even with nothing to migrate', async () => {
    await import('../demo/diagram-page-client.ts')
    expect(window.localStorage.getItem('zm-diagram-page-theme')).toBeNull()
  })

  it('does not overwrite an already-set shared preference with the legacy key', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dracula')
    window.localStorage.setItem('zm-diagram-page-theme', 'nord')
    await import('../demo/diagram-page-client.ts')

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dracula')
    expect(svg().style.getPropertyValue('--bg')).toBe('#282a36')
  })
})

describe('cross-source re-theme via theme-state.ts subscribe()', () => {
  it("re-themes this page's svg/editor-link when setTheme() is called from elsewhere", async () => {
    const { setTheme } = await import('../demo/theme-state.ts')
    await import('../demo/diagram-page-client.ts')

    setTheme('nord')

    expect(svg().style.getPropertyValue('--bg')).toBe('#2e3440')
    expect(svg().style.getPropertyValue('--accent')).toBe('#88c0d0')
    const editorHref = document
      .querySelector('.cta-btn.primary')
      ?.getAttribute('href')
    expect(editorHref).toContain('../editor#')
  })

  // The "More examples" gallery thumbnails (#714/#715) are rendered at
  // build time with the same --bg/--fg-driven markup as the primary
  // diagram, just at the page's default theme -- without this, they'd
  // stay stuck on that default regardless of what a visitor picks.
  it("re-themes the 'More examples' gallery thumbnails alongside the primary diagram", async () => {
    const { setTheme } = await import('../demo/theme-state.ts')
    await import('../demo/diagram-page-client.ts')

    setTheme('nord')

    expect(galleryThumbSvg().style.getPropertyValue('--bg')).toBe('#2e3440')
    expect(galleryThumbSvg().style.getPropertyValue('--accent')).toBe('#88c0d0')
  })

  // #689: the global picker must live-retheme every CSS custom property
  // themeCssVariables()/themeStyleDeclarations() (packages/core/src/
  // theme.ts) can emit, not just --bg/--fg -- see this repo's
  // theme-selector-shared-state ADR's "#689" amendment for why diagram-
  // type pages are the one #687-wired page this actually applies to.
  it('sets every CSS custom property themeStyleDeclarations() can emit, not just --bg/--fg', async () => {
    const { setTheme } = await import('../demo/theme-state.ts')
    await import('../demo/diagram-page-client.ts')

    setTheme('one-dark')

    const style = svg().style
    expect(style.getPropertyValue('--bg')).toBe('#282c34')
    expect(style.getPropertyValue('--fg')).toBe('#abb2bf')
    expect(style.getPropertyValue('--line')).toBe('#4b5263')
    expect(style.getPropertyValue('--accent')).toBe('#c678dd')
    expect(style.getPropertyValue('--muted')).toBe('#5c6370')
    expect(style.getPropertyValue('--surface')).toBe('#21252b')
    expect(style.getPropertyValue('--border')).toBe('#3e4451')
  })

  it('clears an enrichment variable a new theme omits, rather than leaving the old value stale', async () => {
    const { setTheme } = await import('../demo/theme-state.ts')
    await import('../demo/diagram-page-client.ts')

    setTheme('one-dark')
    expect(svg().style.getPropertyValue('--line')).toBe('#4b5263')

    // dracula (in the THEMES fixture above) has no `line` -- switching to
    // it must remove the property, not leave one-dark's value behind.
    setTheme('dracula')
    expect(svg().style.getPropertyValue('--line')).toBe('')
  })
})

describe('#theme-pills wiring reuses the shared theme-bar-client.ts controller', () => {
  it('toggles pill active state and closes the dropdown on a pill click, with no page-local click handler duplicating it', async () => {
    await import('../demo/diagram-page-client.ts')

    const dracula = document.querySelector<HTMLElement>(
      '.theme-pill[data-theme="dracula"]',
    )
    // act(): the click's onClick handler runs a React state update, which
    // (unlike the old plain-DOM initThemeBar()) needs a flush point --
    // matches this repo's __tests__/dom/*.test.ts hydration tests, just
    // without going through RTL's own fireEvent (this file predates the RTL
    // convention and isn't otherwise migrated by #801).
    act(() => {
      dracula?.click()
    })

    expect(dracula?.classList.contains('active')).toBe(true)
    expect(
      document
        .querySelector('.theme-pill[data-theme=""]')
        ?.classList.contains('active'),
    ).toBe(false)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dracula')
  })
})
