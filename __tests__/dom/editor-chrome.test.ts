// @vitest-environment jsdom
/**
 * Proves zombie-mermaid#809's tabs/buttons/toast/dark-mode React state
 * actually works, replacing `editor/__tests__/*.test.ts`'s old
 * `createEditorEnv()` + `window.eval` approach for these four concerns
 * (`editor/js/tabs.ts`'s/`buttons.ts`'s/`toast.ts`'s/`dark-mode.ts`'s old
 * click listeners and module-level state no longer exist, or barely do --
 * see each hook's own file) with this repo's React Testing Library pattern
 * (`__tests__/dom/rtl-example.test.ts`), the same migration
 * `__tests__/dom/editor-viewport.test.ts` did for #807's zoom/pan/resize.
 * `editor-export.ts`'s own test file covers export (kept separate: it's
 * the one slice with real PNG-rasterization limits under jsdom -- see that
 * file's header comment).
 *
 * Clipboard tests follow `__tests__/dom/nav-hydration.test.ts`'s documented
 * pattern: stub `navigator.clipboard` directly via `Object.defineProperty`
 * and drive with `fireEvent` (not `userEvent`, whose own jsdom `Clipboard`
 * polyfill would otherwise clobber the stub) -- see that file's header
 * comment for why.
 */
import { act, createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EditorApp,
  INITIAL_EDITOR_STATE,
  editorReducer,
  type EditorAppProps,
} from '../../demo/components/editor-app.tsx'
import { DARK_MODE_STORAGE_KEY } from '../../demo/editor-dark-mode-state.ts'

const PROPS: EditorAppProps = {
  themes: [{ key: 'nord', bg: '#2E3440', label: 'Nord' }],
}

beforeEach(() => {
  // editor-buttons.ts's Clear button calls through
  // window.__editorHelpersState (normally registered by the *legacy*
  // editor/js/editor-helpers.ts bundle, which these RTL tests never load --
  // only <EditorApp> itself is rendered) -- see that hook's own header
  // comment for why the bridge exists.
  window.__editorHelpersState = { updateLineNumbers: vi.fn() }
})

afterEach(() => {
  window.localStorage.removeItem(DARK_MODE_STORAGE_KEY)
  // See nav-hydration.test.ts's header comment: userEvent.setup() installs
  // its own jsdom Clipboard polyfill onto navigator.clipboard the first
  // time it runs and never uninstalls it, so a later test's
  // Object.defineProperty stub (or vice versa) can otherwise see stale
  // state from a previous test.
  // @ts-expect-error -- deleting a property this file's own tests define.
  delete navigator.clipboard
})

describe('editorReducer (#809 tabs/dark-mode/toast actions)', () => {
  it('SET_ACTIVE_TAB updates activeTab only', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_ACTIVE_TAB',
      tab: 'config',
    })
    expect(next).toEqual({ ...INITIAL_EDITOR_STATE, activeTab: 'config' })
  })

  it('SET_DARK_MODE updates darkMode only', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_DARK_MODE',
      dark: true,
    })
    expect(next).toEqual({ ...INITIAL_EDITOR_STATE, darkMode: true })
  })

  it('SHOW_TOAST sets the message, marks it visible, and bumps the nonce', () => {
    const first = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SHOW_TOAST',
      message: 'Saved!',
    })
    expect(first).toEqual({
      ...INITIAL_EDITOR_STATE,
      toastMessage: 'Saved!',
      toastVisible: true,
      toastNonce: 1,
    })
    // A repeat of the *same* message still bumps the nonce -- this is what
    // lets useEditorToast's auto-dismiss timer restart on every call, not
    // just on a changed message (see EditorState.toastNonce's doc comment).
    const second = editorReducer(first, {
      type: 'SHOW_TOAST',
      message: 'Saved!',
    })
    expect(second.toastNonce).toBe(2)
  })

  it('HIDE_TOAST clears visibility but leaves the message alone', () => {
    const shown = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SHOW_TOAST',
      message: 'Saved!',
    })
    const hidden = editorReducer(shown, { type: 'HIDE_TOAST' })
    expect(hidden.toastVisible).toBe(false)
    expect(hidden.toastMessage).toBe('Saved!')
  })
})

describe('<EditorApp> tabs interaction (#809)', () => {
  it('switches to the Config tab and back, toggling panel visibility and the source toolbar', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))

    const codeTab = document.getElementById('tab-code')!
    const configTab = document.getElementById('tab-config')!
    const editorView = document.getElementById('editor-view')!
    const configView = document.getElementById('config-view')!
    const sourceToolbar = document.getElementById('source-toolbar')!

    expect(codeTab).toHaveClass('active')
    expect(configView).not.toHaveClass('visible')

    await user.click(configTab)

    expect(configTab).toHaveClass('active')
    expect(codeTab).not.toHaveClass('active')
    expect(configView).toHaveClass('visible')
    expect((editorView as HTMLElement).style.display).toBe('none')
    expect((sourceToolbar as HTMLElement).style.display).toBe('none')

    await user.click(codeTab)

    expect(codeTab).toHaveClass('active')
    expect(configView).not.toHaveClass('visible')
    expect((editorView as HTMLElement).style.display).toBe('flex')
    expect((sourceToolbar as HTMLElement).style.display).toBe('')
  })

  it('registers window.__editorTabsState for editor/js/tabs.ts to call', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))

    expect(window.__editorTabsState.getActiveTab()).toBe('code')

    const seen: Array<'code' | 'config'> = []
    const unsubscribe = window.__editorTabsState.subscribe((tab) => {
      seen.push(tab)
    })

    await user.click(document.getElementById('tab-config')!)

    expect(window.__editorTabsState.getActiveTab()).toBe('config')
    expect(seen).toEqual(['config'])
    unsubscribe()
  })
})

describe('<EditorApp> buttons interaction (#809)', () => {
  it('copies the source to the clipboard and shows a toast', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    render(createElement(EditorApp, PROPS))
    const textarea = document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    textarea.value = 'graph TD\n  A --> B'

    // The SHOW_TOAST dispatch happens inside clipboard.writeText(...)'s
    // .then() callback -- a plain microtask, not a React event handler --
    // so it needs an explicit `act()` to flush before asserting, the same
    // pattern nav-hydration.test.ts's second test uses for an identical
    // clipboard-then-state-update shape.
    await act(async () => {
      fireEvent.click(document.getElementById('copy-source-btn')!)
      await Promise.resolve()
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'graph TD\n  A --> B',
    )
    expect(screen.getByText('Source copied!')).toBeInTheDocument()
  })

  it('clears the editor, resets the preview/status/render-time, and strips the URL hash', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))
    const textarea = document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    const previewInner = document.getElementById('preview-inner')!
    const statusText = document.getElementById('status-text')!
    const renderTime = document.getElementById('render-time')!

    textarea.value = 'graph TD\n  A --> B'
    previewInner.innerHTML = '<svg></svg>'
    statusText.textContent = 'OK'
    statusText.className = 'status-ok'
    renderTime.textContent = 'Rendered in 5ms'
    window.history.replaceState(null, '', '#somehash')

    await user.click(document.getElementById('clear-btn')!)

    expect(textarea.value).toBe('')
    expect(previewInner.innerHTML).toContain('Start typing to render')
    expect(statusText.textContent).toBe('Ready')
    expect(statusText.className).toBe('')
    expect(renderTime.textContent).toBe('')
    expect(window.location.hash).toBe('')
  })
})

describe('<EditorApp> toast auto-dismiss (#809)', () => {
  it('shows then auto-dismisses after 2500ms, and restarts the timer on a repeat message', async () => {
    vi.useFakeTimers()
    try {
      render(createElement(EditorApp, PROPS))
      const textarea = document.getElementById(
        'code-editor',
      ) as HTMLTextAreaElement
      textarea.value = 'graph TD\n  A --> B'
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
      })
      const copyBtn = document.getElementById('copy-source-btn')!
      const toast = document.getElementById('toast')!

      await act(async () => {
        fireEvent.click(copyBtn)
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(toast).toHaveClass('show')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      expect(toast).toHaveClass('show')

      // A second click restarts the full window instead of the first
      // click's timer expiring right on schedule.
      await act(async () => {
        fireEvent.click(copyBtn)
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
      expect(toast).toHaveClass('show')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500)
      })
      expect(toast).not.toHaveClass('show')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('<EditorApp> dark-mode interaction (#809)', () => {
  it('toggles the moon/sun icons and persists the preference', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))
    const iconMoon = document.getElementById(
      'icon-moon',
    ) as unknown as SVGElement & {
      style: CSSStyleDeclaration
    }
    const iconSun = document.getElementById(
      'icon-sun',
    ) as unknown as SVGElement & {
      style: CSSStyleDeclaration
    }
    const toggle = document.getElementById('dark-light-btn')!

    expect(iconMoon.style.display).toBe('')
    expect(iconSun.style.display).toBe('none')

    await user.click(toggle)

    expect(iconMoon.style.display).toBe('none')
    expect(iconSun.style.display).toBe('')
    expect(window.localStorage.getItem(DARK_MODE_STORAGE_KEY)).toBe('true')

    await user.click(toggle)

    expect(iconMoon.style.display).toBe('')
    expect(iconSun.style.display).toBe('none')
    expect(window.localStorage.getItem(DARK_MODE_STORAGE_KEY)).toBe('false')
  })

  it('restores a persisted dark preference on mount', () => {
    window.localStorage.setItem(DARK_MODE_STORAGE_KEY, 'true')
    render(createElement(EditorApp, PROPS))

    const iconSun = document.getElementById(
      'icon-sun',
    ) as unknown as SVGElement & {
      style: CSSStyleDeclaration
    }
    expect(iconSun.style.display).toBe('')
  })

  it('notifies window.__editorDarkModeState subscribers (editor/js/dark-mode.ts) on toggle', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))

    const seen: boolean[] = []
    const unsubscribe = window.__editorDarkModeState.subscribe((dark) => {
      seen.push(dark)
    })

    await user.click(document.getElementById('dark-light-btn')!)

    expect(seen).toEqual([true])
    expect(window.__editorDarkModeState.getIsDark()).toBe(true)
    unsubscribe()
  })
})
