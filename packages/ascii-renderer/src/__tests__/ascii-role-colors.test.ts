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
  DEFAULT_ASCII_THEME,
  type AsciiTheme,
} from '@zombie-mermaid/ascii-renderer'

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

interface Cell {
  ch: string
  /** Role name, or the raw hex when it is none of ROLE_COLORS. */
  role: string
}

const decode = (s: string): string =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

const hex2 = (n: number): string => n.toString(16).padStart(2, '0')

/** Every colored, non-space glyph in the output, with the role its color maps to. */
function coloredCells(output: string, mode: 'html' | 'truecolor'): Cell[] {
  const cells: Cell[] = []
  const push = (hex: string, text: string): void => {
    const role = ROLE_BY_HEX.get(hex.toLowerCase()) ?? hex.toLowerCase()
    for (const ch of text) if (ch.trim() !== '') cells.push({ ch, role })
  }
  if (mode === 'html') {
    const span = /<span style="color:(#[0-9a-fA-F]{6})[^"]*">([^<]*)<\/span>/g
    for (const m of output.matchAll(span)) push(m[1]!, decode(m[2]!))
  } else {
    // ESC [ 38;2;R;G;B m <text> ESC [ 0 m
    const sgr = /\x1b\[38;2;(\d+);(\d+);(\d+)m([^\x1b]*)\x1b\[0m/g
    for (const m of output.matchAll(sgr))
      push(`#${hex2(+m[1]!)}${hex2(+m[2]!)}${hex2(+m[3]!)}`, m[4]!)
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
      coloredCells(renderMermaidASCII(src, { theme, colorMode: mode }), mode)

    for (const [name, src] of Object.entries(DIAGRAMS)) {
      describe(name, () => {
        const cells = render(src)

        it('uses only the theme role colors', () => {
          const stray = cells.filter((c) => !(c.role in ROLE_COLORS))
          expect(stray).toEqual([])
        })

        it('draws letters and digits in the text color', () => {
          const wrong = cells.filter((c) => ALNUM.test(c.ch) && c.role !== 'fg')
          expect(wrong).toEqual([])
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
