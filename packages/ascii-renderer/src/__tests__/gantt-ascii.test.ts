/**
 * Gantt chart ASCII/Unicode rendering: bar glyphs and columns, axis ticks and
 * labels, label column, milestones, vert markers, charsets and colour.
 * Whole-output goldens live in testdata/*\/gantt_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { displayWidth } from '../display-width.ts'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })
const lines = (s: string) => s.split('\n')
const head = 'gantt\n  dateFormat YYYY-MM-DD\n'

describe('gantt ASCII: bars', () => {
  it('maps the whole span onto 60 columns', () => {
    const out = lines(render(head + '  A :2024-01-01, 10d'))
    expect(out[0]).toBe('A ' + '█'.repeat(60))
  })

  it('gives a one-day chart a one-column-wide bar per task', () => {
    const out = lines(render(head + '  A :2024-01-01, 1d\n  B :2024-01-01, 1d'))
    expect(out[0]).toBe('A ' + '█'.repeat(60))
    // A zero-length span still draws at least one column
    const z = lines(render(head + '  A :2024-01-01, 0d'))
    expect(z[0]).toMatch(/^A █$/)
  })

  it('uses a distinct glyph per status and marks crit+done with !', () => {
    const out = render(
      head +
        '  P :2024-01-01, 2d\n  D :done, 2024-01-03, 2d\n  C :crit, 2024-01-05, 2d\n  X :crit, active, 2024-01-07, 2d\n  M :milestone, 2024-01-09, 0d',
    )
    for (const g of ['█', '░', '▓', '▒', '◆']) expect(out).toContain(g)
    expect(out).toMatch(/^X !/m)
    expect(out).not.toMatch(/^C !/m)
    expect(lines(out).at(-1)).toBe(
      '  █ task  ▒ active  ░ done  ▓ crit  ◆ milestone',
    )
  })

  it('centres a milestone on the last tick at the last column', () => {
    const out = lines(
      render(head + '  A :2024-01-01, 9d\n  M :milestone, 2024-01-10, 0d'),
    )
    expect(out[1]).toBe('M ' + ' '.repeat(59) + '◆')
  })

  it('draws to renderEnd when excluded days stretch the task', () => {
    const out = lines(
      render(
        head + '  excludes weekends\n  A :2024-03-04, 5d\n  B :2024-03-11, 1d',
      ),
    )
    // Mon 4th + 5 working days ends Mon 11th, so the bar fills 7 of 8 days
    expect(out[0]!.indexOf('█')).toBe(2)
    expect(out[0]!.split('█').length - 1).toBeGreaterThan(30)
  })
})

describe('gantt ASCII: axis', () => {
  it('prints tick labels in axisFormat under the bars and again on top for topAxis', () => {
    const out = lines(
      render(head + '  axisFormat %d/%m\n  topAxis\n  A :2024-01-01, 30d'),
    )
    expect(out[0]).toMatch(/^ {2}\d\d\/\d\d/)
    expect(out[1]).toMatch(/^ {2}[─┴]+$/)
    expect(out.at(-4)).toMatch(/^ {2}[─┬]+$/)
    expect(out.at(-3)).toMatch(/\d\d\/\d\d/)
  })

  it('drops overlapping tick labels but keeps the first and the last', () => {
    // 16-column labels at 10 ticks cannot all fit in 60 columns
    const out = lines(
      render(head + '  axisFormat %Y-%m-%d %H:%M\n  A :2024-01-01, 10d'),
    )
    const labels = out.at(-3)!.match(/\d{4}-\d\d-\d\d \d\d:\d\d/g)!
    expect(labels.length).toBeLessThan(10)
    expect(labels[0]).toBe('2024-01-01 00:00')
    expect(labels.at(-1)).toBe('2024-01-11 00:00')
  })

  it('uses + and - in ASCII mode', () => {
    const out = render(head + '  A :2024-01-01, 10d', true)
    expect(out).not.toMatch(/[█─┬]/)
    expect(out).toMatch(/^ +\+-+\+/m)
  })
})

describe('gantt ASCII: labels and sections', () => {
  it('indents tasks under section headers', () => {
    const out = lines(render(head + '  section S\n  A :2024-01-01, 3d'))
    expect(out[0]).toBe('S')
    expect(out[1]).toMatch(/^ {2}A /)
  })

  it('truncates labels wider than the label column', () => {
    const long = 'x'.repeat(50)
    const u = lines(render(head + `  ${long} :2024-01-01, 3d`))
    expect(displayWidth(u[0]!.split('█')[0]!)).toBe(33)
    expect(u[0]).toContain('x'.repeat(31) + '…')
    expect(render(head + `  ${long} :2024-01-01, 3d`, true)).toContain(
      'x'.repeat(29) + '...',
    )
  })

  it('truncates wide characters on a cell boundary', () => {
    const out = lines(render(head + `  ${'日'.repeat(30)} :2024-01-01, 3d`))
    expect(displayWidth(out[0]!.split('█')[0]!)).toBeLessThanOrEqual(33)
    expect(out[0]).toContain('…')
  })
})

describe('gantt ASCII: vert, title, empty', () => {
  it('draws a vert marker through the rows and labels it under the axis', () => {
    const out = render(
      head +
        '  A :2024-01-01, 10d\n  B :2024-01-02, 2d\n  V :vert, 2024-01-08, 0d',
    )
    expect(lines(out)[1]).toContain('┆')
    expect(out).toContain('┆ V')
    expect(
      render(head + '  A :2024-01-01, 10d\n  V :vert, 2024-01-08, 0d', true),
    ).toContain(': V')
  })

  it('works with only a vert task', () => {
    expect(render(head + '  V :vert, 2024-01-08, 0d')).toContain('┆ V')
  })

  it('centres the title and prints nothing for an empty chart', () => {
    expect(render('gantt')).toBe('')
    expect(render('gantt\n  title Hi')).toBe('Hi')
    const out = lines(render(head + '  title T\n  A :2024-01-01, 10d'))
    expect(out[0]!.trim()).toBe('T')
    expect(out[0]!.length).toBeGreaterThan(20)
  })
})

describe('gantt ASCII: colour', () => {
  it('emits ANSI codes only when asked', () => {
    const src = head + '  A :2024-01-01, 10d'
    expect(render(src)).not.toContain('\x1b[')
    expect(
      renderMermaidASCII(src, {
        colorMode: 'truecolor',
        theme: { accent: '#ff0000' },
      }),
    ).toContain('\x1b[')
  })
})
