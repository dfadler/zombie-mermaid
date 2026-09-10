// @vitest-environment jsdom
/**
 * Dedicated render test for `ColorField`, split out of `editor-config.tsx`
 * into its own file by zombie-mermaid#935's audit (see that file's header
 * comment). `editor-config.test.ts` already exercises it indirectly through
 * a mounted `<EditorApp>`/`ConfigPanel`; this file pins the component's own
 * contract -- override vs. theme-default vs. unset -- in isolation, with no
 * `ConfigPanel` state machinery involved.
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ColorField } from '../../demo/components/editor-color-field.tsx'

describe('ColorField', () => {
  it('shows the override value and label when one is set', () => {
    render(
      createElement(ColorField, {
        colorKey: 'bg',
        override: '#112233',
        themeColor: '#000000',
        onOpen: vi.fn(),
      }),
    )
    expect(screen.getByText('Background')).toBeInTheDocument()
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('title', 'Override: #112233')
    expect(screen.getByText('#112233')).toBeInTheDocument()
  })

  it('falls back to the theme color when no override is set', () => {
    render(
      createElement(ColorField, {
        colorKey: 'accent',
        override: '',
        themeColor: '#ff0000',
        onOpen: vi.fn(),
      }),
    )
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'Theme default: #ff0000',
    )
    expect(screen.getByText('#ff0000')).toBeInTheDocument()
  })

  it('shows "Not set" and a dash when neither an override nor a theme color exists', () => {
    render(
      createElement(ColorField, {
        colorKey: 'line',
        override: '',
        themeColor: null,
        onOpen: vi.fn(),
      }),
    )
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Not set')
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('calls onOpen with the color key and the clicked button element', async () => {
    const onOpen = vi.fn()
    render(
      createElement(ColorField, {
        colorKey: 'surface',
        override: '#abcdef',
        themeColor: null,
        onOpen,
      }),
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    const [key, el] = onOpen.mock.calls[0] as [string, HTMLElement]
    expect(key).toBe('surface')
    expect(el.tagName).toBe('BUTTON')
  })
})
