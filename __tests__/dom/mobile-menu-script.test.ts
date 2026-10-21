// @vitest-environment jsdom
/**
 * Drift guard for demo/components/mobile-menu-script.ts: the hand-synced
 * compact literal pages ship must behave exactly like `initMobileMenu`.
 * Both run against the same <Nav> markup through open, link-click, Escape
 * and desktop-resize paths; the observable state traces must match.
 */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Nav } from '../../demo/components/nav.tsx'
import {
  initMobileMenu,
  NAV_MOBILE_MENU_SCRIPT,
} from '../../demo/components/mobile-menu.client.ts'

function trace(install: () => void): string[] {
  document.body.innerHTML = renderToString(createElement(Nav))
  document.documentElement.className = ''
  let onChange: (() => void) | undefined
  const mql = {
    matches: false,
    addEventListener: (_: string, fn: () => void) => (onChange = fn),
    removeEventListener: vi.fn(),
  }
  window.matchMedia = vi.fn().mockReturnValue(mql) as never
  install()

  const toggle = document.querySelector<HTMLElement>('.menu-toggle')!
  const panel = document.querySelector<HTMLElement>('.mobile-nav-panel')!
  const snap = (label: string) =>
    [
      label,
      panel.className,
      toggle.className,
      toggle.getAttribute('aria-expanded'),
      document.documentElement.className,
      document.activeElement === toggle
        ? 'toggle'
        : document.activeElement?.className,
    ].join('|')

  const out: string[] = []
  fireEvent.click(toggle)
  out.push(snap('open'))
  fireEvent.keyDown(panel, { key: 'Escape' })
  out.push(snap('escape'))
  fireEvent.click(toggle)
  fireEvent.click(panel.querySelector('.mobile-link')!)
  out.push(snap('link'))
  fireEvent.click(toggle)
  mql.matches = true
  onChange?.()
  out.push(snap('desktop'))
  return out
}

describe('mobile menu script literal', () => {
  afterEach(() => vi.restoreAllMocks())

  it('behaves like initMobileMenu', () => {
    const fromFunction = trace(() => initMobileMenu(901))
    const fromLiteral = trace(() => (0, eval)(NAV_MOBILE_MENU_SCRIPT))
    expect(fromLiteral).toEqual(fromFunction)
    expect(fromLiteral[0]).toContain('is-open')
  })
})
