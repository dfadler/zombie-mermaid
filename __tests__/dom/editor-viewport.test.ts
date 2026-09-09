// @vitest-environment jsdom
/**
 * Proves zombie-mermaid#807's zoom/pan/panel-resize React state actually
 * works, replacing `editor/__tests__/zoom.test.ts`'s old
 * `createEditorEnv()` + `window.eval` approach (that harness evaluated the
 * raw `editor/js/*.ts` bundle directly -- `applyZoom`/`getSvgNaturalSize`/
 * `state.zoom` no longer exist there at all, #807 moved them here) with
 * this repo's React Testing Library pattern (`__tests__/dom/
 * rtl-example.test.ts`):
 *
 * 1. Pure-function unit tests for `clampZoom`, `getSvgNaturalSize`,
 *    `clampPanelWidth`, and `applyZoomToDom` -- the same "small pure
 *    function, tested directly" coverage `zoom.test.ts` used to give
 *    `getSvgNaturalSize`.
 * 2. `editorReducer` tests for the new #807 actions, alongside #806's own
 *    `editorReducer` tests in `__tests__/dom/editor-hydration.test.ts`.
 * 3. Real RTL interaction tests against a mounted `<EditorApp>`: click the
 *    zoom buttons and assert the rendered SVG + label change; toggle pan
 *    and drag the preview to assert scroll position changes; drag the
 *    resize handle and assert the left panel's width changes. `fireEvent`
 *    (not `userEvent`) drives the drag sequences -- `userEvent.pointer()`
 *    models `PointerEvent`s, but the app's own listeners (mirroring
 *    `editor/js/pan.ts`'s/`resize.ts`'s old plain `mousedown`/`mousemove`/
 *    `mouseup` wiring) listen for `MouseEvent`s specifically, so
 *    `fireEvent.mouseDown`/`mouseMove`/`mouseUp` is what actually reaches
 *    them (confirmed empirically while writing this file: `userEvent.click`
 *    still works for the plain zoom/pan-toggle buttons since a click is a
 *    real `MouseEvent` too, but a drag sequence needs the lower-level API).
 */
import { act, createElement } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  EditorApp,
  INITIAL_EDITOR_STATE,
  editorReducer,
  type EditorAppProps,
} from '../../demo/components/editor-app.tsx'
import {
  applyZoomToDom,
  clampPanelWidth,
  clampZoom,
  getSvgNaturalSize,
  PANEL_RESIZE_MAX_WIDTH_RATIO,
  PANEL_RESIZE_MIN_WIDTH,
  ZOOM_MAX,
  ZOOM_MIN,
} from '../../demo/components/editor-viewport.ts'

const PROPS: EditorAppProps = {
  themes: [{ key: 'nord', bg: '#2E3440', label: 'Nord' }],
}

describe('clampZoom (#807)', () => {
  it('clamps to [0.1, 8], matching editor/js/zoom.ts’s old applyZoom clamp', () => {
    expect(clampZoom(100)).toBe(ZOOM_MAX)
    expect(clampZoom(0)).toBe(ZOOM_MIN)
    expect(clampZoom(2)).toBe(2)
  })
})

describe('getSvgNaturalSize (#807, moved from editor/js/zoom.ts)', () => {
  it('prefers the viewBox over attributes', () => {
    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    ) as unknown as SVGSVGElement
    svg.setAttribute('viewBox', '0 0 300 150')
    svg.setAttribute('width', '999')
    svg.setAttribute('height', '999')
    expect(getSvgNaturalSize(svg)).toEqual({ w: 300, h: 150 })
  })

  it('falls back to width/height attributes without a viewBox', () => {
    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    ) as unknown as SVGSVGElement
    svg.setAttribute('width', '640')
    svg.setAttribute('height', '480')
    expect(getSvgNaturalSize(svg)).toEqual({ w: 640, h: 480 })
  })
})

describe('clampPanelWidth (#807, moved from editor/js/resize.ts)', () => {
  it('clamps to [280, 0.75 * window width]', () => {
    expect(clampPanelWidth(50, 1000)).toBe(PANEL_RESIZE_MIN_WIDTH)
    expect(clampPanelWidth(10000, 1000)).toBe(
      1000 * PANEL_RESIZE_MAX_WIDTH_RATIO,
    )
    expect(clampPanelWidth(400, 1000)).toBe(400)
  })
})

describe('applyZoomToDom (#807)', () => {
  it('does nothing when refs is null', () => {
    expect(() => applyZoomToDom(null, 2)).not.toThrow()
  })
})

describe('editorReducer (#807 zoom/pan/resize actions)', () => {
  it('SET_ZOOM clamps the stored value', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_ZOOM',
      zoom: 100,
    })
    expect(next.zoom).toBe(ZOOM_MAX)
  })

  it('ZOOM_BY_FACTOR compounds across repeated dispatches against the reducer’s own prior state, not a caller snapshot', () => {
    // Regression test for a real bug found via live-browser (CDP)
    // verification while building this PR: editor-viewport.ts's zoom
    // handlers originally dispatched SET_ZOOM with a *precomputed*
    // `stateRef.current.zoom * 1.25`. Three zoom-in clicks fired
    // synchronously (no render in between, since `stateRef.current` only
    // updates on a render) all read the same stale zoom and collapsed to
    // one step (125% instead of ~195%). ZOOM_BY_FACTOR fixes this by
    // letting the reducer -- which React guarantees sees each action
    // applied against the true result of the one before it -- do the
    // multiplication instead. This test exercises the reducer directly,
    // simulating three dispatches queued back-to-back exactly as React
    // would apply them in one batch.
    let state = INITIAL_EDITOR_STATE
    for (let i = 0; i < 3; i++) {
      state = editorReducer(state, { type: 'ZOOM_BY_FACTOR', factor: 1.25 })
    }
    expect(state.zoom).toBeCloseTo(1.953125) // 1 * 1.25^3
  })

  it('ZOOM_BY_FACTOR clamps to [0.1, 8]', () => {
    const zoomedOut = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'ZOOM_BY_FACTOR',
      factor: 0.001,
    })
    expect(zoomedOut.zoom).toBe(ZOOM_MIN)

    const zoomedIn = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'ZOOM_BY_FACTOR',
      factor: 1000,
    })
    expect(zoomedIn.zoom).toBe(ZOOM_MAX)
  })

  it('TOGGLE_PAN_ACTIVE flips panActive', () => {
    const on = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'TOGGLE_PAN_ACTIVE',
    })
    expect(on.panActive).toBe(true)
    const off = editorReducer(on, { type: 'TOGGLE_PAN_ACTIVE' })
    expect(off.panActive).toBe(false)
  })

  it('SET_PANNING updates isPanning only', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_PANNING',
      panning: true,
    })
    expect(next).toEqual({ ...INITIAL_EDITOR_STATE, isPanning: true })
  })

  it('SET_PANEL_LEFT_WIDTH updates panelLeftWidth only', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_PANEL_LEFT_WIDTH',
      width: 400,
    })
    expect(next).toEqual({ ...INITIAL_EDITOR_STATE, panelLeftWidth: 400 })
  })

  it('SET_RESIZING_PANEL updates isResizingPanel only', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_RESIZING_PANEL',
      resizing: true,
    })
    expect(next).toEqual({ ...INITIAL_EDITOR_STATE, isResizingPanel: true })
  })
})

describe('<EditorApp> zoom/pan/resize interaction (#807)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function seedRenderedSvg(): SVGSVGElement {
    const previewInner = document.getElementById('preview-inner')!
    previewInner.innerHTML =
      '<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"></svg>'
    return previewInner.querySelector('svg') as unknown as SVGSVGElement
  }

  it('zoom-in/out/fit buttons scale the rendered SVG and update the label', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))
    const svg = seedRenderedSvg() as unknown as SVGSVGElement & {
      style: CSSStyleDeclaration
    }

    await user.click(screen.getByTitle('Zoom in'))
    expect(svg.style.width).toBe('125px') // 100 * 1.25
    expect(svg.style.height).toBe('62.5px')
    expect(screen.getByText('125%')).toBeInTheDocument()

    await user.click(screen.getByTitle('Zoom out'))
    expect(screen.getByText('100%')).toBeInTheDocument()

    await user.click(screen.getByTitle('Zoom in'))
    await user.click(screen.getByTitle('Fit to view'))
    expect(svg.style.width).toBe('100px')
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('clamps zoom at the upper bound via repeated zoom-in clicks', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))
    seedRenderedSvg()

    const zoomIn = screen.getByTitle('Zoom in')
    for (let i = 0; i < 20; i++) {
      await user.click(zoomIn)
    }
    expect(screen.getByText('800%')).toBeInTheDocument()
  })

  it('toggles pan mode and applies the active class', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))
    const panBtn = screen.getByTitle('Pan (hold to drag)')
    const previewBody = document.getElementById('preview-body')!

    expect(panBtn).not.toHaveClass('active')
    await user.click(panBtn)
    expect(panBtn).toHaveClass('active')
    expect(previewBody).toHaveClass('pan-mode')

    await user.click(panBtn)
    expect(panBtn).not.toHaveClass('active')
    expect(previewBody).not.toHaveClass('pan-mode')
  })

  it('dragging the preview while pan is active scrolls it, and applies the panning class mid-drag', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))
    const previewBody = document.getElementById('preview-body')!
    await user.click(screen.getByTitle('Pan (hold to drag)'))

    fireEvent.mouseDown(previewBody, { clientX: 100, clientY: 100, button: 0 })
    expect(previewBody).toHaveClass('panning')

    fireEvent.mouseMove(window, { clientX: 150, clientY: 130 })
    expect(previewBody.scrollLeft).toBe(-50)
    expect(previewBody.scrollTop).toBe(-30)

    fireEvent.mouseUp(window)
    expect(previewBody).not.toHaveClass('panning')

    // Further movement after mouseup should not keep scrolling.
    fireEvent.mouseMove(window, { clientX: 400, clientY: 400 })
    expect(previewBody.scrollLeft).toBe(-50)
  })

  it('does not pan when the pan tool is off and no modifier key is held', () => {
    render(createElement(EditorApp, PROPS))
    const previewBody = document.getElementById('preview-body')!

    fireEvent.mouseDown(previewBody, { clientX: 100, clientY: 100, button: 0 })
    fireEvent.mouseMove(window, { clientX: 200, clientY: 200 })

    expect(previewBody.scrollLeft).toBe(0)
    expect(previewBody).not.toHaveClass('panning')
  })

  it('ctrl/cmd + wheel zooms instead of scrolling', () => {
    render(createElement(EditorApp, PROPS))
    seedRenderedSvg()
    const previewBody = document.getElementById('preview-body')!

    fireEvent.wheel(previewBody, { deltaY: -500, ctrlKey: true })
    expect(screen.getByText(/^(?!100%).*%$/)).toBeInTheDocument()
  })

  it('dragging the resize handle changes the left panel width', () => {
    render(createElement(EditorApp, PROPS))
    const panelLeft = document.getElementById('panel-left')!
    const resizeHandle = document.getElementById('resize-handle')!

    vi.spyOn(panelLeft, 'getBoundingClientRect').mockReturnValue({
      width: 320,
    } as DOMRect)

    fireEvent.mouseDown(resizeHandle, { clientX: 500 })
    expect(resizeHandle).toHaveClass('dragging')
    expect(document.body.style.cursor).toBe('col-resize')

    fireEvent.mouseMove(document, { clientX: 550 })
    expect(panelLeft.style.width).toBe('370px') // 320 + 50

    fireEvent.mouseUp(document)
    expect(resizeHandle).not.toHaveClass('dragging')
    expect(document.body.style.cursor).toBe('')

    // Further movement after mouseup should not keep resizing.
    fireEvent.mouseMove(document, { clientX: 900 })
    expect(panelLeft.style.width).toBe('370px')
  })

  it('clamps the resized width to the [280, 0.75 * window width] range', () => {
    render(createElement(EditorApp, PROPS))
    const panelLeft = document.getElementById('panel-left')!
    const resizeHandle = document.getElementById('resize-handle')!
    vi.spyOn(panelLeft, 'getBoundingClientRect').mockReturnValue({
      width: 320,
    } as DOMRect)

    fireEvent.mouseDown(resizeHandle, { clientX: 500 })
    fireEvent.mouseMove(document, { clientX: -10000 })
    expect(panelLeft.style.width).toBe('280px')
    fireEvent.mouseUp(document)
  })

  it('registers window.__editorViewportState for editor/js/rendering.ts to call', async () => {
    render(createElement(EditorApp, PROPS))
    const svg = seedRenderedSvg() as unknown as SVGSVGElement & {
      style: CSSStyleDeclaration
    }

    expect(window.__editorViewportState.getZoom()).toBe(1)

    const user = userEvent.setup()
    await user.click(screen.getByTitle('Zoom in'))
    expect(window.__editorViewportState.getZoom()).toBe(1.25)

    // Simulates rendering.ts's doRender() swapping in a fresh SVG, then
    // reapplying the current zoom via the bridge.
    seedRenderedSvg()
    act(() => {
      window.__editorViewportState.applyZoom()
    })
    expect(svg.isConnected).toBe(false) // replaced by seedRenderedSvg() above
    const freshSvg = document.querySelector(
      '#preview-inner svg',
    ) as unknown as SVGSVGElement & { style: CSSStyleDeclaration }
    expect(freshSvg.style.width).toBe('125px')
  })
})
