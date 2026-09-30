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
})
