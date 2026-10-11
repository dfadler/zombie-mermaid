// @vitest-environment jsdom
/**
 * Proves `IndexMainApp`'s proof-section stat numbers spin into place --
 * slot-machine-style digit reels landing on the real value -- once the
 * section scrolls into view, and that the real value is always available
 * as plain, accessible text (never the decorative reel's decoy rows or a
 * mid-spin digit) for a screen reader, copy-paste, or a plain-text
 * assertion like this file's own.
 *
 * jsdom has no real `IntersectionObserver` (confirmed empirically -- see
 * `demo/components/index-app.tsx`'s `useInView` doc comment), so this file
 * installs a minimal stub that captures the callback its one call-site
 * (the proof-grid's own observer) registers, letting each test fire it by
 * hand to simulate "the section is now on screen." Real browser timing
 * (`requestAnimationFrame`) is driven via `vi.useFakeTimers()` +
 * `vi.advanceTimersToNextFrame()`, the same tool `nav-hydration.test.ts`
 * uses (via `advanceTimersByTime`) to control `NavInstall`'s copy-feedback
 * timeout.
 */
import { act, createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, afterEach, vi } from 'vitest'
import { IndexMainApp } from '../../demo/components/index-app.tsx'

type IOCallback = (
  entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[],
) => void

let capturedCallback: IOCallback | undefined

class StubIntersectionObserver {
  constructor(callback: IOCallback) {
    capturedCallback = callback
  }
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}

function stubMatchMedia(reducedMotion: boolean): void {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reducedMotion,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
}

afterEach(() => {
  capturedCallback = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

/**
 * The fork card's "merged PRs" stat (real value 334 per `PROOF_SNAPSHOT`)
 * -- one representative `SlotNumber`, not all six on the page. Returns the
 * always-correct accessible text node and the first digit reel's own
 * transform-carrying inner `<span>` (see `SlotDigit`'s doc comment for the
 * markup shape this walks).
 */
function mergedPRsCells(): {
  accessibleText: Element
  reelInner: HTMLElement
} {
  const statRow = document.body.querySelector('.proof-grid .stat-row')
  if (!statRow) throw new Error('test setup: stat row missing')
  const mergedPRsValue = statRow.children[1]?.querySelector('p.display')
  if (!mergedPRsValue) throw new Error('test setup: stat value missing')

  const accessibleText = mergedPRsValue.querySelector(
    ':scope > span > span:last-child',
  )
  const reelInner = mergedPRsValue.querySelector<HTMLElement>(
    ':scope > span > span > span[aria-hidden] > span',
  )
  if (!accessibleText || !reelInner) {
    throw new Error('test setup: slot-reel markup missing')
  }
  return { accessibleText, reelInner }
}

describe('ProofSection stat slot-reel animation', () => {
  it('spins from its reel’s top row down to the real value once the section scrolls into view', () => {
    vi.stubGlobal('IntersectionObserver', StubIntersectionObserver)
    stubMatchMedia(false)
    render(createElement(IndexMainApp))

    const { accessibleText, reelInner } = mergedPRsCells()
    expect(accessibleText.textContent).toBe('334')
    const restTransform = reelInner.style.transform
    expect(reelInner.style.transition).toBe('none')

    if (!capturedCallback) {
      throw new Error('test setup: IntersectionObserver never constructed')
    }

    vi.useFakeTimers()
    act(() => {
      capturedCallback?.([{ isIntersecting: true }])
    })
    // Snapped straight to the reel's top row (digit 0), no transition yet.
    expect(reelInner.style.transform).toBe('translateY(0em)')
    expect(reelInner.style.transition).toBe('none')
    // The real, accessible value never moves -- it was always correct.
    expect(accessibleText.textContent).toBe('334')

    // Flush the two nested rAFs SlotDigit uses to force a paint of the
    // snapped state before applying the transition (see its doc comment).
    act(() => {
      vi.advanceTimersToNextFrame()
    })
    act(() => {
      vi.advanceTimersToNextFrame()
    })
    expect(reelInner.style.transform).toBe(restTransform)
    expect(reelInner.style.transition).toContain('transform')
    expect(reelInner.style.transition).not.toBe('none')
  })

  it('never animates under prefers-reduced-motion: reduce', () => {
    vi.stubGlobal('IntersectionObserver', StubIntersectionObserver)
    stubMatchMedia(true)
    render(createElement(IndexMainApp))

    const { accessibleText, reelInner } = mergedPRsCells()
    const restTransform = reelInner.style.transform
    expect(accessibleText.textContent).toBe('334')

    if (!capturedCallback) {
      throw new Error('test setup: IntersectionObserver never constructed')
    }

    vi.useFakeTimers()
    act(() => {
      capturedCallback?.([{ isIntersecting: true }])
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    // Stayed at rest the whole time -- never snapped to the spin start.
    expect(reelInner.style.transform).toBe(restTransform)
    expect(reelInner.style.transition).toBe('none')
  })

  it('never animates when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    stubMatchMedia(false)
    render(createElement(IndexMainApp))

    const { accessibleText, reelInner } = mergedPRsCells()
    expect(accessibleText.textContent).toBe('334')
    expect(reelInner.style.transition).toBe('none')
  })
})
