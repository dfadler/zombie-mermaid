/**
 * Tests for pie chart ASCII/Unicode rendering: the bar's cell allocation,
 * the table's percentages and labels (matching the SVG renderer's
 * semantics), and the output in every colour mode.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import {
  parsePieChart,
  getSeriesColor,
  CHART_ACCENT_FALLBACK,
} from '@zombie-mermaid/mermaid-parser'
import { allocateCells, layoutPieAscii, BAR_WIDTH } from '../pie.ts'
import { displayWidth } from '../display-width.ts'

function render(text: string, useAscii = false): string {
  return renderMermaidASCII(text, { colorMode: 'none', useAscii })
}

/** The bar line: the one that starts with '['. */
function barOf(output: string): string {
  const line = output.split('\n').find((l) => l.startsWith('['))
  if (line === undefined) throw new Error(`no bar in:\n${output}`)
  return line
}

/** Run lengths of the bar's interior, e.g. '[aab]' -> ['aa', 'b']. */
function runsOf(bar: string): string[] {
  return bar.slice(1, -1).match(/(.)\1*/gu) ?? []
}

const PETS = `pie title Pets adopted by volunteers
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15`

// ============================================================================
// allocateCells
// ============================================================================

describe('pie ASCII – allocateCells', () => {
  it('always adds up to exactly the bar width', () => {
    const cases = [
      [386, 85, 15],
      [1, 1, 1],
      [42.96, 50.05, 10.01, 5],
      [14, 9, 13, 8, 12, 7, 11, 7, 10, 6, 5, 3, 4, 2],
      [1, 2, 3, 4, 5, 6, 7],
      [99, 1],
      [33.3, 33.3, 33.4],
      [0.1, 0.2, 0.3],
    ]
    for (const weights of cases) {
      for (const width of [1, 7, 10, 50, 51, 99]) {
        const cells = allocateCells(weights, width)
        expect(
          cells.reduce((a, b) => a + b, 0),
          `${weights} @${width}`,
        ).toBe(width)
        expect(cells.every((c) => c >= 0)).toBe(true)
      }
    }
  })

  it('rounds by largest remainder', () => {
    // Exact shares 38.8 / 8.5 / 2.7 -> floors 38 / 8 / 2 (48), the two
    // spare cells go to .8 and .7, not .5.
    expect(allocateCells([776, 170, 54], 50)).toEqual([39, 8, 3])
  })

  it('gives every part at least one cell when there is room', () => {
    // 1 of 1000 is 0.05 of a cell: it still gets one, taken from the big part.
    expect(allocateCells([999, 1], 50)).toEqual([49, 1])
    const many = allocateCells(
      Array.from({ length: 50 }, (_, i) => (i === 0 ? 1000 : 1)),
      50,
    )
    expect(many).toEqual(Array.from({ length: 50 }, () => 1))
  })

  it('lets parts go empty when there are more parts than cells', () => {
    const cells = allocateCells([1, 1, 1, 1, 1], 3)
    expect(cells.reduce((a, b) => a + b, 0)).toBe(3)
    expect(cells.filter((c) => c === 0)).toHaveLength(2)
  })

  it('gives one part the whole bar', () => {
    expect(allocateCells([7], 50)).toEqual([50])
  })

  it('returns nothing for no parts and zeros for a zero total', () => {
    expect(allocateCells([], 50)).toEqual([])
    expect(allocateCells([0, 0], 50)).toEqual([0, 0])
  })
})

// ============================================================================
// layoutPieAscii — the SVG renderer's data semantics
// ============================================================================

describe('pie ASCII – layout', () => {
  it('keeps source order and uses whole-number percentages of the total', () => {
    const layout = layoutPieAscii(parsePieChart(PETS))
    expect(layout.rows.map((r) => [r.text, r.percentText])).toEqual([
      ['Dogs', '79%'],
      ['Cats', '17%'],
      ['Rats', '3%'],
    ])
    expect(layout.rows.reduce((a, r) => a + r.cells, 0)).toBe(BAR_WIDTH)
  })

  it('leaves slices under 1% (and zero slices) out of the bar but keeps their rows', () => {
    const layout = layoutPieAscii(
      parsePieChart(`pie
  "Big" : 990
  "Small" : 9
  "Tiny" : 1
  "None" : 0`),
    )
    expect(
      layout.rows.map((r) => [r.text, r.percentText, r.cells > 0]),
    ).toEqual([
      ['Big', '99%', true],
      ['Small', '', false],
      ['Tiny', '', false],
      ['None', '', false],
    ])
    // The drawn slices share the whole bar, like the SVG's drawn slices
    // share the whole circle.
    expect(layout.rows[0]!.cells).toBe(BAR_WIDTH)
  })

  it('computes percentages against the full total, omitted slices included', () => {
    // C is 0.9% and left out of the bar, but still counts: B is 491/1000 =
    // 49%. Against the drawn total only it would be 491/991 = 50%.
    const layout = layoutPieAscii(
      parsePieChart(`pie
  "A" : 500
  "B" : 491
  "C" : 9`),
    )
    expect(layout.rows.map((r) => r.percentText)).toEqual(['50%', '49%', ''])
  })

  it('formats showData values with String(value), no separators', () => {
    const layout = layoutPieAscii(
      parsePieChart(`pie showData
  "Big" : 1234567
  "Frac" : 42.96`),
    )
    expect(layout.rows.map((r) => r.text)).toEqual([
      'Big [1234567]',
      'Frac [42.96]',
    ])
  })

  it('keys colours by source position modulo 12', () => {
    const src =
      'pie\n' + Array.from({ length: 14 }, (_, i) => `  "s${i}" : 1`).join('\n')
    const layout = layoutPieAscii(parsePieChart(src))
    expect(layout.rows.map((r) => r.colorIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1,
    ])
  })

  it('draws nothing for a chart with no slices or a zero total', () => {
    expect(layoutPieAscii(parsePieChart('pie')).rows).toEqual([])
    const zeros = layoutPieAscii(parsePieChart('pie\n  "A" : 0\n  "B" : 0'))
    expect(zeros.rows.map((r) => [r.cells, r.percentText])).toEqual([
      [0, ''],
      [0, ''],
    ])
  })
})

// ============================================================================
// Rendered output
// ============================================================================

describe('pie ASCII – output', () => {
  it('renders the basic chart (Unicode)', () => {
    expect(render(PETS)).toBe(
      [
        '             Pets adopted by volunteers',
        '',
        `[${'█'.repeat(40)}${'▓'.repeat(9)}▒]`,
        '',
        '  █ Dogs    79%',
        '  ▓ Cats    17%',
        '  ▒ Rats     3%',
      ].join('\n'),
    )
  })

  it('renders the basic chart with ASCII characters only', () => {
    const out = render(PETS, true)
    expect(out).toBe(
      [
        '             Pets adopted by volunteers',
        '',
        `[${'#'.repeat(40)}${'='.repeat(9)}*]`,
        '',
        '  # Dogs    79%',
        '  = Cats    17%',
        '  * Rats     3%',
      ].join('\n'),
    )
    expect(out).toMatch(/^[\x20-\x7e\n]*$/)
  })

  it('keeps the bar exactly BAR_WIDTH cells between its brackets', () => {
    for (const src of [
      PETS,
      'pie\n  "A" : 1\n  "B" : 1\n  "C" : 1',
      'pie\n  "Only" : 3',
      'pie',
      'pie title Nothing',
    ]) {
      expect(displayWidth(barOf(render(src)))).toBe(BAR_WIDTH + 2)
    }
  })

  it('fills the whole bar for a single slice', () => {
    const out = render('pie title Uptime\n  "Up" : 1')
    expect(barOf(out)).toBe(`[${'█'.repeat(BAR_WIDTH)}]`)
    expect(out).toContain('  █ Up   100%')
  })

  it('gives neighbouring segments different fills without colour', () => {
    const src =
      'pie\n' +
      Array.from({ length: 14 }, (_, i) => `  "s${i}" : ${20 - i}`).join('\n')
    const runs = runsOf(barOf(render(src)))
    expect(runs).toHaveLength(14)
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i]![0]).not.toBe(runs[i - 1]![0])
    }
    // Each table swatch repeats its segment's fill.
    const swatches = render(src)
      .split('\n')
      .filter((l) => l.startsWith('  '))
      .map((l) => l[2])
    expect(swatches).toEqual(runs.map((r) => r[0]))
  })

  it('shows omitted slices with a dot swatch and no percentage', () => {
    const out = render(`pie showData
  "Chrome" : 640
  "Lynx" : 1
  "Netscape" : 0`)
    expect(out.split('\n').slice(-3)).toEqual([
      '  █ Chrome [640]   100%',
      '  · Lynx [1]',
      '  · Netscape [0]',
    ])
    expect(render('pie\n  "A" : 999\n  "B" : 1', true)).toContain('  . B')
  })

  it('renders an empty bar for a chart with no slices', () => {
    expect(render('pie title Empty')).toBe(
      ['                       Empty', '', `[${' '.repeat(BAR_WIDTH)}]`].join(
        '\n',
      ),
    )
    expect(render('pie')).toBe(`[${' '.repeat(BAR_WIDTH)}]`)
  })

  it('does not print accTitle or accDescr', () => {
    const out = render(`pie
  accTitle: Hidden name
  accDescr: Hidden description
  "A" : 1`)
    expect(out).not.toContain('Hidden')
  })

  it('aligns the percentage column by display width for wide labels', () => {
    const out = render(`pie
  "猫 cats 🐱" : 3
  "dogs" : 1`)
    const rows = out.split('\n').filter((l) => l.endsWith('%'))
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map((r) => displayWidth(r))).size).toBe(1)
  })

  it('never truncates a long label', () => {
    const long =
      'A very long slice label that is much wider than the bar itself'
    const out = render(`pie\n  "${long}" : 1\n  "B" : 1`)
    expect(out).toContain(`  █ ${long}    50%`)
  })

  it('surfaces parse errors', () => {
    expect(() => render('pie\n  Dogs : 1')).toThrow()
  })
})

// ============================================================================
// Colour modes
// ============================================================================

describe('pie ASCII – colour modes', () => {
  const theme = {
    fg: '#111111',
    border: '#222222',
    line: '#333333',
    arrow: '#444444',
    accent: '#7aa2f7',
    bg: '#1a1b26',
  }

  it('uses the SVG palette: accent first, then getSeriesColor shades', () => {
    const out = renderMermaidASCII(PETS, { colorMode: 'html', theme })
    for (const i of [0, 1, 2]) {
      const hex = getSeriesColor(i, theme.accent, theme.bg)
      expect(out).toContain(`color:${hex};background:${hex}`)
    }
    expect(getSeriesColor(0, theme.accent, theme.bg)).toBe(theme.accent)
  })

  it('falls back to the chart accent when the theme has none', () => {
    const out = renderMermaidASCII(PETS, { colorMode: 'html' })
    expect(out).toContain(`color:${CHART_ACCENT_FALLBACK}`)
  })

  it('wraps the palette after 12 slices', () => {
    const src =
      'pie\n' + Array.from({ length: 13 }, (_, i) => `  "s${i}" : 1`).join('\n')
    const out = renderMermaidASCII(src, { colorMode: 'html', theme })
    const rows = out
      .split('\n')
      .filter((l) => l.includes('s0<') || l.includes('s12<'))
    expect(rows).toHaveLength(2)
    expect(rows[0]!.match(/background:(#[0-9a-f]{6})/)?.[1]).toBe(theme.accent)
    expect(rows[1]!.match(/background:(#[0-9a-f]{6})/)?.[1]).toBe(theme.accent)
  })

  it('uses solid blocks for every segment when coloured', () => {
    const src = 'pie\n  "A" : 1\n  "B" : 1\n  "C" : 1\n  "D" : 1\n  "E" : 1'
    const out = renderMermaidASCII(src, { colorMode: 'truecolor', theme })

    const plain = out.replace(/\x1b\[[0-9;]*m/g, '')
    expect(barOf(plain)).toBe(`[${'█'.repeat(BAR_WIDTH)}]`)
  })

  it('escapes HTML in labels and titles', () => {
    const out = renderMermaidASCII('pie title <b>\n  "a&b" : 1', {
      colorMode: 'html',
    })
    expect(out).toContain('&lt;b&gt;')
    expect(out).toContain('a&amp;b')
    expect(out).not.toContain('<b>')
  })

  for (const mode of ['ansi16', 'ansi256', 'truecolor'] as const) {
    it(`emits ANSI escapes in ${mode} that strip back to the plain output`, () => {
      const out = renderMermaidASCII(PETS, { colorMode: mode, theme })
      expect(out).toContain('\x1b[')

      const plain = out.replace(/\x1b\[[0-9;]*m/g, '')
      // Colour swaps the no-colour fill patterns for solid blocks; the
      // layout is otherwise identical.
      expect(plain).toBe(render(PETS).replace(/[▓▒░]/g, '█'))
    })
  }

  it('emits no escapes in none mode', () => {
    expect(render(PETS)).not.toContain('\x1b')
  })
})
