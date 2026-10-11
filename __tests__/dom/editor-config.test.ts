// @vitest-environment jsdom
/**
 * Proves zombie-mermaid#808's color picker, font picker, and config panel
 * React state actually works, replacing the deleted
 * `editor/js/color-picker.ts`/`font-picker.ts`/`config-panel.ts` (and the
 * `editor/__tests__/config.test.ts` coverage that used to exercise them
 * through `createEditorEnv()` + `window.eval`) with this repo's React
 * Testing Library pattern (`__tests__/dom/rtl-example.test.ts`,
 * `__tests__/dom/editor-viewport.test.ts`):
 *
 * 1. Pure-function unit tests for `clampPadding`, `clampStroke`,
 *    `computeConfig`, `applyStrokeOverridesToSvg`, `getEffectiveThemeColor`,
 *    `isValidHexColor`, and `getFontDisplayLabel` -- the same "small pure
 *    function, tested directly" coverage `config.test.ts`'s deleted
 *    "stroke overrides" describe block used to give `applyStrokeOverrides`.
 *    zombie-mermaid#935's audit moved these (and the constants below) out
 *    of `editor-config.tsx` into `editor-config-helpers.ts` -- a
 *    dependency-free module the split-out `ColorField`/`ColorPopup`/
 *    `FontPopup`/`NumberSliderField` components can all import from without
 *    an import cycle through `editor-config.tsx`'s own `ConfigPanel` -- see
 *    that file's header comment for the full audit writeup. Behavior is
 *    unchanged; only the import path moved.
 * 2. `editorReducer` tests for the new #808 actions, alongside #806's/
 *    #807's own `editorReducer` tests in `editor-hydration.test.ts`/
 *    `editor-viewport.test.ts`.
 * 3. Real RTL interaction tests against a mounted `<EditorApp>`: open the
 *    color popup and pick a preset/type a hex value/clear an override;
 *    open the font popup, search, and select a font; drag the padding/
 *    stroke sliders -- then assert the rendered UI *and*
 *    `window.__editorConfigState` (`editor/js/rendering.ts`'s bridge)
 *    reflect it.
 * 4. Regression coverage for a real bug live-browser (CDP) verification
 *    caught while building this PR: picking a color/font/padding value
 *    updated `window.__editorConfigState`'s config and the config panel's
 *    own UI correctly, but the diagram preview itself never re-rendered --
 *    nothing told `editor/js/rendering.ts`'s `scheduleRender()` to run, since
 *    the deleted legacy modules used to call it directly and this React
 *    port dropped that call entirely. Fixed via the reverse-direction
 *    `window.__editorRenderTrigger` bridge (`rendering.ts`'s own
 *    registration comment has the full account) -- these tests assert it's
 *    actually called, with the same delays the deleted modules used.
 */
import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EditorApp,
  INITIAL_EDITOR_STATE,
  editorReducer,
  type EditorAppProps,
} from '../../demo/components/editor-app.tsx'
import { EDITOR_EFFECTIVE_THEME_EVENT } from '../../demo/components/editor-config.tsx'
import {
  applyStrokeOverridesToSvg,
  clampPadding,
  clampStroke,
  computeConfig,
  DEFAULT_PADDING,
  DEFAULT_STROKE,
  getEffectiveThemeColor,
  getFontDisplayLabel,
  isValidHexColor,
  PADDING_MAX,
  PADDING_MIN,
  STROKE_MAX,
  STROKE_MIN,
} from '../../demo/components/editor-config-helpers.ts'

const PROPS: EditorAppProps = {
  themes: [{ key: 'nord', bg: '#2E3440', label: 'Nord' }],
}

describe('clampPadding (#808)', () => {
  it('clamps to [0, 120] and rounds', () => {
    expect(clampPadding(500)).toBe(PADDING_MAX)
    expect(clampPadding(-20)).toBe(PADDING_MIN)
    expect(clampPadding(40.6)).toBe(41)
  })
})

describe('clampStroke (#808)', () => {
  it('clamps to [0.25, 6] and rounds to the nearest quarter-step, matching editor/js/config-panel.ts’s old makeStrokeSetter', () => {
    expect(clampStroke(100)).toBe(STROKE_MAX)
    expect(clampStroke(0)).toBe(STROKE_MIN)
    expect(clampStroke(2.1)).toBe(2)
    expect(clampStroke(2.4)).toBe(2.5)
  })
})

describe('computeConfig (#808, moved from editor/js/config-panel.ts’s readConfig)', () => {
  it('includes only overridden fields', () => {
    const colors = {
      bg: '',
      fg: '',
      accent: '',
      line: '',
      muted: '',
      surface: '',
    }
    expect(computeConfig(colors, '', DEFAULT_PADDING)).toEqual({})
    expect(computeConfig({ ...colors, bg: '#111111' }, 'Inter', 40)).toEqual({
      bg: '#111111',
      font: 'Inter',
      padding: 40,
    })
  })

  it('omits padding when it equals the default', () => {
    const colors = {
      bg: '',
      fg: '',
      accent: '',
      line: '',
      muted: '',
      surface: '',
    }
    expect(computeConfig(colors, '', DEFAULT_PADDING).padding).toBeUndefined()
  })
})

describe('getEffectiveThemeColor (#808, moved from editor/js/config-panel.ts’s getThemeColor)', () => {
  const themes = { nord: { bg: '#2E3440', fg: '#D8DEE9', accent: '#88C0D0' } }

  it('returns null when no theme is selected', () => {
    expect(getEffectiveThemeColor(themes, '', 'bg')).toBeNull()
  })

  it('returns null for an unset color on an otherwise-known theme', () => {
    expect(getEffectiveThemeColor(themes, 'nord', 'line')).toBeNull()
  })

  it('returns the theme’s color for a known key', () => {
    expect(getEffectiveThemeColor(themes, 'nord', 'bg')).toBe('#2E3440')
    expect(getEffectiveThemeColor(themes, 'nord', 'accent')).toBe('#88C0D0')
  })

  it('returns null when themes is undefined (renderer bundle not loaded yet)', () => {
    expect(getEffectiveThemeColor(undefined, 'nord', 'bg')).toBeNull()
  })
})

describe('isValidHexColor (#808)', () => {
  it('accepts a 6-digit hex with a leading #', () => {
    expect(isValidHexColor('#abcdef')).toBe(true)
    expect(isValidHexColor('#ABCDEF')).toBe(true)
  })
  it('rejects anything else', () => {
    expect(isValidHexColor('abcdef')).toBe(false)
    expect(isValidHexColor('#abc')).toBe(false)
    expect(isValidHexColor('')).toBe(false)
  })
})

describe('getFontDisplayLabel (#808)', () => {
  it('shows "Default" for an unset font', () => {
    expect(getFontDisplayLabel('')).toBe('Default')
  })
  it('shows the preset’s human name for a known value', () => {
    expect(getFontDisplayLabel('Fira Code')).toBe('Fira Code')
  })
  it('falls back to the raw value for an unknown (e.g. browser-loaded) font', () => {
    expect(getFontDisplayLabel('Comic Sans MS')).toBe('Comic Sans MS')
  })
})

describe('applyStrokeOverridesToSvg (#808, moved from editor/js/config-panel.ts)', () => {
  it('does nothing when svgEl is null', () => {
    expect(() => applyStrokeOverridesToSvg(null, 3, 2)).not.toThrow()
  })

  it('applies edge/node stroke-width to non-defs elements only', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML = `
      <defs><marker id="m"><path fill="none" /></marker></defs>
      <line x1="0" y1="0" x2="1" y2="1"></line>
      <rect width="10" height="10"></rect>
    `
    document.body.appendChild(svg)

    applyStrokeOverridesToSvg(svg as unknown as SVGSVGElement, 3, 2)

    expect(svg.querySelector('line')!.getAttribute('stroke-width')).toBe('3')
    expect(svg.querySelector('rect')!.getAttribute('stroke-width')).toBe('2')
    // The path lives inside <defs> and must be left alone.
    expect(
      svg.querySelector('defs path')!.getAttribute('stroke-width'),
    ).toBeNull()
    svg.remove()
  })

  it('is a no-op at the default stroke value of 1', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML = '<line x1="0" y1="0" x2="1" y2="1"></line>'
    applyStrokeOverridesToSvg(svg as unknown as SVGSVGElement, 1, 1)
    expect(svg.querySelector('line')!.getAttribute('stroke-width')).toBeNull()
  })
})

describe('editorReducer (#808 color/font/padding/stroke actions)', () => {
  it('SET_COLOR sets the color and recomputes config', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_COLOR',
      key: 'accent',
      value: '#ff0000',
    })
    expect(next.colors.accent).toBe('#ff0000')
    expect(next.config).toEqual({ accent: '#ff0000' })
    // Other colors untouched.
    expect(next.colors.bg).toBe('')
  })

  it('SET_FONT sets the font and recomputes config', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_FONT',
      font: 'Inter',
    })
    expect(next.font).toBe('Inter')
    expect(next.config).toEqual({ font: 'Inter' })
  })

  it('SET_PADDING clamps and recomputes config', () => {
    const next = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_PADDING',
      padding: 500,
    })
    expect(next.padding).toBe(PADDING_MAX)
    expect(next.config).toEqual({ padding: PADDING_MAX })

    const backToDefault = editorReducer(next, {
      type: 'SET_PADDING',
      padding: DEFAULT_PADDING,
    })
    expect(backToDefault.config).toEqual({})
  })

  it('SET_EDGE_STROKE/SET_NODE_STROKE update independently and clamp, without touching config', () => {
    const edge = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'SET_EDGE_STROKE',
      value: 100,
    })
    expect(edge.edgeStroke).toBe(STROKE_MAX)
    expect(edge.nodeStroke).toBe(DEFAULT_STROKE)
    expect(edge.config).toEqual({})

    const node = editorReducer(edge, { type: 'SET_NODE_STROKE', value: -5 })
    expect(node.nodeStroke).toBe(STROKE_MIN)
    expect(node.edgeStroke).toBe(STROKE_MAX)
  })
})

describe('<EditorApp> color/font/config interaction (#808)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete (window as { __mermaid?: unknown }).__mermaid
    delete window.__editorRenderTrigger
  })

  it('calls window.__editorRenderTrigger.scheduleRender() on a color/font/padding change, matching the deleted legacy modules’ delays -- regression test for a real bug live-browser verification caught', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))
    // zombie-mermaid#810: window.__editorRenderTrigger is now registered by
    // the real demo/components/editor-rendering.ts's useEditorRendering,
    // called from <EditorApp>'s own body -- mounting above already
    // overwrites any pre-set stub, so this spy has to replace it *after*
    // mount instead (safe: that registration effect only ever runs once,
    // on mount, so nothing re-clobbers it afterward).
    const scheduleRender = vi.fn()
    window.__editorRenderTrigger = { scheduleRender }

    await user.click(document.querySelector('.color-edit-btn[data-cfg="bg"]')!)
    await user.click(screen.getByTitle('#ff5722'))
    expect(scheduleRender).toHaveBeenLastCalledWith(200)

    const hexInput = document.getElementById(
      'color-hex-input',
    ) as HTMLInputElement
    await user.clear(hexInput)
    await user.type(hexInput, '#abcdef')
    expect(scheduleRender).toHaveBeenLastCalledWith(400)

    await user.click(document.getElementById('color-clear-btn')!)
    expect(scheduleRender).toHaveBeenLastCalledWith(200)

    await user.click(document.getElementById('font-select-btn')!)
    await user.click(screen.getByText('Fira Code'))
    expect(scheduleRender).toHaveBeenLastCalledWith(0)

    scheduleRender.mockClear()
    fireEvent.change(document.getElementById('cfg-padding')!, {
      target: { value: '80' },
    })
    expect(scheduleRender).toHaveBeenLastCalledWith(200)
  })

  it('does not call scheduleRender for an edge/node stroke change -- applied directly to the live SVG instead', () => {
    render(createElement(EditorApp, PROPS))
    // See the previous test's identical comment -- must replace the real
    // bridge *after* mount, not before.
    const scheduleRender = vi.fn()
    window.__editorRenderTrigger = { scheduleRender }
    const previewInner = document.getElementById('preview-inner')!
    previewInner.innerHTML =
      '<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="0" x2="1" y2="1"></line></svg>'

    fireEvent.change(document.getElementById('cfg-edge-stroke')!, {
      target: { value: '3' },
    })

    expect(scheduleRender).not.toHaveBeenCalled()
    expect(
      previewInner.querySelector('line')!.getAttribute('stroke-width'),
    ).toBe('3')
  })

  it('registers window.__editorConfigState for editor/js/rendering.ts to call', () => {
    render(createElement(EditorApp, PROPS))
    expect(window.__editorConfigState.getConfig()).toEqual({})

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML = '<line x1="0" y1="0" x2="1" y2="1"></line>'
    window.__editorConfigState.applyStrokeOverrides(
      svg as unknown as SVGSVGElement,
    )
    // Default stroke (1) -- no attribute written.
    expect(svg.querySelector('line')!.getAttribute('stroke-width')).toBeNull()
  })

  it('opens the color popup, picks a preset, and updates the swatch/label/bridge', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))

    const trigger = document.querySelector<HTMLElement>(
      '.color-edit-btn[data-cfg="accent"]',
    )!
    await user.click(trigger)

    const popup = document.getElementById('color-popup')!
    expect(popup).toHaveClass('open')
    expect(document.getElementById('color-popup-title')!.textContent).toBe(
      'Accent',
    )

    await user.click(screen.getByTitle('#ff5722'))

    expect(document.getElementById('cfg-accent-label')!.textContent).toBe(
      '#ff5722',
    )
    expect(
      (document.getElementById('cfg-accent-swatch') as HTMLElement).style
        .background,
    ).toBe('rgb(255, 87, 34)')
    expect(window.__editorConfigState.getConfig()).toEqual({
      accent: '#ff5722',
    })
  })

  it('typing a valid hex into the hex input commits it; an incomplete value does not', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))

    await user.click(document.querySelector('.color-edit-btn[data-cfg="bg"]')!)
    const hexInput = document.getElementById(
      'color-hex-input',
    ) as HTMLInputElement

    await user.type(hexInput, '#ab')
    expect(window.__editorConfigState.getConfig()).toEqual({})

    await user.type(hexInput, 'cdef')
    expect(hexInput.value).toBe('#abcdef')
    expect(window.__editorConfigState.getConfig()).toEqual({ bg: '#abcdef' })
  })

  it('the clear button removes an override', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))

    await user.click(document.querySelector('.color-edit-btn[data-cfg="fg"]')!)
    await user.click(screen.getByTitle('#000000'))
    expect(window.__editorConfigState.getConfig()).toEqual({ fg: '#000000' })

    await user.click(document.getElementById('color-clear-btn')!)
    expect(window.__editorConfigState.getConfig()).toEqual({})
    expect(document.getElementById('cfg-fg-label')!.textContent).toBe('—')
  })

  it('closes the color popup on the × button and on an outside click', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))
    const popup = document.getElementById('color-popup')!

    await user.click(
      document.querySelector('.color-edit-btn[data-cfg="line"]')!,
    )
    expect(popup).toHaveClass('open')
    await user.click(document.getElementById('color-popup-close')!)
    expect(popup).not.toHaveClass('open')

    await user.click(
      document.querySelector('.color-edit-btn[data-cfg="line"]')!,
    )
    expect(popup).toHaveClass('open')
    fireEvent.click(document.body)
    expect(popup).not.toHaveClass('open')
  })

  it('shows the active theme’s color as a placeholder for an unset field, and updates live on zm-editor-theme-changed', () => {
    ;(window as unknown as { __mermaid: unknown }).__mermaid = {
      THEMES: { nord: { bg: '#2E3440', fg: '#D8DEE9' } },
    }
    render(createElement(EditorApp, PROPS))

    expect(document.getElementById('cfg-bg-label')!.textContent).toBe('—')

    fireEvent(
      window,
      new CustomEvent(EDITOR_EFFECTIVE_THEME_EVENT, { detail: 'nord' }),
    )

    expect(document.getElementById('cfg-bg-label')!.textContent).toBe('#2E3440')
    // Still not an override -- window.__editorConfigState.getConfig() must
    // stay empty (config only reflects explicit overrides, matching
    // editor/js/config-panel.ts's old readConfig()).
    expect(window.__editorConfigState.getConfig()).toEqual({})
  })

  it('opens the font popup, filters by search, selects a font, and closes', async () => {
    const user = userEvent.setup()
    render(createElement(EditorApp, PROPS))

    expect(document.getElementById('font-select-label')!.textContent).toBe(
      'Default',
    )
    await user.click(document.getElementById('font-select-btn')!)
    const popup = document.getElementById('font-popup')!
    expect(popup).toHaveClass('open')
    expect(screen.getByText('Fira Code')).toBeInTheDocument()

    await user.type(document.getElementById('font-search')!, 'fira')
    expect(screen.getByText('Fira Code')).toBeInTheDocument()
    expect(screen.queryByText('Inter')).not.toBeInTheDocument()

    await user.click(screen.getByText('Fira Code'))

    expect(popup).not.toHaveClass('open')
    expect(document.getElementById('font-select-label')!.textContent).toBe(
      'Fira Code',
    )
    expect(window.__editorConfigState.getConfig()).toEqual({
      font: 'Fira Code',
    })
  })

  it('adjusts padding via the number input and reflects it in the config bridge', () => {
    render(createElement(EditorApp, PROPS))
    const paddingNum = document.getElementById(
      'cfg-padding',
    ) as HTMLInputElement

    fireEvent.change(paddingNum, { target: { value: '80' } })
    expect(window.__editorConfigState.getConfig()).toEqual({ padding: 80 })

    const paddingSlider = document.getElementById(
      'cfg-padding-slider',
    ) as HTMLInputElement
    expect(paddingSlider.value).toBe('80')
  })

  it('adjusts edge/node stroke and applies them via applyStrokeOverrides, not config', () => {
    render(createElement(EditorApp, PROPS))
    const edgeStroke = document.getElementById(
      'cfg-edge-stroke',
    ) as HTMLInputElement
    fireEvent.change(edgeStroke, { target: { value: '3' } })

    expect(window.__editorConfigState.getConfig()).toEqual({})

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML = '<line x1="0" y1="0" x2="1" y2="1"></line>'
    window.__editorConfigState.applyStrokeOverrides(
      svg as unknown as SVGSVGElement,
    )
    expect(svg.querySelector('line')!.getAttribute('stroke-width')).toBe('3')
  })
})
