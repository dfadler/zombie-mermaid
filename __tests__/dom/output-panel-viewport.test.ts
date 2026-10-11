// @vitest-environment jsdom
/**
 * Proves output-panel-viewport.ts's pan/zoom gestures for the fullscreen
 * "Source → render" output panel (`DetailOutputPanel` in
 * demo/components/diagram-detail-app.tsx) actually work:
 *
 * 1. Pure-function unit tests for `clampZoom`, `pointerDistance`,
 *    `pointerMidpoint`, and `viewportTransform` -- the same
 *    "small pure function, tested directly" coverage
 *    __tests__/dom/editor-viewport.test.ts gives its own equivalents.
 * 2. Real RTL interaction tests against a mounted `<DiagramDetailApp>`,
 *    entered into fullscreen exactly like
 *    __tests__/dom/diagram-detail-fullscreen.test.ts already does (its
 *    `stubFullscreenApi` helper is duplicated here rather than shared --
 *    see that file's own header comment on why independently-bundled
 *    pages/tests each keep their own copy of a small fixture): drag to
 *    pan, two-finger pinch to zoom, ctrl-wheel to zoom, plain wheel to
 *    pan, double-click to reset, and the +/-/reset buttons.
 *
 * jsdom implements `PointerEvent` but not `Element.prototype
 * .setPointerCapture`/`hasPointerCapture`/`releasePointerCapture` (checked
 * directly against this repo's installed jsdom version while writing this
 * file) -- output-panel-viewport.ts's `el.setPointerCapture?.(...)` call is
 * exactly the optional-chaining guard that makes these tests possible at
 * all without a jsdom polyfill.
 */
import { act, createElement } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  DiagramDetailApp,
  type DiagramDetailAppProps,
} from '../../demo/components/diagram-detail-app.tsx'
import {
  IDENTITY_VIEWPORT,
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  pointerDistance,
  pointerMidpoint,
  viewportTransform,
} from '../../demo/components/output-panel-viewport.ts'

describe('clampZoom', () => {
  it('clamps to [0.25, 6]', () => {
    expect(clampZoom(100)).toBe(ZOOM_MAX)
    expect(clampZoom(0)).toBe(ZOOM_MIN)
    expect(clampZoom(2)).toBe(2)
  })
})

describe('pointerDistance / pointerMidpoint', () => {
  it('computes the straight-line distance between two points', () => {
    expect(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('computes the midpoint between two points', () => {
    expect(pointerMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({
      x: 5,
      y: 10,
    })
  })
})

describe('viewportTransform', () => {
  it('is undefined while inactive, regardless of the viewport value', () => {
    expect(
      viewportTransform({ scale: 2, tx: 10, ty: 20 }, false),
    ).toBeUndefined()
  })

  it('renders translate() scale() while active', () => {
    expect(viewportTransform({ scale: 1.5, tx: 10, ty: -5 }, true)).toBe(
      'translate(10px, -5px) scale(1.5)',
    )
  })

  it('is the identity transform at rest', () => {
    expect(viewportTransform(IDENTITY_VIEWPORT, true)).toBe(
      'translate(0px, 0px) scale(1)',
    )
  })
})

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

/** Duplicated from diagram-detail-fullscreen.test.ts -- see this file's header comment. */
function stubFullscreenApi(): {
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

  Element.prototype.requestFullscreen = vi.fn(() =>
    Promise.resolve(),
  ) as unknown as typeof Element.prototype.requestFullscreen
  document.exitFullscreen = vi.fn(() =>
    Promise.resolve(),
  ) as unknown as typeof document.exitFullscreen

  return {
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

/** Enters fullscreen via the toggle button and returns the render-area + content-wrapper elements the gesture tests below drive/assert against. */
function renderFullscreen(api: ReturnType<typeof stubFullscreenApi>): {
  renderArea: HTMLElement
  contentWrapper: HTMLElement
} {
  render(createElement(DiagramDetailApp, DETAIL_PROPS))
  const outputCard = document.querySelector('.output-card')
  if (!outputCard) throw new Error('test setup: .output-card missing')
  fireEvent.click(screen.getByTitle('View fullscreen'))
  api.enterSettles(outputCard)

  const renderArea = document.querySelector<HTMLElement>('.output-render-area')
  if (!renderArea) throw new Error('test setup: .output-render-area missing')
  const diagramFrame = document.querySelector('.diagram-frame')
  const contentWrapper = diagramFrame?.parentElement
  if (!contentWrapper) throw new Error('test setup: content wrapper missing')
  return { renderArea, contentWrapper: contentWrapper as HTMLElement }
}

describe('DetailOutputPanel pan/zoom gestures (fullscreen only)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('does not wire the pannable class or a transform outside fullscreen', () => {
    render(createElement(DiagramDetailApp, DETAIL_PROPS))
    const renderArea = document.querySelector('.output-render-area')
    expect(renderArea?.classList.contains('pannable')).toBe(false)
    const diagramFrame = document.querySelector('.diagram-frame')
    const contentWrapper = diagramFrame?.parentElement as HTMLElement
    expect(contentWrapper.style.transform).toBe('')
  })

  it('pans via a single pointer drag', () => {
    const api = stubFullscreenApi()
    try {
      const { renderArea, contentWrapper } = renderFullscreen(api)
      expect(renderArea.classList.contains('pannable')).toBe(true)

      fireEvent.pointerDown(renderArea, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 100,
        clientY: 100,
      })
      expect(renderArea.classList.contains('panning')).toBe(true)

      fireEvent.pointerMove(renderArea, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 130,
        clientY: 80,
      })
      expect(contentWrapper.style.transform).toBe(
        'translate(30px, -20px) scale(1)',
      )

      fireEvent.pointerUp(renderArea, { pointerId: 1, pointerType: 'mouse' })
      expect(renderArea.classList.contains('panning')).toBe(false)
    } finally {
      api.restore()
    }
  })

  it('pinch-zooms via two tracked pointers', () => {
    const api = stubFullscreenApi()
    try {
      const { renderArea, contentWrapper } = renderFullscreen(api)

      fireEvent.pointerDown(renderArea, {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 90,
        clientY: 100,
      })
      fireEvent.pointerDown(renderArea, {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 110,
        clientY: 100,
      })
      // Starting distance 20px -> 60px is a 3x pinch-out.
      fireEvent.pointerMove(renderArea, {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 70,
        clientY: 100,
      })
      fireEvent.pointerMove(renderArea, {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 130,
        clientY: 100,
      })

      expect(contentWrapper.style.transform).toBe(
        'translate(0px, 0px) scale(3)',
      )
    } finally {
      api.restore()
    }
  })

  it('zooms with ctrl+wheel and pans with a plain wheel', () => {
    const api = stubFullscreenApi()
    try {
      const { renderArea, contentWrapper } = renderFullscreen(api)

      fireEvent.wheel(renderArea, { deltaY: -500, ctrlKey: true })
      const afterZoomIn = contentWrapper.style.transform
      expect(afterZoomIn).not.toBe('translate(0px, 0px) scale(1)')
      const scaleMatch = /scale\(([\d.]+)\)/.exec(afterZoomIn)
      expect(Number(scaleMatch?.[1])).toBeGreaterThan(1)

      fireEvent.wheel(renderArea, { deltaX: 10, deltaY: 20, ctrlKey: false })
      expect(contentWrapper.style.transform).toContain(
        'translate(-10px, -20px)',
      )
    } finally {
      api.restore()
    }
  })

  it('resets to identity on double-click', () => {
    const api = stubFullscreenApi()
    try {
      const { renderArea, contentWrapper } = renderFullscreen(api)
      fireEvent.wheel(renderArea, { deltaY: -500, ctrlKey: true })
      expect(contentWrapper.style.transform).not.toBe(
        'translate(0px, 0px) scale(1)',
      )

      fireEvent.doubleClick(renderArea)
      expect(contentWrapper.style.transform).toBe(
        'translate(0px, 0px) scale(1)',
      )
    } finally {
      api.restore()
    }
  })

  it('the +/-/reset buttons zoom and reset, and the reset button shows the current percentage', () => {
    const api = stubFullscreenApi()
    try {
      renderFullscreen(api)
      const contentWrapper = document.querySelector('.diagram-frame')
        ?.parentElement as HTMLElement

      const zoomInBtn = screen.getByTitle('Zoom in')
      fireEvent.click(zoomInBtn)
      expect(contentWrapper.style.transform).toBe(
        'translate(0px, 0px) scale(1.25)',
      )
      expect(screen.getByTitle('Reset zoom')).toHaveTextContent('125%')

      fireEvent.click(screen.getByTitle('Zoom out'))
      expect(contentWrapper.style.transform).toBe(
        'translate(0px, 0px) scale(1)',
      )

      fireEvent.click(zoomInBtn)
      fireEvent.click(screen.getByTitle('Reset zoom'))
      expect(contentWrapper.style.transform).toBe(
        'translate(0px, 0px) scale(1)',
      )
    } finally {
      api.restore()
    }
  })

  it('hides the zoom controls outside fullscreen', () => {
    render(createElement(DiagramDetailApp, DETAIL_PROPS))
    expect(screen.queryByTitle('Zoom in')).toBeNull()
    expect(screen.queryByTitle('Zoom out')).toBeNull()
    expect(screen.queryByTitle('Reset zoom')).toBeNull()
  })

  it('resets the viewport when re-entering fullscreen after exiting zoomed', () => {
    const api = stubFullscreenApi()
    try {
      const { renderArea, contentWrapper } = renderFullscreen(api)
      fireEvent.wheel(renderArea, { deltaY: -500, ctrlKey: true })
      expect(contentWrapper.style.transform).not.toBe(
        'translate(0px, 0px) scale(1)',
      )

      const outputCard = document.querySelector('.output-card')
      if (!outputCard) throw new Error('test setup: .output-card missing')
      fireEvent.click(screen.getByTitle('Exit fullscreen'))
      api.exitSettles()

      fireEvent.click(screen.getByTitle('View fullscreen'))
      api.enterSettles(outputCard)

      const reopenedWrapper = document.querySelector('.diagram-frame')
        ?.parentElement as HTMLElement
      expect(reopenedWrapper.style.transform).toBe(
        'translate(0px, 0px) scale(1)',
      )
    } finally {
      api.restore()
    }
  })
})
