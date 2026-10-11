// @vitest-environment jsdom
/**
 * Dedicated render test for `ColorPopup` and `computeColorPopupPosition`,
 * split out of `editor-config.tsx` into their own file by
 * zombie-mermaid#935's audit (see that file's header comment).
 * `editor-config.test.ts` already exercises the popup indirectly through a
 * mounted `<EditorApp>`/`ConfigPanel`; this file pins the component's own
 * rendering contract (open/closed, hex input, presets, native picker) in
 * isolation, with no `ConfigPanel` state machinery involved.
 */
import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  ColorPopup,
  computeColorPopupPosition,
} from '../../demo/components/editor-color-popup.tsx'
import { COLOR_PRESETS } from '../../demo/components/editor-config-helpers.ts'

function baseProps() {
  return {
    activeKey: null as null | 'bg',
    position: null,
    value: '',
    hexInput: '',
    onHexInputChange: vi.fn(),
    onNativeChange: vi.fn(),
    onPickPreset: vi.fn(),
    onClear: vi.fn(),
    onClose: vi.fn(),
  }
}

describe('computeColorPopupPosition', () => {
  it('anchors the 240px-wide popup below-right of the anchor by default', () => {
    const rect = { left: 100, right: 300, top: 50, bottom: 80 } as DOMRect
    const pos = computeColorPopupPosition(rect)
    expect(pos).toEqual({ left: 60, top: 86 })
  })

  it('clamps the left edge to 8px rather than going off-screen', () => {
    const rect = { left: 0, right: 100, top: 50, bottom: 80 } as DOMRect
    const pos = computeColorPopupPosition(rect)
    expect(pos.left).toBe(8)
  })

  it('flips above the anchor when it would overflow the viewport bottom', () => {
    const originalHeight = window.innerHeight
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 400,
    })
    try {
      const rect = { left: 100, right: 300, top: 300, bottom: 350 } as DOMRect
      const pos = computeColorPopupPosition(rect)
      expect(pos.top).toBe(300 - 406)
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalHeight,
      })
    }
  })
})

describe('ColorPopup', () => {
  it('adds the "open" class only while a key is active', () => {
    const { container, rerender } = render(
      createElement(ColorPopup, baseProps()),
    )
    expect(container.querySelector('#color-popup')?.className).toBe(
      'color-popup',
    )
    rerender(createElement(ColorPopup, { ...baseProps(), activeKey: 'bg' }))
    expect(container.querySelector('#color-popup')?.className).toBe(
      'color-popup open',
    )
  })

  it('shows the active key’s human label in the header', () => {
    render(createElement(ColorPopup, { ...baseProps(), activeKey: 'bg' }))
    expect(screen.getByText('Background')).toBeInTheDocument()
  })

  it('renders one preset swatch button per COLOR_PRESETS entry', () => {
    const { container } = render(createElement(ColorPopup, baseProps()))
    expect(container.querySelectorAll('.color-swatch-btn')).toHaveLength(
      COLOR_PRESETS.length,
    )
  })

  it('reports a preset pick via onPickPreset with that preset’s hex', async () => {
    const onPickPreset = vi.fn()
    render(
      createElement(ColorPopup, {
        ...baseProps(),
        activeKey: 'bg',
        onPickPreset,
      }),
    )
    const firstPreset = COLOR_PRESETS[0]
    await userEvent.click(screen.getByTitle(firstPreset))
    expect(onPickPreset).toHaveBeenCalledWith(firstPreset)
  })

  it('reports hex input edits verbatim via onHexInputChange', () => {
    const onHexInputChange = vi.fn()
    render(
      createElement(ColorPopup, {
        ...baseProps(),
        activeKey: 'bg',
        onHexInputChange,
      }),
    )
    fireEvent.change(screen.getByPlaceholderText('#rrggbb'), {
      target: { value: '#a1b2c3' },
    })
    expect(onHexInputChange).toHaveBeenCalledWith('#a1b2c3')
  })

  it('closes via both the close button and onClear via the Clear button', async () => {
    const onClose = vi.fn()
    const onClear = vi.fn()
    render(
      createElement(ColorPopup, {
        ...baseProps(),
        activeKey: 'bg',
        onClose,
        onClear,
      }),
    )
    await userEvent.click(screen.getByText('×'))
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByText('Clear'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
