/**
 * #1288: with two side-by-side single-node subgraphs fed by one edge each,
 * the right frame's left wall was pushed (by `ensureSubgraphSpacing`) onto
 * its node's left edge, so the wall drew `├`/`┤` junctions over the node
 * box's corners. The wall must stay clear of the node box.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SOURCE = `graph TD
  subgraph SA[Alpha]
    A
  end
  subgraph SB[Beta]
    B
  end
  X-->A
  X-->B`

describe('subgraph wall vs node box (#1288)', () => {
  const lines = renderMermaidASCII(SOURCE, { colorMode: 'none' }).split('\n')

  it('keeps every node box corner intact', () => {
    for (const l of lines) {
      expect(l, 'wall junction on a box corner').not.toMatch(/├───[┐┘]/)
    }
    // X, A and B all keep their full top corners; A and B their bottoms.
    const text = lines.join('\n')
    expect(text.match(/┌───┐/g)).toHaveLength(3)
    expect(text.match(/└───┘/g)).toHaveLength(2)
  })

  it('leaves a clear column between the frame wall and the node box', () => {
    const aTop = lines.find(
      (l) => l.includes('┌───┐') && l.lastIndexOf('┌') > 4,
    )
    expect(aTop, 'no row with the A box top edge').toBeDefined()
    const boxAt = aTop!.lastIndexOf('┌───┐')
    expect(aTop![boxAt - 1]).toBe(' ')
    expect(aTop![boxAt - 2]).toBe('│')
  })

  it('does not push frames apart when the title already leaves room', () => {
    // The wide title leaves the right frame's wall clear of its node, so the
    // frames keep their tight one-column gap (the early-`continue` path).
    const wide = renderMermaidASCII(
      SOURCE.replace('[Alpha]', '[Long title for alpha here]'),
      { colorMode: 'none' },
    )
    const text = wide.split('\n')
    expect(text.some((l) => l.includes('┐ ┌'))).toBe(true)
    expect(wide.match(/┌───┐/g)).toHaveLength(3)
    expect(wide).not.toMatch(/├───[┐┘]/)
  })
})
