/**
 * Use case ASCII (#3132): a dotted connector meeting a solid edge's tee keeps
 * an arm back, and a dotted edge into a side face stays off the node's wall.
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { healDottedTees } from '../packages/ascii-renderer/src/canvas.ts'
import { checkAll } from './helpers/ascii-invariants.ts'

const render = (src: string) => renderMermaidASCII(src, { colorMode: 'none' })
const violations = (out: string) =>
  checkAll(out, { unicode: true, skip: [] }).map((v) => v.message)

const FAN = (dir: string) =>
  [
    'usecase-beta',
    `direction ${dir}`,
    'actor Guest',
    'Book',
    'Cancel(Cancel a booking)',
    'Guest --> Book',
    'Guest --> Cancel',
    'note for Guest "May be anonymous"',
    'note for Cancel "Free until 24h before"',
  ].join('\n')

describe('use case ASCII junctions (#3132)', () => {
  it.each(['LR', 'RL'])('joins a dotted note to a solid tee (%s)', (dir) => {
    const out = render(FAN(dir))
    expect(violations(out)).toEqual([])
    expect(out).toContain('┼')
  })

  it.each([
    ['LR', 'direction LR'],
    ['RL', 'direction RL'],
  ])('keeps a dotted edge off the wall it ends on (%s)', (_n, dir) => {
    const out = render(
      `usecase-beta\n${dir}\nactor G\nBook\nCancel\nG --> Book\nCancel ..> : extend Book\nnote for Book "Held"`,
    )
    expect(violations(out)).toEqual([])
    expect(out).not.toMatch(/[┆▲▼]─{3,}[╯╮]/)
    expect(out).not.toMatch(/[▲▼]\s+│/)
  })

  it('does the same in a flowchart', () => {
    const out = render(
      'graph LR\nG[G]\nBook[Book]\nCancel[Cancel]\nN[Held]\nG --> Book\nCancel -. extend .-> Book\nN -.- Book',
    )
    expect(out).not.toMatch(/┆─{3,}[┘┐]/)
    expect(out).toContain('┌──────┐')
  })

  it('healDottedTees adds the missing arm and nothing else', () => {
    // Columns are x, rows y: `┄├` and `┤┄` become crossings; a lone tee stays.
    const grid = [['┄'], ['├'], [' '], ['┤'], ['┄'], ['├'], ['┄']].map((c) => [
      ...c,
    ])
    healDottedTees(grid)
    expect(grid.map((c) => c[0])).toEqual(['┄', '┼', ' ', '┼', '┄', '┼', '┄'])
    // A dotted arm on the tee's own side already has its arm: left alone.
    const lone = [['├'], ['┄'], ['┄'], ['┤']]
    healDottedTees(lone)
    expect(lone).toEqual([['├'], ['┄'], ['┄'], ['┤']])
  })
})
