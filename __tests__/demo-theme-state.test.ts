// @vitest-environment jsdom
/**
 * Guards demo/theme-state.ts's browser behavior: reading/writing through
 * `localStorage`, the Default-is-an-absence-not-a-value convention every
 * prior implementation (demo/diagram-page-client.ts, and before #716
 * deleted it, the pre-#590 demo/client.ts gallery) used, same-tab
 * subscriber notification, and cross-tab sync via the `storage` event.
 *
 * See demo-theme-state-ssr.test.ts for the SSR-safety contract (default
 * Vitest `node` environment, no `window` at all).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_THEME_KEY,
  THEME_STORAGE_KEY,
  getTheme,
  setTheme,
  subscribe,
} from '../demo/theme-state.ts'

beforeEach(() => {
  window.localStorage.clear()
})

describe('getTheme()', () => {
  it('returns the Default sentinel when nothing is stored', () => {
    expect(getTheme()).toBe(DEFAULT_THEME_KEY)
  })

  it('returns whatever is already stored under the shared key', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dracula')
    expect(getTheme()).toBe('dracula')
  })
})

describe('setTheme()', () => {
  it('persists a real theme key under the shared storage key', () => {
    setTheme('nord')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('nord')
  })

  it('clears the stored key for the Default sentinel, rather than writing an empty string', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'nord')

    setTheme(DEFAULT_THEME_KEY)

    // Matches every prior implementation's set/remove split: "Default" is
    // the *absence* of a stored preference, not a literal empty-string
    // value -- important because a stray '' value would compare equal to
    // "not set" everywhere else but would still show up under the key.
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })
})

describe('subscribe()', () => {
  let unsubscribe: (() => void) | undefined

  afterEach(() => {
    unsubscribe?.()
    unsubscribe = undefined
  })

  it('notifies subscribers synchronously on setTheme(), in this tab', () => {
    const listener = vi.fn()
    unsubscribe = subscribe(listener)

    setTheme('tokyo-night')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('tokyo-night')
  })

  it('stops delivering notifications once unsubscribed', () => {
    const listener = vi.fn()
    const stop = subscribe(listener)

    stop()
    setTheme('one-dark')

    expect(listener).not.toHaveBeenCalled()
  })

  it('supports multiple independent subscribers', () => {
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = subscribe(first)
    const stopSecond = subscribe(second)

    setTheme('catppuccin-mocha')

    expect(first).toHaveBeenCalledWith('catppuccin-mocha')
    expect(second).toHaveBeenCalledWith('catppuccin-mocha')

    stopFirst()
    stopSecond()
  })

  it('notifies on a cross-tab storage event for the shared key', () => {
    const listener = vi.fn()
    unsubscribe = subscribe(listener)

    // Simulates another tab/page changing the preference: the real
    // `storage` event never fires in the tab that made the change, only in
    // every *other* one sharing the origin -- dispatching it manually here
    // is the standard jsdom way to exercise that cross-tab listener.
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: THEME_STORAGE_KEY,
        newValue: 'github-dark',
      }),
    )

    expect(listener).toHaveBeenCalledWith('github-dark')
  })

  it('ignores a storage event for an unrelated key', () => {
    const listener = vi.fn()
    unsubscribe = subscribe(listener)

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'some-other-key', newValue: 'x' }),
    )

    expect(listener).not.toHaveBeenCalled()
  })

  it('treats a cross-tab clear (newValue null) as the Default sentinel', () => {
    const listener = vi.fn()
    unsubscribe = subscribe(listener)

    window.dispatchEvent(
      new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: null }),
    )

    expect(listener).toHaveBeenCalledWith(DEFAULT_THEME_KEY)
  })
})
