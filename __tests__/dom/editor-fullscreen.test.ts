// @vitest-environment jsdom
/**
 * Proves the fullscreen toggle actually works, mirroring
 * `__tests__/dom/editor-viewport.test.ts`'s pattern: a reducer test, then
 * real RTL interaction tests against a mounted `<EditorApp>`.
 *
 * jsdom implements no Fullscreen API at all (`Element.prototype
 * .requestFullscreen` and `document.exitFullscreen` are both `undefined`,
 * and `document.fullscreenElement` is always `null`), so each interaction
 * test stubs the exact browser contract `editor-fullscreen.ts` depends on:
 * a `requestFullscreen`/`exitFullscreen` that resolves and sets
 * `document.fullscreenElement`, then dispatches a real `fullscreenchange`
 * event -- the same thing a real browser does after a real
 * `requestFullscreen()`/`exitFullscreen()` call settles.
 */
import { act, createElement } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  EditorApp,
  INITIAL_EDITOR_STATE,
  editorReducer,
  type EditorAppProps,
} from '../../demo/components/editor-app.tsx'
import { getFullscreenTarget } from '../../demo/components/editor-fullscreen.ts'

const PROPS: EditorAppProps = {
  themes: [{ key: 'nord', bg: '#2E3440', label: 'Nord' }],
}

describe('editorReducer (fullscreen)', () => {
  it('SET_FULLSCREEN updates fullscreen, leaving everything else untouched', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_FULLSCREEN',
      fullscreen: true,
    })
    expect(next).toEqual({ ...INITIAL_EDITOR_STATE, fullscreen: true })
  })
})

describe('getFullscreenTarget', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('targets .editor-tool-shell when present', () => {
    document.body.innerHTML = '<div class="editor-tool-shell"></div>'
    expect(getFullscreenTarget()).toBe(
      document.querySelector('.editor-tool-shell'),
    )
  })

  it('falls back to document.documentElement when no .editor-tool-shell is mounted', () => {
    expect(getFullscreenTarget()).toBe(document.documentElement)
  })
})

/**
 * Stubs `requestFullscreen`/`exitFullscreen`/`fullscreenElement` on
 * `document`/`Element.prototype` for one test, and returns a `settle()`
 * helper that plays out what a real browser does once a request actually
 * takes effect: set `document.fullscreenElement` and fire `fullscreenchange`
 * (jsdom does neither on its own -- there's no real fullscreen to enter).
 */
function stubFullscreenApi(): {
  requestFullscreen: ReturnType<typeof vi.fn>
  exitFullscreen: ReturnType<typeof vi.fn>
  enterSettles: (el: Element) => void
  exitSettles: () => void
  restore: () => void
} {
  const originalRequest = Element.prototype.requestFullscreen
  const originalExit = document.exitFullscreen
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    document,
    'fullscreenElement',
  )

  let current: Element | null = null
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => current,
  })

  const requestFullscreen = vi.fn(() => Promise.resolve())
  const exitFullscreen = vi.fn(() => Promise.resolve())
  Element.prototype.requestFullscreen =
    requestFullscreen as unknown as typeof Element.prototype.requestFullscreen
  document.exitFullscreen =
    exitFullscreen as unknown as typeof document.exitFullscreen

  return {
    requestFullscreen,
    exitFullscreen,
    enterSettles: (el: Element) => {
      current = el
      // A real browser's fullscreenchange fires asynchronously, outside any
      // React-recognized event handler -- act() (not fireEvent, which only
      // wraps a synchronous dispatch through React's own delegated
      // listeners) is what makes the resulting dispatch()/re-render flush
      // before the assertions below read the DOM.
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'))
      })
    },
    exitSettles: () => {
      current = null
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'))
      })
    },
    restore: () => {
      Element.prototype.requestFullscreen = originalRequest
      document.exitFullscreen = originalExit
      if (originalDescriptor) {
        Object.defineProperty(document, 'fullscreenElement', originalDescriptor)
      } else {
        delete (document as { fullscreenElement?: unknown }).fullscreenElement
      }
    },
  }
}

describe('<EditorApp> fullscreen toggle', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('requests fullscreen on click, then syncs icons/title/aria-pressed once fullscreenchange fires', async () => {
    const api = stubFullscreenApi()
    try {
      render(createElement(EditorApp, PROPS))
      const btn = screen.getByTitle('Enter fullscreen')
      expect(btn.getAttribute('aria-pressed')).toBe('false')

      fireEvent.click(btn)
      expect(api.requestFullscreen).toHaveBeenCalledTimes(1)

      // requestFullscreen()'s promise resolving doesn't itself flip
      // state.fullscreen -- only a real fullscreenchange does (see this
      // file's header comment), so nothing has synced yet.
      expect(screen.getByTitle('Enter fullscreen')).toBe(btn)

      // Wait a tick for the (already-resolved) promise, then play out what
      // the browser does once the request actually takes effect.
      await Promise.resolve()
      const target =
        document.querySelector('.editor-tool-shell') ?? document.documentElement
      api.enterSettles(target)

      const exitBtn = screen.getByTitle('Exit fullscreen')
      expect(exitBtn).toBe(btn)
      expect(exitBtn.getAttribute('aria-pressed')).toBe('true')
      expect(
        document.getElementById('icon-fullscreen-enter')?.style.display,
      ).toBe('none')
      expect(
        document.getElementById('icon-fullscreen-exit')?.style.display,
      ).toBe('')
    } finally {
      api.restore()
    }
  })

  it('exits fullscreen on click when already fullscreen', async () => {
    const api = stubFullscreenApi()
    try {
      render(createElement(EditorApp, PROPS))
      const btn = screen.getByTitle('Enter fullscreen')

      fireEvent.click(btn)
      await Promise.resolve()
      api.enterSettles(document.documentElement)
      const exitBtn = screen.getByTitle('Exit fullscreen')

      fireEvent.click(exitBtn)
      expect(api.exitFullscreen).toHaveBeenCalledTimes(1)
      await Promise.resolve()
      api.exitSettles()

      expect(screen.getByTitle('Enter fullscreen')).toBe(btn)
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    } finally {
      api.restore()
    }
  })

  it('syncs back to the enter state when the browser exits fullscreen on its own (e.g. Esc)', async () => {
    const api = stubFullscreenApi()
    try {
      render(createElement(EditorApp, PROPS))
      const btn = screen.getByTitle('Enter fullscreen')
      fireEvent.click(btn)
      await Promise.resolve()
      api.enterSettles(document.documentElement)
      expect(screen.getByTitle('Exit fullscreen')).toBe(btn)

      // No click at all here -- the browser itself ends fullscreen (Esc,
      // losing focus, ...) and only ever tells the page via fullscreenchange.
      api.exitSettles()

      expect(screen.getByTitle('Enter fullscreen')).toBe(btn)
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    } finally {
      api.restore()
    }
  })
})
