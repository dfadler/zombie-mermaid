// @vitest-environment jsdom
/**
 * Proves `IndexMainApp`'s proof-section stat numbers (fork-vs-upstream
 * "days since last commit" / "merged PRs" / "open PRs") count up from 0
 * once the section scrolls into view, rather than just asserting the
 * static end-state markup `__tests__/site-equivalence.test.ts` already
 * pins.
 *
 * jsdom has no real `IntersectionObserver` (confirmed empirically — see
 * `demo/components/index-app.tsx`'s `useInView` doc comment), so this file
 * installs a minimal stub that captures the callback its one call-site
 * (the proof-grid's own observer) registers, letting each test fire it by
 * hand to simulate "the section is now on screen." Real browser timing
 * (`requestAnimationFrame`/`performance.now`) is driven via
 * `vi.useFakeTimers()`, the same tool `nav-hydration.test.ts` uses to
 * control `NavInstall`'s copy-feedback timeout.
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

describe('ProofSection stat count-up', () => {
  it('counts a stat from 0 up to its real value once the section scrolls into view', async () => {
    vi.stubGlobal('IntersectionObserver', StubIntersectionObserver)
    stubMatchMedia(false)
    render(createElement(IndexMainApp))

    const mergedPRsLabel = document.body.querySelector('.proof-grid .stat-row')
    if (!mergedPRsLabel) throw new Error('test setup: stat row missing')
    // The fork card's "merged PRs" number -- the second stat in its row,
    // real value 334 per PROOF_SNAPSHOT.
    const mergedPRsValue =
      mergedPRsLabel.children[1]?.querySelector('p.display')
    if (!mergedPRsValue) throw new Error('test setup: stat value missing')
    expect(mergedPRsValue.textContent).toBe('334')

    if (!capturedCallback) {
      throw new Error('test setup: IntersectionObserver never constructed')
    }

    vi.useFakeTimers()
    act(() => {
      capturedCallback?.([{ isIntersecting: true }])
    })
    // Reset to 0 the instant the count-up starts.
    expect(mergedPRsValue.textContent).toBe('0')

    act(() => {
      vi.advanceTimersByTime(1200)
    })
    expect(mergedPRsValue.textContent).toBe('334')
  })

  it('never animates under prefers-reduced-motion: reduce', () => {
    vi.stubGlobal('IntersectionObserver', StubIntersectionObserver)
    stubMatchMedia(true)
    render(createElement(IndexMainApp))

    const statRow = document.body.querySelector('.proof-grid .stat-row')
    if (!statRow) throw new Error('test setup: stat row missing')
    const mergedPRsValue = statRow.children[1]?.querySelector('p.display')
    if (!mergedPRsValue) throw new Error('test setup: stat value missing')
    expect(mergedPRsValue.textContent).toBe('334')

    if (!capturedCallback) {
      throw new Error('test setup: IntersectionObserver never constructed')
    }

    vi.useFakeTimers()
    act(() => {
      capturedCallback?.([{ isIntersecting: true }])
    })
    act(() => {
      vi.advanceTimersByTime(1200)
    })
    // Stayed at the real value the whole time -- never dropped to 0.
    expect(mergedPRsValue.textContent).toBe('334')
  })

  it('never animates when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    stubMatchMedia(false)
    render(createElement(IndexMainApp))

    const statRow = document.body.querySelector('.proof-grid .stat-row')
    if (!statRow) throw new Error('test setup: stat row missing')
    const mergedPRsValue = statRow.children[1]?.querySelector('p.display')
    if (!mergedPRsValue) throw new Error('test setup: stat value missing')
    expect(mergedPRsValue.textContent).toBe('334')
  })
})
