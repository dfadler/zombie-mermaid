/**
 * Role-to-color mapping, checked glyph by glyph.
 *
 * The Playwright visual suite (`__tests__/visual/ascii-samples.visual.test.ts`)
 * cannot see a line or arrowhead being recolored: both are a few thin pixels,
 * under its font-jitter tolerance (recoloring every edge line failed 0 of 90
 * samples; recoloring box borders failed 80 of 90). This test gives every role
 * its own obviously different color and asserts, cell by cell, which role each
 * glyph landed on, so a collapsed or swapped mapping fails without any pixels.
 *
 * The decisive property: `│` is a box side in a node (role `border`) and an
 * edge segment between nodes (role `line`). With distinct role colors both
 * colors must appear on that one glyph; if `line` is mapped to the border
 * color (or the other way round) one of them disappears.
 */
import { describe, it, expect } from 'vitest'
import {
  renderMermaidASCII,
  diagramColorsToAsciiTheme,
  DEFAULT_ASCII_THEME,
  type AsciiTheme,
} from '@zombie-mermaid/ascii-renderer'
import { CHART_ACCENT_FALLBACK } from '@zombie-mermaid/mermaid-parser'

/** One distinct, easy-to-tell-apart color per role. */
const ROLE_COLORS = {
  fg: '#101010',
  border: '#202020',
  line: '#303030',
  arrow: '#404040',
  accent: '#505050',
  corner: '#606060',
  junction: '#707070',
} as const

type RoleName = keyof typeof ROLE_COLORS

const ROLE_BY_HEX = new Map<string, RoleName>(
  (Object.entries(ROLE_COLORS) as [RoleName, string][]).map(([role, hex]) => [
    hex,
    role,
  ]),
)

const THEME: AsciiTheme = {
  fg: ROLE_COLORS.fg,
  border: ROLE_COLORS.border,
  line: ROLE_COLORS.line,
  arrow: ROLE_COLORS.arrow,
  accent: ROLE_COLORS.accent,
  bg: '#000000',
  corner: ROLE_COLORS.corner,
  junction: ROLE_COLORS.junction,
}

/** Corner and junction omitted: the default theme's colors fill them in. */
const THEME_WITHOUT_OPTIONAL_ROLES: AsciiTheme = {
  fg: ROLE_COLORS.fg,
  border: ROLE_COLORS.border,
  line: ROLE_COLORS.line,
  arrow: ROLE_COLORS.arrow,
  accent: ROLE_COLORS.accent,
  bg: '#000000',
}

/** Role given to a glyph that carries no color at all. */
const UNCOLORED = 'uncolored'

interface Cell {
  ch: string
  /** Role name, the raw hex when it is none of ROLE_COLORS, or UNCOLORED. */
  role: string
}

const decode = (s: string): string =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

const hex2 = (n: number): string => n.toString(16).padStart(2, '0')

/**
 * Every non-space glyph in the output, with the role its color maps to, or
 * UNCOLORED when the glyph carries no color. Uncolored glyphs must be kept: a
 * role that loses its color emits its glyphs bare, and a parser that skipped
 * them would let every per-glyph assertion pass with nothing left to check.
 */
function glyphCells(output: string, mode: 'html' | 'truecolor'): Cell[] {
  const cells: Cell[] = []
  const push = (hex: string | undefined, text: string): void => {
    const role =
      hex === undefined
        ? UNCOLORED
        : (ROLE_BY_HEX.get(hex.toLowerCase()) ?? hex.toLowerCase())
    for (const ch of text) if (ch.trim() !== '') cells.push({ ch, role })
  }
  if (mode === 'html') {
    // <span style="color:#rrggbb...">text</span>, or bare text between spans
    const part =
      /<span style="color:(#[0-9a-fA-F]{6})[^"]*">([^<]*)<\/span>|([^<]+)/g
    for (const m of output.matchAll(part)) {
      if (m[1] === undefined) push(undefined, decode(m[3]!))
      else push(m[1], decode(m[2]!))
    }
  } else {
    // ESC [ 38;2;R;G;B m <text> ESC [ 0 m, or bare text between them
    const part = /\x1b\[38;2;(\d+);(\d+);(\d+)m([^\x1b]*)\x1b\[0m|([^\x1b]+)/g
    for (const m of output.matchAll(part)) {
      if (m[1] === undefined) push(undefined, m[5]!)
      else push(`#${hex2(+m[1])}${hex2(+m[2]!)}${hex2(+m[3]!)}`, m[4]!)
    }
  }
  return cells
}

const DIAGRAMS = {
  'straight flowchart': 'graph TD\n  A[Start] -->|go| B[End]\n  B --> C[Done]',
  // Bends in the routed edges, so the `corner` role is exercised.
  'flowchart with bends':
    'graph TD\n  A[Top] --> B[Left]\n  A --> C[Right]\n  B --> D[Join]\n  C --> D',
  'left-to-right flowchart':
    'graph LR\n  A[One] --> B[Two]\n  A --> C[Three]\n  B --> D[Four]\n  C --> D',
  'sequence diagram':
    'sequenceDiagram\n  participant Alice\n  participant Bob\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi',
} as const

const ARROWHEADS = new Set('▲▼◄►◀▶△▽◁▷')
const ALNUM = /^[\p{L}\p{N}]$/u

for (const mode of ['html', 'truecolor'] as const) {
  describe(`ASCII role colors (${mode})`, () => {
    const render = (src: string, theme: AsciiTheme = THEME): Cell[] =>
      glyphCells(renderMermaidASCII(src, { theme, colorMode: mode }), mode)

    for (const [name, src] of Object.entries(DIAGRAMS)) {
      describe(name, () => {
        const cells = render(src)

        it('colors every glyph with one of the theme role colors', () => {
          // Includes UNCOLORED: a glyph with no color at all is a failure too.
          const stray = cells.filter((c) => !(c.role in ROLE_COLORS))
          expect(stray).toEqual([])
        })

        it('draws letters and digits in the text color', () => {
          const letters = cells.filter((c) => ALNUM.test(c.ch))
          // Guard against passing with nothing to check.
          expect(letters.length).toBeGreaterThan(0)
          expect(letters.filter((c) => c.role !== 'fg')).toEqual([])
        })

        it('draws arrowheads in the arrow color, and only arrowheads', () => {
          const arrowheads = cells.filter((c) => ARROWHEADS.has(c.ch))
          expect(arrowheads.length).toBeGreaterThan(0)
          expect(arrowheads.filter((c) => c.role !== 'arrow')).toEqual([])
          expect(
            cells.filter((c) => c.role === 'arrow' && !ARROWHEADS.has(c.ch)),
          ).toEqual([])
        })

        it('uses a line color distinct from the border color', () => {
          const roles = new Set(cells.map((c) => c.role))
          expect(roles.has('line')).toBe(true)
          expect(roles.has('border')).toBe(true)
        })
      })
    }

    it('draws a vertical stroke as border in a box and as line on an edge', () => {
      const bars = new Set(
        render(DIAGRAMS['straight flowchart'])
          .filter((c) => c.ch === '│')
          .map((c) => c.role),
      )
      expect(bars).toEqual(new Set(['border', 'line']))
    })

    it('draws box sides and corners in the border color', () => {
      const boxGlyphs = new Set('┌┐└┘')
      const cells = render(DIAGRAMS['straight flowchart'])
      const boxCorners = cells.filter((c) => boxGlyphs.has(c.ch))
      expect(boxCorners.length).toBeGreaterThan(0)
      expect(boxCorners.every((c) => c.role === 'border')).toBe(true)
    })

    it('uses the junction color where an edge meets a box', () => {
      const roles = render(DIAGRAMS['straight flowchart'])
        .filter((c) => c.ch === '┬')
        .map((c) => c.role)
      expect(roles.length).toBeGreaterThan(0)
      expect(new Set(roles)).toEqual(new Set(['junction']))
    })

    it('uses the corner color where a routed edge bends', () => {
      const corners = render(DIAGRAMS['flowchart with bends']).filter(
        (c) => c.role === 'corner',
      )
      expect(corners.length).toBeGreaterThan(0)
      expect(corners.every((c) => '┐┘└┌'.includes(c.ch))).toBe(true)
    })

    it('uses the accent color for bars, and only for bars', () => {
      const cells = render('xychart-beta\n  x-axis [A, B, C]\n  bar [3, 5, 2]')
      const accent = cells.filter((c) => c.role === 'accent')
      expect(accent.length).toBeGreaterThan(0)
      expect(accent.every((c) => c.ch === '█')).toBe(true)
    })

    it("takes the default theme's corner and junction colors when the theme omits them", () => {
      // renderMermaidASCII merges the given theme over DEFAULT_ASCII_THEME, so
      // an omitted `corner` or `junction` gets the default theme's color (not
      // the custom `line` or `border`).
      const cells = render(
        DIAGRAMS['flowchart with bends'],
        THEME_WITHOUT_OPTIONAL_ROLES,
      )
      const defaults = new Set([
        DEFAULT_ASCII_THEME.corner!.toLowerCase(),
        DEFAULT_ASCII_THEME.junction!.toLowerCase(),
      ])
      // Cells that are none of the custom role colors can only be the
      // defaulted corner and junction roles.
      const defaulted = cells.filter((c) => !(c.role in ROLE_COLORS))
      expect(defaulted.length).toBeGreaterThan(0)
      expect(defaulted.every((c) => defaults.has(c.role))).toBe(true)
      expect(defaulted.every((c) => '┐┘└┌┬┴├┤┼'.includes(c.ch))).toBe(true)
      // The custom roles are unaffected by the omission.
      expect(cells.some((c) => c.role === 'line')).toBe(true)
      expect(cells.some((c) => c.role === 'border')).toBe(true)
    })
  })
}

// ---------------------------------------------------------------------------
// The accent role. Charts do not take it from `getRoleColor`: xychart.ts has
// its own series-color derivation (`getSeriesColors`) and its own copy of the
// role-to-color mapping (`roleToHex`) for axes, grid and labels, so neither is
// covered by the tests above.
// ---------------------------------------------------------------------------

const ONE_BAR_SERIES = 'xychart-beta\n  x-axis [A, B, C]\n  bar [3, 5, 2]'
const TWO_BAR_SERIES =
  'xychart-beta\n  title "Sales"\n  x-axis [Q1, Q2, Q3, Q4]\n  bar [200, 250, 300, 280]\n  bar [230, 280, 320, 350]'
const TWO_LINE_SERIES =
  'xychart-beta\n  x-axis [A, B, C, D]\n  line [3, 5, 2, 6]\n  line [1, 2, 4, 3]'

/** A role-color theme without an accent, to exercise the chart's fallback. */
const THEME_WITHOUT_ACCENT: AsciiTheme = {
  fg: ROLE_COLORS.fg,
  border: ROLE_COLORS.border,
  line: ROLE_COLORS.line,
  arrow: ROLE_COLORS.arrow,
  bg: '#000000',
  corner: ROLE_COLORS.corner,
  junction: ROLE_COLORS.junction,
}

for (const mode of ['html', 'truecolor'] as const) {
  describe(`xychart accent and role colors (${mode})`, () => {
    const render = (src: string, theme: AsciiTheme = THEME): Cell[] =>
      glyphCells(renderMermaidASCII(src, { theme, colorMode: mode }), mode)
    const colorsOf = (cells: Cell[], glyphs: string): Set<string> =>
      new Set(cells.filter((c) => glyphs.includes(c.ch)).map((c) => c.role))

    it('draws a single bar series in exactly the accent color', () => {
      const bars = render(ONE_BAR_SERIES).filter((c) => c.ch === '█')
      expect(bars.length).toBeGreaterThan(0)
      expect(colorsOf(bars, '█')).toEqual(new Set(['accent']))
    })

    it('draws series 0 in the accent and later series in a different derived color', () => {
      const barColors = colorsOf(render(TWO_BAR_SERIES), '█')
      expect(barColors.size).toBe(2)
      expect(barColors.has('accent')).toBe(true)
      // The other series is a derived shade: neither the accent nor any role color.
      const derived = [...barColors].filter((r) => r !== 'accent')
      expect(derived).toHaveLength(1)
      expect(derived[0]! in ROLE_COLORS).toBe(false)
      expect(derived[0]).toMatch(/^#[0-9a-f]{6}$/)
    })

    it('draws line series with the same accent and derived colors', () => {
      const cells = render(TWO_LINE_SERIES)
      const lineGlyphs = '─╭│╮╯╰'
      const roles = colorsOf(cells, lineGlyphs)
      expect(roles.has('accent')).toBe(true)
      // Series 0 (accent), series 1 (derived), and the axis (border): the same
      // glyphs appear in all three, so the accent is not the border color.
      expect([...roles].some((r) => !(r in ROLE_COLORS))).toBe(true)
      expect(roles.has('border')).toBe(true)
      expect(ROLE_COLORS.accent).not.toBe(ROLE_COLORS.border)
    })

    it('draws the axes in the border color, the grid in the line color and labels in the text color', () => {
      const cells = render(ONE_BAR_SERIES)
      expect(colorsOf(cells, '│┤┼┬─')).toEqual(new Set(['border']))
      expect(colorsOf(cells, '·')).toEqual(new Set(['line']))
      const labels = cells.filter((c) => ALNUM.test(c.ch))
      expect(labels.length).toBeGreaterThan(0)
      expect(labels.every((c) => c.role === 'fg')).toBe(true)
    })

    it('falls back to the default chart blue when the theme has no accent', () => {
      const bars = render(ONE_BAR_SERIES, THEME_WITHOUT_ACCENT).filter(
        (c) => c.ch === '█',
      )
      expect(bars.length).toBeGreaterThan(0)
      expect(colorsOf(bars, '█')).toEqual(
        new Set([CHART_ACCENT_FALLBACK.toLowerCase()]),
      )
    })
  })
}

describe('diagramColorsToAsciiTheme accent', () => {
  const colors = { bg: '#000000', fg: '#ffffff' }

  it('passes the accent through and uses it for arrowheads', () => {
    const theme = diagramColorsToAsciiTheme({ ...colors, accent: '#123456' })
    expect(theme.accent).toBe('#123456')
    expect(theme.arrow).toBe('#123456')
  })

  it('derives the arrow color from fg and bg when there is no accent', () => {
    const theme = diagramColorsToAsciiTheme(colors)
    expect(theme.accent).toBeUndefined()
    expect(theme.arrow).not.toBe(theme.fg)
    expect(theme.arrow).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})
