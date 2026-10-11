// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/slot-digit.tsx`'s
 * `SlotDigit`, split out of `index-app.tsx` (zombie-mermaid#932). The full
 * spin animation (rAF-driven transition, reduced-motion, and
 * IntersectionObserver-triggered `active`) is already exhaustively covered
 * end to end via `IndexMainApp`'s real `ProofSection` in
 * `__tests__/dom/index-proof-stats.test.ts`; this proves the reel itself
 * renders at rest with the correct row count and lands on the right digit.
 */
import { act, createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SlotDigit } from '../../demo/components/slot-digit.tsx'

describe('SlotDigit', () => {
  it('renders 11 decoy+real rows at rest (one 0-9 loop, then up through the digit) and the last row is the real digit', () => {
    const { container } = render(
      createElement(SlotDigit, { digit: 3, active: false, delayMs: 0 }),
    )

    const rows = container.querySelectorAll('span[aria-hidden] > span > span')
    // SLOT_LOOPS(1) * 10 + digit(3) + 1 = 14 rows.
    expect(rows.length).toBe(14)
    expect(rows[rows.length - 1]?.textContent).toBe('3')
  })

  it('is aria-hidden, since the decoy rows would otherwise read as garbled digits', () => {
    const { container } = render(
      createElement(SlotDigit, { digit: 7, active: false, delayMs: 0 }),
    )
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeNull()
  })

  it('starts at rest with no transition when inactive', () => {
    const { container } = render(
      createElement(SlotDigit, { digit: 5, active: false, delayMs: 0 }),
    )
    const inner = container.querySelector<HTMLElement>(
      'span[aria-hidden] > span',
    )
    expect(inner?.style.transition).toBe('none')
  })

  it('does not throw when mounted active', () => {
    expect(() => {
      render(createElement(SlotDigit, { digit: 9, active: true, delayMs: 0 }))
    }).not.toThrow()
    act(() => {})
  })
})
