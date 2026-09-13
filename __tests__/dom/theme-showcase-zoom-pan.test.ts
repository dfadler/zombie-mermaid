// @vitest-environment jsdom
/**
 * Guards `demo/index-page-client.ts`'s `initThemeShowcaseZoomControl()` --
 * scale (zombie-mermaid#987) and pan (zombie-mermaid#988), one function
 * (see that function's own doc comment for why they share it). The module
 * runs its wiring as side effects at import time (mirroring how it
 * actually runs on a real page load, and matching
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
 * `initThemeShowcaseZoomControl()` reads keeps these tests focused on the
 * zoom+pan behavior itself rather than on reproducing that component.
 *
 * jsdom implements `PointerEvent` but not `Element.prototype
 * .setPointerCapture` (confirmed directly against this repo's installed
 * jsdom version, same as `__tests__/dom/output-panel-viewport.test.ts`'s
 * own header comment) -- `index-page-client.ts`'s `body.setPointerCapture?.
 * (...)` call is exactly the optional-chaining guard that makes these
 * tests possible without a jsdom polyfill. `getBoundingClientRect` is
 * likewise mocked directly (jsdom does no real layout), the same technique
 * `__tests__/dom/editor-viewport.test.ts`'s resize-handle tests use --
 * `mockOverflow()` below simulates how much the (already-scaled)
 * `#theme-showcase-output-body` box overflows `#theme-showcase-diagram-
 * card`'s own, which is what `recomputePanBounds()` actually measures.
 */
import { fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function buildDom(): void {
  document.body.innerHTML = `
    <div id="theme-showcase-diagram-card" data-output-mode="svg">
      <div class="theme-showcase-output-toggle">
        <div class="theme-showcase-scale" id="theme-showcase-scale">
          <button
            type="button"
            id="theme-showcase-scale-trigger"
            aria-haspopup="true"
            aria-expanded="false"
            aria-controls="theme-showcase-scale-panel"
          >
            <span id="theme-showcase-scale-value">100%</span>
          </button>
          <div
            class="theme-showcase-scale-panel"
            id="theme-showcase-scale-panel"
            role="group"
            hidden
          >
            <input
              type="range"
              id="theme-showcase-scale-slider"
              min="0.5"
              max="2.5"
              step="0.1"
              value="1"
            />
          </div>
        </div>
      </div>
      <div class="theme-showcase-output-body" id="theme-showcase-output-body">
        <svg id="theme-showcase-diagram"></svg>
      </div>
    </div>
  `
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

function slider(): HTMLInputElement {
  const el = document.getElementById('theme-showcase-scale-slider')
  if (!(el instanceof HTMLInputElement)) throw new Error('missing slider')
  return el
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

function setScale(value: string): void {
  const el = slider()
  el.value = value
  fireEvent.input(el)
}

beforeEach(() => {
  vi.resetModules()
  buildDom()
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('initThemeShowcaseZoomControl: scale (#987)', () => {
  it('writes --tsd-scale and the percent label on slider input', async () => {
    await import('../../demo/index-page-client.ts')
    setScale('1.8')
    expect(body().style.getPropertyValue('--tsd-scale')).toBe('1.8')
    expect(
      document.getElementById('theme-showcase-scale-value')?.textContent,
    ).toBe('180%')
  })

  it('clamps an out-of-range value to SCALE_MIN/SCALE_MAX', async () => {
    await import('../../demo/index-page-client.ts')
    setScale('99')
    expect(body().style.getPropertyValue('--tsd-scale')).toBe('2.5')
    setScale('-5')
    expect(body().style.getPropertyValue('--tsd-scale')).toBe('0.5')
  })
})

describe('initThemeShowcaseZoomControl: disclosure (pre-existing #987 behavior, guarded here since this function now also owns pan)', () => {
  it('opens on trigger click (focusing the slider) and closes on Escape (refocusing the trigger)', async () => {
    await import('../../demo/index-page-client.ts')
    const trigger = document.getElementById(
      'theme-showcase-scale-trigger',
    ) as HTMLButtonElement
    const panel = document.getElementById(
      'theme-showcase-scale-panel',
    ) as HTMLElement

    expect(panel.hidden).toBe(true)
    fireEvent.click(trigger)
    expect(panel.hidden).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(slider())

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel.hidden).toBe(true)
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on outside click', async () => {
    await import('../../demo/index-page-client.ts')
    const trigger = document.getElementById(
      'theme-showcase-scale-trigger',
    ) as HTMLButtonElement
    const panel = document.getElementById(
      'theme-showcase-scale-panel',
    ) as HTMLElement

    fireEvent.click(trigger)
    expect(panel.hidden).toBe(false)
    fireEvent.click(document.body)
    expect(panel.hidden).toBe(true)
  })
})

describe('initThemeShowcaseZoomControl: pan (#988)', () => {
  it('is a no-op at 100% scale -- no .pannable, drag never starts, --tsd-pan-x stays unset', async () => {
    mockOverflow(0, 0)
    await import('../../demo/index-page-client.ts')
    setScale('1')
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
  })

  it('marks .pannable once zoomed content overflows the card, and mouse drag pans within bounds', async () => {
    mockOverflow(200, 100) // maxPanX 100, maxPanY 50
    await import('../../demo/index-page-client.ts')
    setScale('2')
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
  })

  it('a mouse drag past the edge clamps to maxPanX/maxPanY, not past it', async () => {
    mockOverflow(200, 100) // maxPanX 100, maxPanY 50
    await import('../../demo/index-page-client.ts')
    setScale('2')

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
  })

  it('single-finger touch drag pans the same as mouse drag', async () => {
    mockOverflow(200, 100)
    await import('../../demo/index-page-client.ts')
    setScale('2')

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
  })

  it('ignores a second simultaneous pointer instead of pinching (#988 is single-finger drag only)', async () => {
    mockOverflow(200, 100)
    await import('../../demo/index-page-client.ts')
    setScale('2')

    fireEvent.pointerDown(body(), {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    })
    fireEvent.pointerDown(body(), {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 50,
      clientY: 0,
    })
    fireEvent.pointerMove(body(), {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 200,
      clientY: 0,
    })
    // Pointer 2 was never accepted as the active drag -- its move is ignored.
    expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('0px')

    fireEvent.pointerMove(body(), {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 30,
      clientY: 0,
    })
    expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('30px')
  })

  it('a plain wheel event (trackpad two-finger pan) moves the content; ctrl+wheel (pinch-zoom) is left alone', async () => {
    mockOverflow(200, 100)
    await import('../../demo/index-page-client.ts')
    setScale('2')

    fireEvent.wheel(body(), { deltaX: 20, deltaY: 10, ctrlKey: false })
    expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('-20px')
    expect(body().style.getPropertyValue('--tsd-pan-y')).toBe('-10px')

    fireEvent.wheel(body(), { deltaX: 5, deltaY: 5, ctrlKey: true })
    expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('-20px')
    expect(body().style.getPropertyValue('--tsd-pan-y')).toBe('-10px')
  })

  it('re-clamps pan back to (0, 0) and drops .pannable once the slider returns to 100%', async () => {
    mockOverflow(200, 100)
    await import('../../demo/index-page-client.ts')
    setScale('2')

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
    setScale('1')
    expect(body().style.getPropertyValue('--tsd-pan-x')).toBe('0px')
    expect(body().style.getPropertyValue('--tsd-pan-y')).toBe('0px')
    expect(body().classList.contains('pannable')).toBe(false)
  })
})
