/**
 * Quadrant chart ASCII/Unicode rendering: grid geometry, marker placement
 * and the legend, axis labels, widths for wide characters, and colour modes.
 * Whole-output goldens live in testdata/*\/quadrant_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { displayWidth } from '../display-width.ts'
import { quadrantMarker } from '../quadrant.ts'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

const lines = (s: string) => s.split('\n')

describe('quadrant ASCII: grid', () => {
  it('draws a 2 x 2 frame of equal cells', () => {
    const out = lines(render('quadrantChart'))
    expect(out).toHaveLength(17)
    expect(out[0]).toBe('┌' + '─'.repeat(24) + '┬' + '─'.repeat(24) + '┐')
    expect(out[8]).toBe('├' + '─'.repeat(24) + '┼' + '─'.repeat(24) + '┤')
    expect(out[16]).toBe('└' + '─'.repeat(24) + '┴' + '─'.repeat(24) + '┘')
  })

  it('uses + - | in ASCII mode', () => {
    const out = render('quadrantChart', true)
    expect(out).not.toMatch(/[─│┌┐└┘├┤┬┴┼]/)
    expect(lines(out)[0]).toBe(
      '+' + '-'.repeat(24) + '+' + '-'.repeat(24) + '+',
    )
  })

  it('widens the cells to fit the longest quadrant label', () => {
    const label = 'a quadrant label that is rather long indeed'
    const out = lines(render(`quadrantChart\n  quadrant-2 ${label}`))
    expect(displayWidth(out[0]!)).toBe(2 * (displayWidth(label) + 2) + 3)
    expect(out.some((l) => l.includes(label))).toBe(true)
  })

  it('puts quadrant labels in quadrant-1..4 order, centred without points', () => {
    const out = lines(
      render(
        'quadrantChart\n  quadrant-1 One\n  quadrant-2 Two\n  quadrant-3 Three\n  quadrant-4 Four',
      ),
    )
    const at = (w: string) => out.findIndex((l) => l.includes(w))
    expect(out[at('One')]).toMatch(/│\s+Two\s+│\s+One\s+│/)
    expect(out[at('Three')]).toMatch(/│\s+Three\s+│\s+Four\s+│/)
    expect(at('One')).toBe(4)
    expect(at('Three')).toBe(12)
  })

  it('moves quadrant labels to the top row once there are points', () => {
    const out = lines(
      render('quadrantChart\n  quadrant-1 One\n  A: [0.1, 0.1]'),
    )
    expect(out.findIndex((l) => l.includes('One'))).toBe(1)
  })
})

describe('quadrant ASCII: points', () => {
  const grid = (src: string) => lines(render(src)).slice(0, 17)
  const where = (g: string[], ch: string) => {
    const r = g.findIndex((l) => l.includes(ch))
    return [r, g[r]!.indexOf(ch)]
  }

  it('maps the corners to the corners of the plot', () => {
    const g = grid('quadrantChart\n  A: [0, 0]\n  B: [1, 1]')
    expect(where(g, '1')).toEqual([15, 1])
    expect(where(g, '2')).toEqual([1, 49])
  })

  it('marks points 1-9, A-Z, a-z, then *', () => {
    expect([0, 8, 9, 34, 35, 60, 61, 500].map(quadrantMarker)).toEqual([
      '1',
      '9',
      'A',
      'Z',
      'a',
      'z',
      '*',
      '*',
    ])
  })

  it('lists marker, label and coordinates as written', () => {
    const out = render('quadrantChart\n  Alpha: [0.5, 0.25]\n  B: [1, 0]')
    expect(out).toContain('  1 Alpha  (0.5, 0.25)')
    expect(out).toContain('  2 B      (1, 0)')
  })

  it('moves a marker off a quadrant label and off another marker', () => {
    const g = grid(
      'quadrantChart\n  quadrant-2 Label\n  A: [0.25, 1]\n  B: [0.25, 1]\n  C: [0.25, 1]',
    )
    const cells = ['1', '2', '3'].map((m) => where(g, m))
    expect(new Set(cells.map(String)).size).toBe(3)
    // Every marker sits on a row below the label row 1 when it would hit it.
    for (const [r] of cells) expect(r).toBeGreaterThanOrEqual(1)
  })

  it('gives up on a fully crowded neighbourhood without throwing', () => {
    const pts = Array.from({ length: 150 }, (_, i) => `P${i}: [0.5, 0.5]`)
    const out = render(`quadrantChart\n  ${pts.join('\n  ')}`)
    expect(out).toContain('P149')
  })
})

describe('quadrant ASCII: axes and title', () => {
  const src =
    'quadrantChart\n  title Top\n  x-axis Low --> High\n  y-axis Down --> Up\n  A: [0.5, 0.5]'

  it('centres the title over the chart', () => {
    const out = lines(render(src))
    expect(out[0]!.trim()).toBe('Top')
    expect(out[1]).toBe('')
  })

  it('puts y labels in a gutter on each half and x labels under the halves', () => {
    const out = lines(render(src))
    expect(out.findIndex((l) => l.startsWith('  Up '))).toBeGreaterThan(0)
    expect(out.findIndex((l) => l.startsWith('Down '))).toBeGreaterThan(
      out.findIndex((l) => l.startsWith('  Up ')),
    )
    const x = out.find((l) => /Low\s+High/.test(l))!
    expect(x.indexOf('Low')).toBeLessThan(x.indexOf('High'))
  })

  it('start-aligns a one-sided x label and writes -> for the arrow in ASCII mode', () => {
    const one = render(
      'quadrantChart\n  x-axis Effort -->\n  y-axis Impact -->',
      true,
    )
    expect(one).toContain('Effort ->')
    expect(one).toContain('Impact ->')
    expect(render('quadrantChart\n  x-axis Effort -->')).toContain('Effort →')
  })

  it('omits the gutter and title block when there are none', () => {
    const out = lines(render('quadrantChart\n  quadrant-1 Q'))
    expect(out[0]!.startsWith('┌')).toBe(true)
  })

  it('keeps wide characters aligned', () => {
    const out = lines(
      render(
        'quadrantChart\n  title 優先\n  quadrant-1 今すぐ\n  "狗": [0.2, 0.8]',
      ),
    )
    const frame = out.filter((l) => /^[┌├└│]/.test(l))
    expect(new Set(frame.map(displayWidth)).size).toBe(1)
  })
})

describe('quadrant ASCII: colour', () => {
  const src = 'quadrantChart\n  A: [0.5, 0.5] color: #ff0000\n  B: [0.1, 0.1]'

  it('paints a point and its legend marker in the point colour, others in the accent', () => {
    const out = renderMermaidASCII(src, {
      colorMode: 'truecolor',
      theme: { bg: '#ffffff', fg: '#000000', accent: '#0000ff' },
    })
    expect(out).toContain('\x1b[38;2;255;0;0m1')
    expect(out).toContain('\x1b[38;2;0;0;255m2')
  })

  it('produces no escapes without a colour mode', () => {
    expect(render(src)).not.toContain('\x1b')
  })

  it('wraps cells in spans for the html colour mode', () => {
    const out = renderMermaidASCII(src, { colorMode: 'html' })
    expect(out).toContain('<span')
  })
})
