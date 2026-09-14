// @vitest-environment jsdom
/**
 * Guards `demo/index-page-client.ts`'s `initThemeShowcaseFullscreen()` --
 * the fullscreen toggle plus, once fullscreen, scale (zombie-mermaid#987)
 * and pan/pinch (zombie-mermaid#988). One function (see its own doc
 * comment for why). The module runs its wiring as side effects at import
 * time (mirroring how it actually runs on a real page load, and matching
 * `__tests__/demo-diagram-page-client.test.ts`'s own pattern for a
 * plain-DOM client module), so every test builds the minimal markup that
 * function expects *before* a fresh dynamic import -- `vi.resetModules()`
 * between tests, since a second import would otherwise reuse the first
 * run's already-executed top-level code.
 *
 * Hand-typed markup, not a real `ThemeShowcase` render: that component is
 * a private, unexported function inside `demo/components/index-page.tsx`,
 * only reachable through the full `IndexPage` (a large, unrelated prop
 * surface -- hero copy, blog links, etc.). `index-page-client.ts`'s own
 * header comment already notes `ThemeShowcase`'s client wiring predates
 * dedicated test coverage; a fixture with just the ids/classes
 * `initThemeShowcaseFullscreen()` reads keeps these tests focused on the
 * fullscreen+zoom+pan behavior itself rather than on reproducing that
 * component.
 *
 * `stubFullscreenApi()` below is `__tests__/dom/diagram-detail-fullscreen
 * .test.ts`'s own helper, duplicated rather than shared (that file's own
 * header comment on `output-panel-viewport.test.ts` explains the
 * "independently-bundled pages/tests each keep their own copy" precedent
 * this follows) -- jsdom implements `PointerEvent` but not
 * `Element.prototype.requestFullscreen`/`document.exitFullscreen`/
 * `document.fullscreenElement` at all, so both this file and that one stub
 * them the same way. jsdom also implements `PointerEvent` but not
 * `Element.prototype.setPointerCapture` (confirmed directly against this
 * repo's installed jsdom version, same as
 * `__tests__/dom/output-panel-viewport.test.ts`'s own header comment) --
 * `index-page-client.ts`'s `body.setPointerCapture?.(...)` call is exactly
 * the optional-chaining guard that makes the pan/pinch tests below
 * possible without a jsdom polyfill. `getBoundingClientRect` is likewise
 * mocked directly (jsdom does no real layout), the same technique
 * `__tests__/dom/editor-viewport.test.ts`'s resize-handle tests use --
 * `mockOverflow()` below simulates how much the (already-scaled)
 * `#theme-showcase-output-body` box overflows `#theme-showcase-diagram-
 * card`'s own, which is what `recomputePanBounds()` actually measures.
 */
import { fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function buildDom(): void {
  document.body.innerHTML = `
    <div id="theme-showcase-grid" class="theme-showcase-grid">
      <div id="theme-showcase-diagram-card" data-output-mode="svg">
        <div class="theme-showcase-output-toggle">
          <div class="theme-showcase-output-controls">
            <div class="theme-showcase-zoom-controls" id="theme-showcase-zoom-controls">
              <button type="button" id="theme-showcase-zoom-out">−</button>
              <button type="button" id="theme-showcase-zoom-reset">100%</button>
              <button type="button" id="theme-showcase-zoom-in">+</button>
            </div>
            <button
              type="button"
              id="theme-showcase-fullscreen-trigger"
              title="View fullscreen"
              aria-pressed="false"
            ></button>
          </div>
        </div>
        <div class="theme-showcase-output-body" id="theme-showcase-output-body">
          <svg id="theme-showcase-diagram"></svg>
        </div>
      </div>
    </div>
  `
}

function grid(): HTMLElement {
  const el = document.getElementById('theme-showcase-grid')
  if (!el) throw new Error('missing grid')
  return el
}

function card(): HTMLElement {
  const el = document.getElementById('theme-showcase-diagram-card')
  if (!el) throw new Error('missing diagram card')
  return el
}

function body(): HTMLElement {
  const el = document.getElementById('theme-showcase-output-body')
  if (!el) throw new Error('missing output body')
  return el
}

function fullscreenBtn(): HTMLButtonElement {
  const el = document.getElementById('theme-showcase-fullscreen-trigger')
  if (!(el instanceof HTMLButtonElement)) throw new Error('missing trigger')
  return el
}

function zoomIn(): void {
  fireEvent.click(document.getElementById('theme-showcase-zoom-in')!)
}
function zoomOut(): void {
  fireEvent.click(document.getElementById('theme-showcase-zoom-out')!)
}
function zoomReset(): void {
  fireEvent.click(document.getElementById('theme-showcase-zoom-reset')!)
}
function resetLabel(): string | null {
  return (
    document.getElementById('theme-showcase-zoom-reset')?.textContent ?? null
  )
}

/**
 * Stubs `Element.prototype.requestFullscreen`/`document.exitFullscreen`/
 * `document.fullscreenElement` -- see this file's header comment. Every
 * test that needs "fullscreen already active" calls `enterSettles(grid())`
 * once up front rather than driving the trigger button itself (a separate
 * `describe('fullscreen toggle')` block below covers that click ->
 * requestFullscreen()/exitFullscreen() path directly).
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
      document.dispatchEvent(new Event('fullscreenchange'))
    },
    exitSettles: () => {
      current = null
      document.dispatchEvent(new Event('fullscreenchange'))
    },
    restore: () => {
      Element.prototype.requestFullscreen = originalRequest
      if (originalExit) document.exitFullscreen = originalExit
      if (originalDescriptor) {
        Object.defineProperty(document, 'fullscreenElement', originalDescriptor)
      }
    },
  }
}

/**
 * Stubs `card()`/`body()`'s `getBoundingClientRect()` so
 * `recomputePanBounds()` sees the (already-scaled) output body overflowing
 * the card's own box by exactly `overflowX`/`overflowY` px total (split
 * evenly per side -- `maxPanX` ends up `overflowX / 2`, matching
 * `recomputePanBounds()`'s own `(bodyRect.width - cardRect.width) / 2`).
 * `(0, 0)` simulates the real-browser effect of `--tsd-scale` being back
 * at `1` (body's rendered rect shrinks to match the card's own, since
 * nothing is clipped).
 */
function mockOverflow(overflowX: number, overflowY: number): void {
  vi.spyOn(card(), 'getBoundingClientRect').mockReturnValue({
    width: 400,
    height: 300,
  } as DOMRect)
  vi.spyOn(body(), 'getBoundingClientRect').mockReturnValue({
    width: 400 + overflowX,
    height: 300 + overflowY,
  } as DOMRect)
}

beforeEach(() => {
  vi.resetModules()
  buildDom()
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('initThemeShowcaseFullscreen: fullscreen toggle', () => {
  it('clicking the trigger requests fullscreen on #theme-showcase-grid', async () => {
    const api = stubFullscreenApi()
    try {
      await import('../../demo/index-page-client.ts')
      fireEvent.click(fullscreenBtn())
      expect(api.requestFullscreen).toHaveBeenCalledTimes(1)
      expect(api.requestFullscreen.mock.instances[0]).toBe(grid())
    } finally {
      api.restore()
    }
  })

  it('clicking the trigger while fullscreen exits fullscreen', async () => {
    const api = stubFullscreenApi()
    try {
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())
      fireEvent.click(fullscreenBtn())
      expect(api.exitFullscreen).toHaveBeenCalledTimes(1)
    } finally {
      api.restore()
    }
  })

  it('fullscreenchange (not the click itself) syncs aria-pressed/data-fullscreen/title', async () => {
    const api = stubFullscreenApi()
    try {
      await import('../../demo/index-page-client.ts')
      fireEvent.click(fullscreenBtn())
      // requestFullscreen()'s promise resolving doesn't itself flip state --
      // only a real fullscreenchange does (see this function's own doc
      // comment) -- so nothing has synced yet.
      expect(fullscreenBtn().getAttribute('aria-pressed')).toBe('false')

      api.enterSettles(grid())
      expect(fullscreenBtn().getAttribute('aria-pressed')).toBe('true')
      expect(fullscreenBtn().dataset.fullscreen).toBe('true')
      expect(fullscreenBtn().title).toBe('Exit fullscreen')

      api.exitSettles()
      expect(fullscreenBtn().getAttribute('aria-pressed')).toBe('false')
      expect(fullscreenBtn().dataset.fullscreen).toBe('false')
      expect(fullscreenBtn().title).toBe('View fullscreen')
    } finally {
      api.restore()
    }
  })

  it('resets scale and pan to identity on every fullscreenchange, entering or leaving', async () => {
    const api = stubFullscreenApi()
    try {
      mockOverflow(200, 100)
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())
      zoomIn()
      expect(body().style.getPropertyValue('--tsd-scale')).not.toBe('1')

      api.exitSettles()
      expect(body().style.getPropertyValue('--tsd-scale')).toBe('1')
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('0px')

      // And re-entering starts fresh too, not from wherever it was left.
      api.enterSettles(grid())
      expect(body().style.getPropertyValue('--tsd-scale')).toBe('1')
    } finally {
      api.restore()
    }
  })
})

describe('initThemeShowcaseFullscreen: zoom buttons (#987), fullscreen-gated', () => {
  it('do nothing while not fullscreen', async () => {
    await import('../../demo/index-page-client.ts')
    zoomIn()
    expect(body().style.getPropertyValue('--tsd-scale')).toBe('')
    expect(resetLabel()).toBe('100%')
  })

  it('zoom in/out step by ZOOM_STEP (unsnapped) and clamp to [0.5, 2.5]', async () => {
    const api = stubFullscreenApi()
    try {
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())

      zoomIn()
      expect(body().style.getPropertyValue('--tsd-scale')).toBe('1.25') // 1 * ZOOM_STEP, no snapping
      expect(resetLabel()).toBe('125%') // formatScalePercent still rounds for display

      zoomOut()
      zoomOut()
      expect(Number(body().style.getPropertyValue('--tsd-scale'))).toBeLessThan(
        1,
      )

      for (let i = 0; i < 20; i++) zoomIn()
      expect(body().style.getPropertyValue('--tsd-scale')).toBe('2.5')
      for (let i = 0; i < 20; i++) zoomOut()
      expect(body().style.getPropertyValue('--tsd-scale')).toBe('0.5')
    } finally {
      api.restore()
    }
  })

  it('reset returns to 100%', async () => {
    const api = stubFullscreenApi()
    try {
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())
      zoomIn()
      zoomIn()
      expect(body().style.getPropertyValue('--tsd-scale')).not.toBe('1')
      zoomReset()
      expect(body().style.getPropertyValue('--tsd-scale')).toBe('1')
      expect(resetLabel()).toBe('100%')
    } finally {
      api.restore()
    }
  })
})

describe('initThemeShowcaseFullscreen: pan/pinch (#988), fullscreen-gated', () => {
  it('a drag does nothing while not fullscreen, even with room to pan', async () => {
    mockOverflow(200, 100)
    await import('../../demo/index-page-client.ts')

    fireEvent.pointerDown(body(), {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 100,
      clientY: 100,
    })
    expect(body().classList.contains('panning')).toBe(false)
    fireEvent.pointerMove(body(), {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 150,
      clientY: 100,
    })
    expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('')
  })

  it('is a no-op at 100% scale even while fullscreen -- no .pannable, drag never starts', async () => {
    const api = stubFullscreenApi()
    try {
      mockOverflow(0, 0)
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())
      expect(body().classList.contains('pannable')).toBe(false)

      fireEvent.pointerDown(body(), {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 100,
        clientY: 100,
      })
      expect(body().classList.contains('panning')).toBe(false)
      fireEvent.pointerMove(body(), {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 150,
        clientY: 100,
      })
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('0px')
    } finally {
      api.restore()
    }
  })

  it('marks .pannable once zoomed content overflows the card, and mouse drag pans within bounds', async () => {
    const api = stubFullscreenApi()
    try {
      mockOverflow(200, 100) // maxPanX 100, maxPanY 50
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())
      zoomIn()
      expect(body().classList.contains('pannable')).toBe(true)

      fireEvent.pointerDown(body(), {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 100,
        clientY: 100,
      })
      expect(body().classList.contains('panning')).toBe(true)
      fireEvent.pointerMove(body(), {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 140,
        clientY: 130,
      })
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('40px')
      expect(body().style.getPropertyValue('--tsd-pan-y')).toBe('30px')

      fireEvent.pointerUp(body(), { pointerId: 1, pointerType: 'mouse' })
      expect(body().classList.contains('panning')).toBe(false)
    } finally {
      api.restore()
    }
  })

  it('a mouse drag past the edge clamps to maxPanX/maxPanY, not past it', async () => {
    const api = stubFullscreenApi()
    try {
      mockOverflow(200, 100) // maxPanX 100, maxPanY 50
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())
      zoomIn()

      fireEvent.pointerDown(body(), {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 0,
        clientY: 0,
      })
      fireEvent.pointerMove(body(), {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 10000,
        clientY: 10000,
      })
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('100px')
      expect(body().style.getPropertyValue('--tsd-pan-y')).toBe('50px')
    } finally {
      api.restore()
    }
  })

  it('single-finger touch drag pans the same as mouse drag', async () => {
    const api = stubFullscreenApi()
    try {
      mockOverflow(200, 100)
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())
      zoomIn()

      fireEvent.pointerDown(body(), {
        pointerId: 5,
        pointerType: 'touch',
        clientX: 50,
        clientY: 50,
      })
      fireEvent.pointerMove(body(), {
        pointerId: 5,
        pointerType: 'touch',
        clientX: 20,
        clientY: 60,
      })
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('-30px')
      expect(body().style.getPropertyValue('--tsd-pan-y')).toBe('10px')
    } finally {
      api.restore()
    }
  })

  it('a two-finger touch pinch zooms from 100% scale, keeping the reset label in sync', async () => {
    const api = stubFullscreenApi()
    try {
      mockOverflow(0, 0) // nothing to pan yet -- proves pinch isn't gated by maxPanX/maxPanY the way a lone drag is
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())

      fireEvent.pointerDown(body(), {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 100,
        clientY: 100,
      })
      fireEvent.pointerDown(body(), {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 200,
        clientY: 100,
      })
      // Symmetric pinch-out about the same midpoint (150, 100) -- distance
      // doubles (100 -> 200), midpoint doesn't move, isolating the zoom
      // effect from any pan side effect.
      fireEvent.pointerMove(body(), {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 50,
        clientY: 100,
      })
      fireEvent.pointerMove(body(), {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 250,
        clientY: 100,
      })

      expect(body().style.getPropertyValue('--tsd-scale')).toBe('2')
      expect(resetLabel()).toBe('200%')
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('0px')
    } finally {
      api.restore()
    }
  })

  it('a pinch also pans by how far its midpoint moves, clamped to maxPanX/maxPanY', async () => {
    const api = stubFullscreenApi()
    try {
      mockOverflow(200, 100) // maxPanX 100, maxPanY 50
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())

      fireEvent.pointerDown(body(), {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 0,
        clientY: 0,
      })
      fireEvent.pointerDown(body(), {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 100,
        clientY: 0,
      })
      // Both fingers shift by the same +10000px -- distance (and thus scale)
      // stays put, but the midpoint moves by 10000px, clamped to maxPanX.
      fireEvent.pointerMove(body(), {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 10000,
        clientY: 0,
      })
      fireEvent.pointerMove(body(), {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 10100,
        clientY: 0,
      })

      expect(body().style.getPropertyValue('--tsd-scale')).toBe('1')
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('100px')
      expect(body().style.getPropertyValue('--tsd-pan-y')).toBe('0px')
    } finally {
      api.restore()
    }
  })

  it('dropping from two fingers to one continues panning from where it was, without a jump', async () => {
    const api = stubFullscreenApi()
    try {
      mockOverflow(200, 100) // maxPanX 100, maxPanY 50
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())

      fireEvent.pointerDown(body(), {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 0,
        clientY: 0,
      })
      fireEvent.pointerDown(body(), {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 100,
        clientY: 0,
      })
      fireEvent.pointerMove(body(), {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 10000,
        clientY: 0,
      })
      fireEvent.pointerMove(body(), {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 10100,
        clientY: 0,
      })
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('100px') // clamped, per the test above

      fireEvent.pointerUp(body(), { pointerId: 2, pointerType: 'touch' })
      // The remaining finger (id 1, last at x=10000) moves by -50 -- if
      // beginGesture() restarted from a jump instead of the pan's actual
      // current position, this would land somewhere other than 50px.
      fireEvent.pointerMove(body(), {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 9950,
        clientY: 0,
      })
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('50px')
    } finally {
      api.restore()
    }
  })

  it('ctrl+wheel (trackpad pinch) zooms and keeps the reset label in sync; a plain wheel still pans, not zooms', async () => {
    const api = stubFullscreenApi()
    try {
      mockOverflow(200, 100)
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())
      zoomIn() // something to pan into, so a plain wheel afterward has an observable effect

      fireEvent.wheel(body(), { deltaY: -500, ctrlKey: true })
      const scale = body().style.getPropertyValue('--tsd-scale')
      expect(Number(scale)).toBeGreaterThan(1.3)
      expect(resetLabel()).toBe(`${Math.round(Number(scale) * 100)}%`)

      const panXBefore = body().style.getPropertyValue('--tsd-pan-x')
      fireEvent.wheel(body(), { deltaX: 10, deltaY: 0, ctrlKey: false })
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('-10px')
      expect(body().style.getPropertyValue('--tsd-scale')).toBe(scale) // unchanged by the plain wheel
      expect(panXBefore).not.toBe(body().style.getPropertyValue('--tsd-pan-x'))
    } finally {
      api.restore()
    }
  })

  it('cmd/meta+wheel (macOS trackpad pinch) zooms the same as ctrl+wheel', async () => {
    const api = stubFullscreenApi()
    try {
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())

      fireEvent.wheel(body(), { deltaY: -500, metaKey: true })
      expect(
        Number(body().style.getPropertyValue('--tsd-scale')),
      ).toBeGreaterThan(1)
    } finally {
      api.restore()
    }
  })

  it('repeated small wheel-zoom deltas accumulate instead of rounding back to the same value each time', async () => {
    const api = stubFullscreenApi()
    try {
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())

      // Each individual tick is small enough that, if setScale() re-snapped
      // from the *previous already-applied* scale on every call (the bug
      // this guards against), the value would round right back to 1 every
      // time and never move at all.
      for (let i = 0; i < 8; i++) {
        fireEvent.wheel(body(), { deltaY: -10, ctrlKey: true })
      }
      expect(
        Number(body().style.getPropertyValue('--tsd-scale')),
      ).toBeGreaterThan(1.2)
    } finally {
      api.restore()
    }
  })

  it('a plain wheel event (trackpad two-finger pan) moves the content; ctrl+wheel (pinch-zoom) is left alone', async () => {
    const api = stubFullscreenApi()
    try {
      mockOverflow(200, 100)
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())
      zoomIn()

      fireEvent.wheel(body(), { deltaX: 20, deltaY: 10, ctrlKey: false })
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('-20px')
      expect(body().style.getPropertyValue('--tsd-pan-y')).toBe('-10px')
    } finally {
      api.restore()
    }
  })

  it('re-clamps pan back to (0, 0) and drops .pannable once zoomed back to 100%', async () => {
    const api = stubFullscreenApi()
    try {
      mockOverflow(200, 100)
      await import('../../demo/index-page-client.ts')
      api.enterSettles(grid())
      zoomIn()

      fireEvent.pointerDown(body(), {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 0,
        clientY: 0,
      })
      fireEvent.pointerMove(body(), {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 100,
        clientY: 0,
      })
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('100px')
      fireEvent.pointerUp(body(), { pointerId: 1, pointerType: 'mouse' })

      // Simulates the real browser: the output body's rendered box shrinks
      // back to the card's own size once --tsd-scale is back at 1.
      mockOverflow(0, 0)
      zoomReset()
      expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('0px')
      expect(body().style.getPropertyValue('--tsd-pan-y')).toBe('0px')
      expect(body().classList.contains('pannable')).toBe(false)
    } finally {
      api.restore()
    }
  })
})
