// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/slot-number.tsx`'s
 * `SlotNumber`, split out of `index-app.tsx` (zombie-mermaid#932). The full
 * spin/reduced-motion behavior is covered end to end via `ProofSection` in
 * `__tests__/dom/index-proof-stats.test.ts`; this proves the always-correct
 * accessible text and the one-reel-per-digit structure.
 */
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SlotNumber } from '../../demo/components/slot-number.tsx'

describe('SlotNumber', () => {
  it('exposes the real value as plain, visually-hidden accessible text', () => {
    const { container } = render(
      createElement(SlotNumber, { value: 334, active: false }),
    )
    const hiddenText = container.querySelector(
      ':scope > span > span:last-child',
    )
    expect(hiddenText?.textContent).toBe('334')
  })

  it('renders one digit reel per digit of the value', () => {
    const { container } = render(
      createElement(SlotNumber, { value: 334, active: false }),
    )
    const reels = container.querySelectorAll(':scope > span > span > span')
    expect(reels.length).toBe(3)
  })

  it('renders a single reel for a single-digit value', () => {
    const { container } = render(
      createElement(SlotNumber, { value: 1, active: false }),
    )
    const reels = container.querySelectorAll(':scope > span > span > span')
    expect(reels.length).toBe(1)
    const hiddenText = container.querySelector(
      ':scope > span > span:last-child',
    )
    expect(hiddenText?.textContent).toBe('1')
  })
})
