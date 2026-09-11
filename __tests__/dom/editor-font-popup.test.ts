// @vitest-environment jsdom
/**
 * Dedicated render test for `FontPopup` and `computeFontPopupPosition`,
 * split out of `editor-config.tsx` into their own file by
 * zombie-mermaid#935's audit (see that file's header comment).
 * `editor-config.test.ts` already exercises the popup indirectly through a
 * mounted `<EditorApp>`/`ConfigPanel`; this file pins the component's own
 * rendering contract (search/filter, grouping, browser-loaded fonts) in
 * isolation, with no `ConfigPanel` state machinery involved.
 */
import { createElement, createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  FontPopup,
  computeFontPopupPosition,
} from '../../demo/components/editor-font-popup.tsx'

function baseProps() {
  return {
    open: true,
    search: '',
    currentFont: '',
    onSearchChange: vi.fn(),
    onSelect: vi.fn(),
    onClose: vi.fn(),
    position: null,
    searchInputRef: createRef<HTMLInputElement>(),
  }
}

describe('computeFontPopupPosition', () => {
  it('anchors the 220px-wide popup below-right of the anchor by default', () => {
    const rect = { left: 100, right: 300, top: 50, bottom: 80 } as DOMRect
    expect(computeFontPopupPosition(rect)).toEqual({ left: 80, top: 86 })
  })

  it('clamps the left edge to 8px rather than going off-screen', () => {
    const rect = { left: 0, right: 50, top: 50, bottom: 80 } as DOMRect
    expect(computeFontPopupPosition(rect).left).toBe(8)
  })
})

describe('FontPopup', () => {
  it('renders nothing in the font list while closed', () => {
    const { container } = render(
      createElement(FontPopup, { ...baseProps(), open: false }),
    )
    expect(container.querySelector('#font-popup')?.className).toBe('font-popup')
    expect(container.querySelectorAll('.font-item')).toHaveLength(0)
  })

  it('groups the preset font list by family group while open', () => {
    render(createElement(FontPopup, baseProps()))
    expect(screen.getByText('Sans-serif')).toBeInTheDocument()
    expect(screen.getByText('Serif')).toBeInTheDocument()
    expect(screen.getByText('Monospace')).toBeInTheDocument()
    expect(screen.getByText('Inter')).toBeInTheDocument()
  })

  it('filters the preset list by the search string', () => {
    render(createElement(FontPopup, { ...baseProps(), search: 'geist' }))
    expect(screen.getByText('Geist')).toBeInTheDocument()
    expect(screen.queryByText('Inter')).toBeNull()
  })

  it('marks the currently-selected font as active', () => {
    const { container } = render(
      createElement(FontPopup, { ...baseProps(), currentFont: 'Roboto' }),
    )
    const active = container.querySelector('.font-item.active')
    expect(active?.textContent).toContain('Roboto')
  })

  it('reports a font pick via onSelect with that font’s value', async () => {
    const onSelect = vi.fn()
    render(createElement(FontPopup, { ...baseProps(), onSelect }))
    await userEvent.click(screen.getByText('Inter'))
    expect(onSelect).toHaveBeenCalledWith('Inter')
  })

  it('reports search edits verbatim via onSearchChange', async () => {
    const onSearchChange = vi.fn()
    render(createElement(FontPopup, { ...baseProps(), onSearchChange }))
    await userEvent.type(screen.getByPlaceholderText('Quick search'), 'm')
    expect(onSearchChange).toHaveBeenCalledWith('m')
  })
})
