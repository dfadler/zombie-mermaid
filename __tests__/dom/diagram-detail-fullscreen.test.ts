// @vitest-environment jsdom
/**
 * Proves the "Source → render" output panel's fullscreen toggle
 * (`DetailOutputPanel` in demo/components/diagram-detail-app.tsx) actually
 * works, mirroring `__tests__/dom/editor-fullscreen.test.ts`'s pattern:
 * jsdom implements no Fullscreen API at all (`Element.prototype
 * .requestFullscreen` and `document.exitFullscreen` are both `undefined`,
 * and `document.fullscreenElement` is always `null`), so each interaction
 * test stubs the exact browser contract the toggle depends on -- a
 * `requestFullscreen`/`exitFullscreen` that resolves and sets
 * `document.fullscreenElement`, then dispatches a real `fullscreenchange`
 * event, the same thing a real browser does once a real
 * `requestFullscreen()`/`exitFullscreen()` call settles.
 *
 * `DetailOutputPanel` is shared verbatim by `DiagramTypeApp` (the per-type
 * page) and `DiagramDetailApp` (the per-sample page) -- see its own doc
 * comment -- so exercising it once through `DiagramDetailApp` covers both;
 * neither page wraps or overrides its fullscreen behavior.
 */
import { act, createElement } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  DiagramDetailApp,
  type DiagramDetailAppProps,
} from '../../demo/components/diagram-detail-app.tsx'

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
  moreFromType: [],
  tags: [],
}

/**
 * Stubs `requestFullscreen`/`exitFullscreen`/`fullscreenElement` on
 * `document`/`Element.prototype` for one test, and returns a `settle()`
 * helper that plays out what a real browser does once a request actually
 * takes effect: set `document.fullscreenElement` and fire `fullscreenchange`
 * (jsdom does neither on its own -- there's no real fullscreen to enter).
 * Duplicated from editor-fullscreen.test.ts's own helper rather than
 * shared -- see diagram-page.tsx's own precedent for independently-bundled
 * pages/tests each keeping their own copy of a small fixture.
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

describe('DetailOutputPanel fullscreen toggle', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('requests fullscreen on .output-card on click, then syncs the icon/title/aria-pressed once fullscreenchange fires', async () => {
    const api = stubFullscreenApi()
    try {
      render(createElement(DiagramDetailApp, DETAIL_PROPS))
      const btn = screen.getByTitle('View fullscreen')
      expect(btn.getAttribute('aria-pressed')).toBe('false')

      fireEvent.click(btn)
      expect(api.requestFullscreen).toHaveBeenCalledTimes(1)

      // requestFullscreen()'s promise resolving doesn't itself flip
      // isFullscreen -- only a real fullscreenchange does (see this file's
      // header comment), so nothing has synced yet.
      expect(screen.getByTitle('View fullscreen')).toBe(btn)

      await Promise.resolve()
      const outputCard = document.querySelector('.output-card')
      if (!outputCard) throw new Error('test setup: .output-card missing')
      expect(api.requestFullscreen.mock.instances[0]).toBe(outputCard)
      api.enterSettles(outputCard)

      const exitBtn = screen.getByTitle('Exit fullscreen')
      expect(exitBtn).toBe(btn)
      expect(exitBtn.getAttribute('aria-pressed')).toBe('true')
    } finally {
      api.restore()
    }
  })

  it('exits fullscreen on click when already fullscreen', async () => {
    const api = stubFullscreenApi()
    try {
      render(createElement(DiagramDetailApp, DETAIL_PROPS))
      const btn = screen.getByTitle('View fullscreen')
      const outputCard = document.querySelector('.output-card')
      if (!outputCard) throw new Error('test setup: .output-card missing')

      fireEvent.click(btn)
      await Promise.resolve()
      api.enterSettles(outputCard)
      const exitBtn = screen.getByTitle('Exit fullscreen')

      fireEvent.click(exitBtn)
      expect(api.exitFullscreen).toHaveBeenCalledTimes(1)
      await Promise.resolve()
      api.exitSettles()

      expect(screen.getByTitle('View fullscreen')).toBe(btn)
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    } finally {
      api.restore()
    }
  })

  it('syncs back to the enter state when the browser exits fullscreen on its own (e.g. Esc)', async () => {
    const api = stubFullscreenApi()
    try {
      render(createElement(DiagramDetailApp, DETAIL_PROPS))
      const btn = screen.getByTitle('View fullscreen')
      const outputCard = document.querySelector('.output-card')
      if (!outputCard) throw new Error('test setup: .output-card missing')

      fireEvent.click(btn)
      await Promise.resolve()
      api.enterSettles(outputCard)
      expect(screen.getByTitle('Exit fullscreen')).toBe(btn)

      // No click at all here -- the browser itself ends fullscreen (Esc,
      // losing focus, ...) and only ever tells the page via fullscreenchange.
      api.exitSettles()

      expect(screen.getByTitle('View fullscreen')).toBe(btn)
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    } finally {
      api.restore()
    }
  })
})
