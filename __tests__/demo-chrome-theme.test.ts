/**
 * Guards `demo/components/chrome-theme.ts`'s pure color derivation — #772's
 * fix for site chrome (Nav/Footer/cards) not re-theming, only diagrams.
 */
import { describe, expect, it } from 'vitest'

import {
  chromeThemeVars,
  CHROME_REACTIVE_TOKENS,
} from '../demo/components/chrome-theme.ts'

describe('chromeThemeVars', () => {
  it('passes bg/fg through verbatim for --bg/--text', () => {
    const vars = chromeThemeVars({ bg: '#2e3440', fg: '#d8dee9' })
    expect(vars['--bg']).toBe('#2e3440')
    expect(vars['--text']).toBe('#d8dee9')
  })

  it('derives every other token as a color-mix() of fg into bg', () => {
    const vars = chromeThemeVars({ bg: '#2e3440', fg: '#d8dee9' })
    for (const token of [
      '--bg-soft',
      '--panel',
      '--panel-2',
      '--border',
      '--text-dim',
      '--text-faint',
    ] as const) {
      expect(vars[token]).toEqual(
        expect.stringContaining('color-mix(in srgb, #d8dee9'),
      )
      expect(vars[token]).toEqual(expect.stringContaining('#2e3440)'))
    }
  })

  it('returns exactly the CHROME_REACTIVE_TOKENS keys, no more and no less', () => {
    const vars = chromeThemeVars({ bg: '#000000', fg: '#ffffff' })
    expect(Object.keys(vars).sort()).toEqual([...CHROME_REACTIVE_TOKENS].sort())
  })

  it('produces distinct mix percentages for each derived token', () => {
    // Guards against a copy-paste bug collapsing two tiers into the same
    // percentage (e.g. --panel and --panel-2 accidentally identical).
    const vars = chromeThemeVars({ bg: '#000000', fg: '#ffffff' })
    const derived = [
      vars['--bg-soft'],
      vars['--panel'],
      vars['--panel-2'],
      vars['--border'],
      vars['--text-dim'],
      vars['--text-faint'],
    ]
    expect(new Set(derived).size).toBe(derived.length)
  })
})
