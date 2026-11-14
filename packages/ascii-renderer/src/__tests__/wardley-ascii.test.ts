/**
 * Wardley ASCII/Unicode rendering: the axes, markers, labels, links and
 * charsets. Whole-output snapshots of every gallery sample live in
 * __tests__/__ascii-snapshots__/.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('wardley ASCII', () => {
  it('draws the axes, the default stages and a marker with its label', () => {
    const rows = render('wardley-beta\ncomponent Cup [0.5, 0.5]').split('\n')
    expect(rows[0]).toBe('Visibility')
    expect(rows.at(-1)).toMatch(
      /Genesis +Custom Built +Product +Commodity +Evolution$/,
    )
    expect(rows.at(-2)).toMatch(/^└[─┴]+$/)
    expect(rows.filter((r) => r.includes('● Cup'))).toHaveLength(1)
    expect(rows.slice(1, 23).every((r) => r.startsWith('│'))).toBe(true)
  })

  it('puts evolution to the right and visibility up', () => {
    const rows = render(
      'wardley-beta\ncomponent Hi [0.9, 0.1]\ncomponent Lo [0.1, 0.9]',
    ).split('\n')
    const hi = rows.findIndex((r) => r.includes('Hi'))
    const lo = rows.findIndex((r) => r.includes('Lo'))
    expect(hi).toBeLessThan(lo)
    expect(rows[hi]!.indexOf('●')).toBeLessThan(rows[lo]!.indexOf('●'))
  })

  it('uses plain characters in ASCII mode', () => {
    const out = render(
      `wardley-beta
component A [0.9, 0.1] inertia
component B [0.5, 0.5] (buy)
component P [0.2, 0.5]
pipeline P {
  component One [0.3]
  component Two [0.7]
}
A +> B
B -.-> One
evolve A 0.4
note "n" [0.1, 0.1]`,
      true,
    )
    expect(out).not.toMatch(/[^\x00-\x7f]/)
    expect(out).toContain('o!')
    expect(out).toContain('B (buy)')
    expect(out).toContain('#')
  })

  it('draws a pipeline box round its components with the parent above', () => {
    const rows = render(
      'wardley-beta\ncomponent P [0.5, 0.5]\npipeline P {\n component A [0.2]\n component B [0.8]\n}',
    ).split('\n')
    const a = rows.findIndex((r) => r.includes('● A'))
    expect(rows[a - 1]).toMatch(/┌─+┐/)
    expect(rows[a + 1]).toMatch(/└─+┘/)
    expect(rows[a - 2]).toContain('□')
    expect(rows[a]).toMatch(/● A [^●]*● B/)
  })

  it('draws arrowheads for each flow and dots for a dashed link', () => {
    const base =
      'wardley-beta\ncomponent A [0.9, 0.1]\ncomponent B [0.1, 0.9]\n'
    expect(render(base + 'A +> B')).toContain('▸')
    expect(render(base + 'A +< B')).toMatch(/[◂▴▾▸]/)
    const both = render(base + 'A +<> B')
    expect(both.match(/[▸◂▴▾]/g)!.length).toBe(2)
    expect(render(base + 'A -.-> B')).toContain('┄')
    expect(
      render(
        'wardley-beta\ncomponent A [0.9, 0.5]\ncomponent B [0.1, 0.5]\nA -.-> B',
      ),
    ).toContain('┆')
    expect(
      render(
        'wardley-beta\ncomponent A [0.5, 0.1]\ncomponent B [0.5, 0.9]\nA +> B',
      ),
    ).toContain('▸')
  })

  it('writes a link label by the middle of the link', () => {
    expect(
      render(
        'wardley-beta\ncomponent A [0.9, 0.1]\ncomponent B [0.1, 0.9]\nA -> B; talks',
      ),
    ).toContain('talks')
  })

  it('draws a trend as a dotted arrow towards the target, left or right', () => {
    const right = render('wardley-beta\ncomponent A [0.5, 0.2]\nevolve A 0.9')
    expect(right).toMatch(/● A ?┄*▸|●.*┄┄┄▸/)
    const left = render('wardley-beta\ncomponent A [0.5, 0.9]\nevolve A 0.2')
    expect(left).toMatch(/◂┄+/)
  })

  it('moves a label to the left, above or below when the right is taken', () => {
    const out = render(
      'wardley-beta\ncomponent Left [0.5, 0.97]\ncomponent Right [0.5, 0.98]\ncomponent Edge [0.5, 0.995]',
    )
    expect(out).toContain('Left')
    expect(out).toContain('Right')
    expect(out).toContain('Edge')
    expect(out.match(/●/g)).toHaveLength(3)
  })

  it('centres an anchor’s name on its spot with no marker', () => {
    const out = render('wardley-beta\nanchor Customer [0.9, 0.5]')
    expect(out).toContain('Customer')
    expect(out).not.toContain('●')
  })

  it('lists annotation texts under the map only when the diagram has an annotations line', () => {
    const src =
      'wardley-beta\nannotation 2,[0.5, 0.5] "Second"\nannotation 1,[0.4, 0.4] "First"\nannotation 3,[0.3, 0.3] ""'
    expect(render(src)).toContain('(1)')
    expect(render(src)).not.toContain('First')
    const rows = render(src + '\nannotations [0.9, 0.1]').split('\n')
    expect(rows.slice(-2)).toEqual(['1. First', '2. Second'])
  })

  it('prints accelerators, deaccelerators and notes as text at their spot', () => {
    const out = render(
      'wardley-beta\naccelerator Up [0.5, 0.2]\ndeaccelerator Down [0.2, 0.6]\nnote "A note" [0.8, 0.5]',
    )
    expect(out).toContain('>> Up')
    expect(out).toContain('<< Down')
    expect(out).toContain('A note')
  })

  it('draws custom stages under their boundaries and cuts a name that does not fit', () => {
    const rows = render(
      'wardley-beta\nevolution Tiny@0.1 -> Rather Long Stage Name@1.0',
    ).split('\n')
    expect(rows.at(-2)!.indexOf('┴')).toBe(8)
    expect(rows.at(-1)).toContain('Rather Long Stage Name')
    const cut = render(
      'wardley-beta\nevolution Wide Stage Name Here@0.05 -> B@1.0',
    ).split('\n')
    expect(cut.at(-1)).not.toContain('Wide Stage Name Here')
  })

  it('centres the title and lines up wide characters', () => {
    const out = render(
      'wardley-beta\ntitle 地図 🗺\ncomponent "甲" [0.5, 0.5]\ncomponent B [0.5, 0.7]',
    )
    const rows = out.split('\n')
    expect(rows[0]).toMatch(/^ +地図 🗺$/)
    expect(rows[1]).toBe('')
    const jia = rows.find((r) => r.includes('甲'))!
    expect(jia.indexOf('●')).toBeGreaterThan(0)
  })

  it('draws an empty map with only the axes', () => {
    expect(render('wardley-beta')).not.toContain('●')
  })

  it('paints in colour modes and is deterministic', () => {
    const src =
      'wardley-beta\ncomponent A [0.5, 0.5]\ncomponent B [0.2, 0.8]\nA -> B'
    expect(renderMermaidASCII(src, { colorMode: 'truecolor' })).toContain(
      '\u001b[',
    )
    expect(render(src)).toBe(render(src))
  })
})
