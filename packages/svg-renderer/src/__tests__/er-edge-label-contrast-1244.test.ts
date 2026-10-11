/**
 * #1244: ER edge labels were drawn in `--_text-muted` (fg mixed at 40% into
 * bg), ~2.4:1 on the default white background. Read the mix the renderer
 * actually emits and assert it clears WCAG AA for text (4.5:1) against the
 * default theme.
 */
import { describe, it, expect } from 'vitest'
import { DEFAULTS, MIX } from '@zombie-mermaid/core'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

type Rgb = readonly [number, number, number]

function channels(hex: string): Rgb {
  const c = (i: number) => parseInt(hex.slice(i, i + 2), 16)
  return [c(1), c(3), c(5)]
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Contrast of `color-mix(in srgb, fg pct%, bg)` against bg. */
function mixContrast(pct: number): number {
  const [fr, fgc, fb] = channels(DEFAULTS.fg)
  const [br, bgc, bb] = channels(DEFAULTS.bg)
  const mix = (f: number, b: number) => (f * pct + b * (100 - pct)) / 100
  const mixed: Rgb = [mix(fr, br), mix(fgc, bgc), mix(fb, bb)]
  const l1 = luminance(mixed)
  const l2 = luminance([br, bgc, bb])
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

describe('ER edge label contrast (#1244)', () => {
  const svg = renderMermaidSVG('erDiagram\n  ORDER ||--|{ LINE_ITEM : contains')
  const label = svg.match(/<text[^>]*>contains<\/text>/)?.[0] ?? ''
  const percent = Number(
    label.match(
      /fill="color-mix\(in srgb, var\(--fg\) (\d+)%, var\(--bg\)\)"/,
    )?.[1],
  )

  it('mixes the relationship label color from --fg and --bg', () => {
    expect(Number.isFinite(percent)).toBe(true)
  })

  it('clears WCAG AA (4.5:1) with the default theme', () => {
    expect(mixContrast(percent)).toBeGreaterThanOrEqual(4.5)
  })

  it('is darker than the shared muted/secondary text tokens that failed AA', () => {
    expect(mixContrast(MIX.textMuted)).toBeLessThan(4.5)
    expect(mixContrast(MIX.textSec)).toBeLessThan(4.5)
  })
})
