/**
 * A node fed by several labeled edges is centered between its parents, as
 * mermaid.js draws it (#1339). Each parent drops down its own column and
 * enters the node through its side, so every label has a stroke of its own.
 * Centering with the shared top-entry route drew two edges over one path and
 * lost a label; this pins the per-edge route and the shapes that keep the
 * first-parent slot instead.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string): string[] =>
  renderMermaidASCII(src, { colorMode: 'none' })
    .split('\n')
    .map((l) => l.trimEnd())

/** Column of the middle of `label` on the row that carries it. */
function centerOf(lines: string[], label: string): number {
  const row = lines.find((l) => l.includes(label))
  if (row === undefined) throw new Error(`no row contains ${label}`)
  return row.indexOf(label) + (label.length - 1) / 2
}

describe('labeled fan-in centered between its parents (#1339)', () => {
  it('centers the child and keeps both labels', () => {
    const lines = render('graph TD\n  X -->|one| A\n  Y -->|two| A')
    const text = lines.join('\n')
    expect(text).toContain('one')
    expect(text).toContain('two')
    const mid = (centerOf(lines, 'X') + centerOf(lines, 'Y')) / 2
    expect(Math.abs(centerOf(lines, 'A') - mid)).toBeLessThanOrEqual(1)
  })

  it('enters the child through its own sides, one arrowhead per parent', () => {
    const lines = render('graph TD\n  X -->|one| A\n  Y -->|two| A')
    const aRow = lines.find((l) => l.includes(' A '))!
    expect(aRow).toMatch(/►.*A.*◄/)
  })

  it('keeps every label when three parents feed one child', () => {
    const text = render(
      'graph TD\n  X -->|one| A\n  Y -->|two| A\n  Z -->|three| A',
    ).join('\n')
    for (const label of ['one', 'two', 'three']) expect(text).toContain(label)
  })

  it('keeps every label when four parents feed one child', () => {
    const text = render(
      'graph TD\n  X -->|one| A\n  Y -->|two| A\n  Z -->|three| A\n  W -->|four| A',
    ).join('\n')
    for (const label of ['one', 'two', 'three', 'four']) {
      expect(text).toContain(label)
    }
  })

  it('treats one unlabeled parent like the labeled ones', () => {
    const lines = render('graph TD\n  X -->|one| A\n  Y --> A')
    expect(lines.join('\n')).toContain('one')
    const mid = (centerOf(lines, 'X') + centerOf(lines, 'Y')) / 2
    expect(Math.abs(centerOf(lines, 'A') - mid)).toBeLessThanOrEqual(1)
  })

  it('centers a child that has children of its own', () => {
    const lines = render('graph TD\n  X -->|one| A\n  Y -->|two| A\n  A --> Z')
    const mid = (centerOf(lines, 'X') + centerOf(lines, 'Y')) / 2
    expect(Math.abs(centerOf(lines, 'A') - mid)).toBeLessThanOrEqual(1)
  })

  it('centers in BT as well', () => {
    const lines = render('graph BT\n  X -->|one| A\n  Y -->|two| A')
    expect(lines.join('\n')).toContain('two')
    const mid = (centerOf(lines, 'X') + centerOf(lines, 'Y')) / 2
    expect(Math.abs(centerOf(lines, 'A') - mid)).toBeLessThanOrEqual(1)
  })

  describe('keeps the first-parent slot', () => {
    it('in LR, where the entry face collides with the child own out-edge', () => {
      const lines = render('graph LR\n  X -->|one| A\n  Y -->|two| A')
      const text = lines.join('\n')
      expect(text).toContain('one')
      expect(text).toContain('two')
      // A sits on X's row (the first parent), not between X and Y.
      const xRow = lines.findIndex((l) => l.includes(' X '))
      const aRow = lines.findIndex((l) => l.includes(' A '))
      expect(aRow).toBe(xRow)
    })

    it('when a parent also feeds another node', () => {
      const lines = render(
        'graph TD\n  X -->|one| A\n  Y -->|two| A\n  Y --> B',
      )
      expect(centerOf(lines, 'A')).toBe(centerOf(lines, 'X'))
    })

    it('when the child is on a cycle', () => {
      const lines = render(
        'graph TD\n  X -->|one| A\n  Y -->|two| A\n  A -->|go| B\n  B -->|loop| A',
      )
      const text = lines.join('\n')
      for (const label of ['one', 'two', 'go', 'loop']) {
        expect(text).toContain(label)
      }
      expect(centerOf(lines, 'A')).toBe(centerOf(lines, 'X'))
    })

    it('for plain unlabeled fan-in (the upstream goldens pin it)', () => {
      const lines = render('graph TD\n  X --> A\n  Y --> A')
      expect(centerOf(lines, 'A')).toBe(centerOf(lines, 'X'))
    })
  })
})
