/**
 * Event modeling ASCII/Unicode rendering: swimlane columns, boxes with their
 * type in the border, arrows, data and wrapping. Whole-output goldens live in
 * testdata/*\/eventmodeling_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('event modeling ASCII', () => {
  it('puts each frame in its lane and joins them with arrows', () => {
    expect(render('eventmodeling\ntf 01 ui Cart\ntf 02 cmd Add')).toBe(
      [
        'UI/Automation      Command/Read Model',
        '',
        '┌─ ui ──────┐',
        '│ Cart      │',
        '└─────┬─────┘',
        '      │',
        '      │',
        '      │            ┌─ command ──────┐',
        '      └───────────▶│ Add            │',
        '                   └────────────────┘',
      ].join('\n'),
    )
  })

  it('uses plain characters in ASCII mode', () => {
    const out = render('eventmodeling\ntf 01 ui Cart\ntf 02 cmd Add', true)
    expect(out).toContain('+- ui ')
    expect(out).toContain('>')
    expect(out).not.toMatch(/[─│┌┐└┘▶]/)
  })

  it('goes straight down inside a lane and back left to an earlier lane', () => {
    const out = render(
      'eventmodeling\ntf 01 ui A\ntf 02 ui B ->> 01\ntf 03 evt E\ntf 04 rmo R ->> 03',
    )
    expect(out).toContain('▼')
    expect(out).toContain('◀')
    expect(
      render('eventmodeling\ntf 01 ui A\ntf 02 ui B ->> 01', true),
    ).toContain('v')
    expect(
      render('eventmodeling\ntf 01 evt E\ntf 02 rmo R ->> 01', true),
    ).toContain('<')
  })

  it('lists inline data and data blocks, wrapping long lines', () => {
    const out = render(
      `eventmodeling\ntf 01 cmd Add { a: 1 }\ntf 02 evt Added [[D]]\ntf 03 evt T "quoted"\ntf 04 evt U \`json\`{ x }\ntf 05 evt V ${'{ ' + 'word '.repeat(12) + '}'}\ndata D {\n  one: 1\n  two: 2\n}\n`,
    )
    expect(out).toContain('a: 1')
    expect(out).toContain('one: 1')
    expect(out).toContain('two: 2')
    expect(out).toContain('quoted')
    for (const line of out.split('\n')) expect(line.length).toBeLessThan(120)
  })

  it('shares a lane between frames of one namespace, after the unnamed lane', () => {
    const out = render(
      'eventmodeling\ntf 01 rmo X.A\ntf 02 rmo X.B\ntf 03 rmo C\ntf 04 pcr Y.P\ntf 05 ui Z',
    )
    const header = out.split('\n')[0]!
    expect(header).toMatch(
      /UI\/Automation.*UI\/A: Y.*Command\/Read Model.*C\/RM: X/s,
    )
    expect(header.match(/C\/RM: X/g)).toHaveLength(1)
  })

  it('draws reset frames without arrows, skips unknown sources and paints headings', () => {
    expect(render('eventmodeling\ntf 01 ui A\nrf 02 cmd B')).not.toContain('▶')
    expect(
      render('eventmodeling\ntf 01 ui A\ntf 02 cmd B ->> 01 ->> 02'),
    ).toContain('▶')
    expect(render('eventmodeling')).toBe('')
    const painted = renderMermaidASCII(
      'eventmodeling\ntf 01 ui A\ntf 02 cmd B',
      {
        colorMode: 'truecolor',
      },
    )
    expect(painted).toContain('\u001b[')
  })

  it('aligns wide characters', () => {
    const out = render('eventmodeling\ntf 01 ui A { 画面表示 }\ntf 02 cmd B')
    const row = out.split('\n').find((l) => l.includes('画面表示'))!
    // 8 columns of text between the borders, plus the padding either side.
    expect(row.indexOf('│', 1)).toBeGreaterThan(row.indexOf('画面表示') + 4)
  })
})
