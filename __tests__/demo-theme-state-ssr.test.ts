/**
 * Guards demo/theme-state.ts's SSR-safety contract under Vitest's default
 * `node` environment (no `window`/`localStorage` global at all) -- the same
 * environment the site's page generators (index.ts, pages.ts, editor.ts,
 * etc.) actually run under via `tsx`. See demo-theme-state.test.ts for the
 * browser-side behavior (jsdom environment, `window` present).
 */
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_THEME_KEY,
  THEME_STORAGE_KEY,
  getTheme,
  setTheme,
  subscribe,
} from '../demo/theme-state.ts'

describe('demo/theme-state.ts (SSR / no window)', () => {
  it('exposes the storage key and Default sentinel as plain constants', () => {
    expect(THEME_STORAGE_KEY).toBe('mermaid-theme')
    expect(DEFAULT_THEME_KEY).toBe('')
  })

  it('getTheme() returns the Default sentinel rather than throwing', () => {
    expect(typeof window).toBe('undefined')
    expect(getTheme()).toBe(DEFAULT_THEME_KEY)
  })

  it('setTheme() does not throw when there is nowhere to persist to', () => {
    expect(() => setTheme('dracula')).not.toThrow()
  })

  it('subscribe() still delivers same-process notifications with no window', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    setTheme('nord')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('nord')
    unsubscribe()

    setTheme('dracula')
    expect(listener).toHaveBeenCalledTimes(1) // no further calls after unsubscribe
  })
})
