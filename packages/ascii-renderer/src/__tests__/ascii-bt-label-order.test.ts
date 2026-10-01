/**
 * Regression tests: BT is laid out as TD and the finished canvas is flipped
 * vertically. The flip must mirror node positions and edge/arrowhead
 * directions but leave each label's lines in reading order, and must not
 * treat label characters (`v`, `^`) as arrowheads.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const bt = (src: string) => renderMermaidASCII(src, { colorMode: 'none' })
const rowOf = (out: string, needle: string) =>
  out.split('\n').findIndex((l) => l.includes(needle))

describe('BT direction keeps label text intact', () => {
  it('keeps multi-line node label lines in reading order', () => {
    const out = bt('graph BT\n  A["Top<br/>Second"] --> B["Below"]')
    expect(rowOf(out, 'Top')).toBeLessThan(rowOf(out, 'Second'))
    // Nodes are still mirrored: the edge target sits above its source.
    expect(rowOf(out, 'Below')).toBeLessThan(rowOf(out, 'Top'))
  })

  it('keeps multi-line edge label lines in reading order', () => {
    const out = bt('graph BT\n  A -->|"up<br/>down"| B')
    expect(rowOf(out, 'up')).toBeLessThan(rowOf(out, 'down'))
  })

  it('does not rewrite v / ^ characters inside labels', () => {
    const out = bt('graph BT\n  A["v ^<br/>x"] --> B')
    expect(out).toContain('v ^')
    expect(rowOf(out, 'v ^')).toBeLessThan(rowOf(out, 'x'))
  })

  it('draws a cylinder with its rounded caps the right way up', () => {
    const lines = bt('graph BT\n  A[("DB")] --> B').split('\n')
    const top = lines.find((l) => l.includes('╭'))!
    const bottom = lines.find((l) => l.includes('╰'))!
    expect(lines.indexOf(top)).toBeLessThan(lines.indexOf(bottom))
  })

  it('keeps paragraphs on either side of a blank label line in order', () => {
    const out = bt(
      'graph BT\n  A["Name<br/>[type]<br/><br/>Description"] --> B["x"]',
    )
    const [name, type, desc] = ['Name', '[type]', 'Description'].map((t) =>
      rowOf(out, t),
    ) as [number, number, number]
    expect(name).toBeLessThan(type)
    // The blank line stays between [type] and Description.
    expect(desc - type).toBe(2)
    expect(out.split('\n')[type + 1]!.replace(/[│\s]/g, '')).toBe('')
  })

  it('keeps a wide first line intact above a shorter second line', () => {
    const out = bt(
      'graph BT\n  A["Personal Banking Customer<br/>[Person]"] --> B["x"]',
    )
    const rows = out.split('\n')
    const wide = rows[rowOf(out, 'Personal Banking Customer')]!
    const narrow = rows[rowOf(out, '[Person]')]!
    expect(rowOf(out, 'Personal Banking Customer')).toBeLessThan(
      rowOf(out, '[Person]'),
    )
    // [Person] stays centred under the wide line.
    const mid = (l: string, t: string) => l.indexOf(t) + t.length / 2
    expect(
      Math.abs(
        mid(wide, 'Personal Banking Customer') - mid(narrow, '[Person]'),
      ),
    ).toBeLessThanOrEqual(1)
  })

  it('does not split a hyphenated node label when it moves', () => {
    const out = bt('graph BT\n  A["E-mail System<br/>[Software]"] --> B["x"]')
    expect(out).toContain('E-mail System')
    expect(rowOf(out, 'E-mail System')).toBeLessThan(rowOf(out, '[Software]'))
  })

  it('draws hyphenated edge labels the same as TD, vertical and horizontal', () => {
    const edgeRow = (out: string) =>
      out
        .split('\n')
        .find((l) => l.includes('E-mail'))!
        .trim()
    for (const src of [
      'A -->|"E-mail System"| B',
      'A --> B\n  B -->|"E-mail System"| C\n  A --> C',
    ]) {
      expect(edgeRow(bt(`graph BT\n  ${src}`))).toBe(
        edgeRow(
          renderMermaidASCII(`graph TD\n  ${src}`, { colorMode: 'none' }),
        ),
      )
    }
    const tall = bt('graph BT\n  A -->|"E-mail<br/>up-down"| B')
    expect(rowOf(tall, 'E-mail')).toBeLessThan(rowOf(tall, 'up-down'))
  })
})
