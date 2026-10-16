/**
 * Contrast guard for the default ASCII theme's text colour (#2165).
 *
 * The default used to be zinc-800 (#27272a): 1.05-1.41:1 on common dark
 * terminals, i.e. unreadable. No single colour clears 4.5:1 on both a dark
 * and a light terminal, so the default leaves text with no explicit colour
 * (the terminal's own foreground). If someone gives it a colour again, it
 * must read on every common background below.
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ASCII_THEME,
  renderMermaidASCII,
} from '@zombie-mermaid/ascii-renderer'

const DARK = ['#1e1e1e', '#000000', '#282a36']
const LIGHT = ['#ffffff', '#fdf6e3']
const MIN_TEXT_RATIO = 4.5

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

describe('default ASCII theme text colour (#2165)', () => {
  it.each([...DARK, ...LIGHT])(
    'reads at >= 4.5:1 on %s (or has no explicit colour)',
    (bg) => {
      const { fg } = DEFAULT_ASCII_THEME
      if (fg === 'inherit') return
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(MIN_TEXT_RATIO)
    },
  )

  it('emits no foreground escape for labels in any ANSI mode', () => {
    for (const colorMode of ['ansi16', 'ansi256', 'truecolor'] as const) {
      const out = renderMermaidASCII('graph LR\n  A[Request] --> B[Handler]', {
        colorMode,
      })
      expect(out).toContain('Request')
      expect(out).not.toMatch(/\x1b\[[\d;]*mRequest/)
      expect(out).not.toMatch(/\x1b\[[\d;]*mHandler/)
    }
  })
})
