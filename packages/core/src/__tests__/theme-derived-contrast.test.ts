/**
 * Contrast ratchet for the derived `--_*` SVG tokens (#1864).
 *
 * theme-palette-contrast.test.ts checks the raw palette values. The SVG
 * actually paints `--_text-sec`, `--_line`, `--_node-stroke`, ... which are
 * `var(--muted, color-mix(in srgb, var(--fg) N%, var(--bg)))` (theme.ts
 * `buildStyleBlock` + `MIX`). This resolves each token per theme, with the
 * same fallback rule, and records its contrast ratio vs `--bg` (and node
 * stroke vs node fill) in theme-derived-contrast.floors.json.
 *
 * Ratchet: a ratio may not drop below its recorded floor, and if it rises
 * the floor must be raised too, so improvements get locked in. Some floors
 * sit under WCAG on purpose (e.g. the 20% node stroke is ~1.5:1; text-labelled
 * node strokes may fall under the "information available in another form"
 * exemption) -- the floor records today's value, not an endorsement.
 *
 * Update after an intentional change (only raises; new themes/tokens are
 * added; lowering a floor means editing the JSON by hand in review):
 *   UPDATE_CONTRAST_FLOORS=1 pnpm exec vitest run -c config/vitest.config.ts theme-derived-contrast
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { THEMES, MIX } from '@zombie-mermaid/core'

type RGB = [number, number, number]

const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
}

const lin = (c: number) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

const lum = ([r, g, b]: RGB) =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** `color-mix(in srgb, fg pct%, bg)`: per-channel linear blend in sRGB. */
const mix = (fg: RGB, bg: RGB, pct: number): RGB =>
  fg.map((c, i) => c * (pct / 100) + bg[i]! * (1 - pct / 100)) as RGB

const FLOORS_PATH = fileURLToPath(
  new URL('./theme-derived-contrast.floors.json', import.meta.url),
)
type Floors = Record<string, Record<string, number>>

/** Every measured ratio for a theme, keyed `token vs surface`. */
function measure(c: (typeof THEMES)[string]): Record<string, number> {
  const bg = hexToRgb(c.bg)
  const fg = hexToRgb(c.fg)
  const tok = (override: string | undefined, pct: number) =>
    override ? hexToRgb(override) : mix(fg, bg, pct)
  const nodeFill = tok(c.surface, MIX.nodeFill)
  const nodeStroke = tok(c.border, MIX.nodeStroke)
  const out: Record<string, number> = {
    'text-sec vs bg': ratio(tok(c.muted, MIX.textSec), bg),
    'text-muted vs bg': ratio(tok(c.muted, MIX.textMuted), bg),
    'text-faint vs bg': ratio(mix(fg, bg, MIX.textFaint), bg),
    'line vs bg': ratio(tok(c.line, MIX.line), bg),
    'arrow vs bg': ratio(tok(c.accent, MIX.arrow), bg),
    'node-stroke vs bg': ratio(nodeStroke, bg),
    'node-stroke vs node-fill': ratio(nodeStroke, nodeFill),
  }
  for (const k in out) out[k] = Math.floor(out[k]! * 100) / 100
  return out
}

const current: Floors = Object.fromEntries(
  Object.entries(THEMES).map(([name, c]) => [name, measure(c)]),
)

if (process.env.UPDATE_CONTRAST_FLOORS) {
  let old: Floors = {}
  try {
    old = JSON.parse(readFileSync(FLOORS_PATH, 'utf8'))
  } catch {
    /* first run */
  }
  const next: Floors = {}
  for (const [t, toks] of Object.entries(current)) {
    next[t] = {}
    for (const [k, v] of Object.entries(toks))
      next[t][k] = Math.max(v, old[t]?.[k] ?? 0)
  }
  writeFileSync(FLOORS_PATH, JSON.stringify(next, null, 2) + '\n')
}

const floors: Floors = JSON.parse(readFileSync(FLOORS_PATH, 'utf8'))
const HOWTO =
  'If intentional, run UPDATE_CONTRAST_FLOORS=1 pnpm exec vitest run -c config/vitest.config.ts theme-derived-contrast (raises only).'

describe('derived SVG token contrast ratchet (#1864)', () => {
  for (const [theme, toks] of Object.entries(current)) {
    it(`${theme}: no derived token below its recorded floor, none above it`, () => {
      const recorded = floors[theme]!
      expect(recorded, `no floors for theme "${theme}". ${HOWTO}`).toBeDefined()
      for (const [token, now] of Object.entries(toks)) {
        const floor = recorded[token]!
        expect(floor, `no floor for ${theme} ${token}. ${HOWTO}`).toBeDefined()
        expect(
          now,
          `${theme} ${token} regressed to ${now}:1 (floor ${floor}:1)`,
        ).toBeGreaterThanOrEqual(floor)
        expect(
          now,
          `${theme} ${token} improved to ${now}:1 (floor ${floor}:1); raise the floor. ${HOWTO}`,
        ).toBeLessThanOrEqual(floor)
      }
    })
  }

  // WCAG 1.4.3 (#2000): text-sec/text-muted paint readable text. Exempt on
  // purpose: node-stroke (1.4.11; the node's text label carries the
  // information and the stroke only outlines it) and text-faint (paints only
  // spacer/": " separators beside text that is itself >= 4.5:1).
  for (const [theme, toks] of Object.entries(current))
    it(`${theme}: text-sec and text-muted meet 4.5:1 (WCAG 1.4.3)`, () => {
      expect(toks['text-sec vs bg']).toBeGreaterThanOrEqual(4.5)
      expect(toks['text-muted vs bg']).toBeGreaterThanOrEqual(4.5)
    })

  it('floors file has no stale themes', () => {
    expect(Object.keys(floors).sort()).toEqual(Object.keys(current).sort())
  })
})
