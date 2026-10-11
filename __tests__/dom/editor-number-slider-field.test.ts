// @vitest-environment jsdom
/**
 * Dedicated render test for `NumberSliderField`, split out of
 * `editor-config.tsx` into its own file by zombie-mermaid#935's audit (see
 * that file's header comment). `editor-config.test.ts` already exercises it
 * indirectly (padding/edge-stroke/node-stroke sliders) through a mounted
 * `<EditorApp>`/`ConfigPanel`; this file pins the fully-generic component's
 * own contract in isolation -- it knows nothing about padding or stroke
 * specifically.
 */
import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NumberSliderField } from '../../demo/components/editor-number-slider-field.tsx'

describe('NumberSliderField', () => {
  it('renders a labelled number input and a linked range slider with the same value', () => {
    render(
      createElement(NumberSliderField, {
        label: 'Padding',
        id: 'cfg-padding',
        min: 0,
        max: 120,
        value: 24,
        onChange: vi.fn(),
      }),
    )
    expect(screen.getByText('Padding')).toBeInTheDocument()
    const number = screen.getByRole('spinbutton') as HTMLInputElement
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(number.id).toBe('cfg-padding')
    expect(slider.id).toBe('cfg-padding-slider')
    expect(number.value).toBe('24')
    expect(slider.value).toBe('24')
  })

  it('passes min/max/step through to both inputs', () => {
    render(
      createElement(NumberSliderField, {
        label: 'Edge stroke',
        id: 'cfg-edge-stroke',
        min: 0.25,
        max: 6,
        step: 0.25,
        value: 1,
        onChange: vi.fn(),
      }),
    )
    for (const input of [
      screen.getByRole('spinbutton'),
      screen.getByRole('slider'),
    ]) {
      expect(input).toHaveAttribute('min', '0.25')
      expect(input).toHaveAttribute('max', '6')
      expect(input).toHaveAttribute('step', '0.25')
    }
  })

  it('calls onChange with the parsed number from the number input', () => {
    const onChange = vi.fn()
    render(
      createElement(NumberSliderField, {
        label: 'Padding',
        id: 'cfg-padding',
        min: 0,
        max: 120,
        value: 24,
        onChange,
      }),
    )
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '40' },
    })
    expect(onChange).toHaveBeenCalledWith(40)
  })

  it('calls onChange with the parsed number from the slider', () => {
    const onChange = vi.fn()
    render(
      createElement(NumberSliderField, {
        label: 'Padding',
        id: 'cfg-padding',
        min: 0,
        max: 120,
        value: 24,
        onChange,
      }),
    )
    fireEvent.change(screen.getByRole('slider'), { target: { value: '80' } })
    expect(onChange).toHaveBeenCalledWith(80)
  })

  it('falls back to 0 for a non-numeric input value', () => {
    const onChange = vi.fn()
    render(
      createElement(NumberSliderField, {
        label: 'Padding',
        id: 'cfg-padding',
        min: 0,
        max: 120,
        value: 24,
        onChange,
      }),
    )
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '' },
    })
    expect(onChange).toHaveBeenCalledWith(0)
  })
})
