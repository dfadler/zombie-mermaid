// @vitest-environment jsdom
/**
 * Proves zombie-mermaid#810's diagram-theme dropdown and client-bootstrap
 * React state actually works, replacing `editor/__tests__/config.test.ts`'s
 * "config panel state" describe block (`state.theme`/`window.__themeState`/
 * `setTheme`/`buildOptions` no longer exist as legacy globals -- #810 moved
 * theme selection to `demo/components/editor-theme.ts`) with this repo's
 * React Testing Library pattern (`__tests__/dom/rtl-example.test.ts`,
 * `__tests__/dom/editor-viewport.test.ts`).
 *
 * `window.__mermaid` is stubbed in every test here (mirrors
 * `editor-rendering.test.ts`'s identical stub) purely so the bootstrap's
 * own `scheduleRender(0)` call resolves deterministically instead of
 * hitting {@link doRender}'s `!window.__mermaid` no-op -- none of these
 * tests assert on render *output*, just on theme/bootstrap state.
 */
import { act, createElement } from 'react'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EditorApp,
  type EditorAppProps,
} from '../../demo/components/editor-app.tsx'
import { EDITOR_EFFECTIVE_THEME_EVENT } from '../../demo/components/editor-theme.ts'
import { buildHash } from '../../demo/components/editor-sharing.ts'
import { DARK_MODE_STORAGE_KEY } from '../../demo/editor-dark-mode-state.ts'
import { setTheme, THEME_STORAGE_KEY } from '../../demo/theme-state.ts'

// Includes 'zinc-dark' -- the dark-mode-derived auto diagram theme -- the
// same way the real editor.ts builds this prop from *every* THEMES key
// (Object.keys(THEMES).map(...)), not just a curated subset.
const PROPS: EditorAppProps = {
  themes: [
    { key: 'nord', bg: '#2E3440', label: 'Nord' },
    { key: 'dracula', bg: '#282A36', label: 'Dracula' },
    { key: 'zinc-dark', bg: '#18181B', label: 'Zinc Dark' },
  ],
}

const THEMES = {
  nord: { bg: '#2E3440', fg: '#D8DEE9' },
  dracula: { bg: '#282A36', fg: '#F8F8F2' },
  'zinc-dark': { bg: '#18181B', fg: '#FAFAFA' },
}

function stubMermaid(): void {
  window.__mermaid = {
    THEMES,
    renderMermaidSVGAsync: vi.fn(async () => '<svg></svg>'),
  }
}

/** Waits for the bootstrap's/theme-change effect's scheduled render to settle. */
function flushRenderTimers(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20))
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
  stubMermaid()
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
  // @ts-expect-error -- deleting a property this file's own tests define.
  delete window.__mermaid
})

async function mount(): Promise<void> {
  render(createElement(EditorApp, PROPS))
  await act(() => flushRenderTimers())
}

describe('<EditorApp> theme dropdown (#810)', () => {
  it('opens on trigger click, selects a theme, and closes', async () => {
    await mount()
    const trigger = document.getElementById('theme-dropdown-btn')!
    const menu = document.getElementById('theme-dropdown-menu')!

    expect(menu).not.toHaveClass('open')
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(menu).toHaveClass('open')

    const item = document.querySelector<HTMLElement>(
      '.theme-dropdown-item[data-theme="nord"]',
    )!
    await act(async () => {
      item.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushRenderTimers()
    })

    expect(menu).not.toHaveClass('open')
    expect(document.getElementById('theme-btn-label')!.textContent).toBe('Nord')
    expect(item).toHaveClass('active')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('nord')
  })

  it('closes on an outside click without changing the theme', async () => {
    await mount()
    const trigger = document.getElementById('theme-dropdown-btn')!
    const menu = document.getElementById('theme-dropdown-menu')!

    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(menu).toHaveClass('open')

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(menu).not.toHaveClass('open')
    expect(document.getElementById('theme-btn-label')!.textContent).toBe(
      'Default',
    )
  })

  it('shows "Default" with no swatch when no theme is selected', async () => {
    await mount()
    const swatch = document.getElementById('theme-btn-swatch') as HTMLElement
    expect(document.getElementById('theme-btn-label')!.textContent).toBe(
      'Default',
    )
    expect(swatch.style.display).toBe('none')
  })
})

describe('<EditorApp> zm-editor-theme-changed event (#810)', () => {
  it('dispatches the event with the current theme whenever it changes, for editor-config.tsx', async () => {
    await mount()
    const seen: Array<string | undefined> = []
    const onChanged = (e: Event) => {
      seen.push((e as CustomEvent<string>).detail)
    }
    window.addEventListener(EDITOR_EFFECTIVE_THEME_EVENT, onChanged)

    const trigger = document.getElementById('theme-dropdown-btn')!
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      document
        .querySelector<HTMLElement>('.theme-dropdown-item[data-theme="nord"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushRenderTimers()
    })

    window.removeEventListener(EDITOR_EFFECTIVE_THEME_EVENT, onChanged)
    expect(seen.at(-1)).toBe('nord')
  })
})

describe('<EditorApp> client bootstrap (#810)', () => {
  it('loads the default diagram when there is no URL hash and no saved theme', async () => {
    await mount()
    const textarea = document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    expect(textarea.value).toContain('graph TD')
    expect(document.getElementById('theme-btn-label')!.textContent).toBe(
      'Default',
    )
  })

  it('restores a saved shared theme preference on mount', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dracula')
    await mount()
    expect(document.getElementById('theme-btn-label')!.textContent).toBe(
      'Dracula',
    )
  })

  it('derives the auto dark diagram theme from a persisted dark-mode preference', async () => {
    window.localStorage.setItem(DARK_MODE_STORAGE_KEY, 'true')
    await mount()
    expect(document.documentElement.style.getPropertyValue('--t-bg')).toBe(
      THEMES['zinc-dark'].bg,
    )
  })

  it('loads source + theme from the URL hash, overriding a saved theme', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dracula')
    window.history.replaceState(
      null,
      '',
      buildHash('graph LR\n  X --> Y', 'nord'),
    )

    await mount()

    const textarea = document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    expect(textarea.value).toBe('graph LR\n  X --> Y')
    expect(document.getElementById('theme-btn-label')!.textContent).toBe('Nord')
  })

  it('migrates a legacy bm-editor-theme value to the shared key (#688)', async () => {
    window.localStorage.setItem('bm-editor-theme', 'nord')
    await mount()

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('nord')
    expect(window.localStorage.getItem('bm-editor-theme')).toBeNull()
    expect(document.getElementById('theme-btn-label')!.textContent).toBe('Nord')
  })

  it('does not let a legacy bm-editor-theme value override an already-set shared preference', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dracula')
    window.localStorage.setItem('bm-editor-theme', 'nord')
    await mount()

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dracula')
    expect(document.getElementById('theme-btn-label')!.textContent).toBe(
      'Dracula',
    )
  })
})

describe('<EditorApp> cross-tab/dark-mode theme sync (#810)', () => {
  it('reapplies the theme when the shared theme-state notifies a change from elsewhere', async () => {
    await mount()

    await act(async () => {
      setTheme('dracula')
      await flushRenderTimers()
    })

    expect(document.getElementById('theme-btn-label')!.textContent).toBe(
      'Dracula',
    )
  })

  it('a dark/light toggle overrides a manually-picked theme back to the auto diagram theme', async () => {
    await mount()
    // Manually pick a theme first.
    await act(async () => {
      document
        .getElementById('theme-dropdown-btn')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      document
        .querySelector<HTMLElement>('.theme-dropdown-item[data-theme="nord"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushRenderTimers()
    })
    expect(document.getElementById('theme-btn-label')!.textContent).toBe('Nord')

    // Toggling dark mode always wins over a manual pick -- see
    // editor-theme.ts's header comment (verbatim `editor/js/dark-mode.ts`
    // behavior: the toggle subscriber always passes force: true).
    await act(async () => {
      document
        .getElementById('dark-light-btn')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushRenderTimers()
    })

    expect(document.documentElement.style.getPropertyValue('--t-bg')).toBe(
      THEMES['zinc-dark'].bg,
    )
    expect(document.getElementById('theme-btn-label')!.textContent).toBe(
      'Zinc Dark',
    )
  })
})
