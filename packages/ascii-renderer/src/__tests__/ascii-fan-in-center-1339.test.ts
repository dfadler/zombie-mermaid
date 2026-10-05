/**
 * #1339 (part): a plain node with several parents sits centered between them,
 * as mermaid.js draws it, instead of under the first one with the rest running
 * in from the side.
 *
 * Covers `fanInCenter` in grid.ts. It centers only when the edges bundle into
 * one trunk, so each guard that keeps the old first-parent slot has a case:
 * labeled edges, a parent that also feeds something else (`A & B --> C & D`, and
 * `backlink_from_bottom`, where one parent feeds the other), and a child that fans out itself.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string): string[] =>
  renderMermaidASCII(src, { colorMode: 'none' })
    .split('\n')
    .map((l) => l.trimEnd())

/** Column (TD) of the middle of the box labeled `label`. */
function colOf(rows: string[], label: string): number {
  const row = rows.find((r) => new RegExp(`│\\s+${label}\\s+│`).test(r))
  if (row === undefined) throw new Error(`no box ${label}`)
  return row.indexOf(label)
}

/** Row (LR) of the line carrying the box labeled `label`. */
function rowOf(rows: string[], label: string): number {
  const i = rows.findIndex((r) => new RegExp(`│\\s+${label}\\s+[│├┤]`).test(r))
  if (i < 0) throw new Error(`no box ${label}`)
  return i
}

describe('plain fan-in is centered between its parents (#1339)', () => {
  it('TD: A sits midway between X and Y', () => {
    const rows = render('graph TD\nX --> A\nY --> A')
    const mid = (colOf(rows, 'X') + colOf(rows, 'Y')) / 2
    expect(Math.abs(colOf(rows, 'A') - mid)).toBeLessThanOrEqual(1)
  })

  it('LR: A sits midway between X and Y', () => {
    const rows = render('graph LR\nX --> A\nY --> A')
    const mid = (rowOf(rows, 'X') + rowOf(rows, 'Y')) / 2
    expect(Math.abs(rowOf(rows, 'A') - mid)).toBeLessThanOrEqual(1)
  })

  it('centers the rejoin of a diamond', () => {
    const rows = render('graph TD\nA --> B\nA --> C\nB --> D\nC --> D')
    const mid = (colOf(rows, 'B') + colOf(rows, 'C')) / 2
    expect(Math.abs(colOf(rows, 'D') - mid)).toBeLessThanOrEqual(1)
  })

  it('centers a chain that continues below it', () => {
    const rows = render('graph TD\nX --> A\nY --> A\nA --> Z')
    expect(colOf(rows, 'Z')).toBe(colOf(rows, 'A'))
    const mid = (colOf(rows, 'X') + colOf(rows, 'Y')) / 2
    expect(Math.abs(colOf(rows, 'A') - mid)).toBeLessThanOrEqual(1)
  })
})

describe('fan-in that keeps the first-parent slot (#1339)', () => {
  it('labeled fan-in is not centered, and keeps both labels', () => {
    const rows = render('graph TD\nX -->|one| A\nY -->|two| A')
    expect(colOf(rows, 'A')).toBe(colOf(rows, 'X'))
    const text = rows.join('\n')
    expect(text).toContain('one')
    expect(text).toContain('two')
  })

  it('does not center when a parent feeds the other (back-edge shape)', () => {
    // B -> C and C -> D share B's column, so D's edge from C would ride the
    // B -> C corridor and read as never arriving.
    const rows = render('graph LR\nA --> B\nB --> C\nA --> C\nB --> D\nC --> D')
    expect(rowOf(rows, 'D')).toBe(rowOf(rows, 'B'))
  })

  it('does not center when a parent also feeds a sibling', () => {
    const rows = render('graph LR\nA & B --> C & D')
    expect(rowOf(rows, 'C')).toBe(rowOf(rows, 'A'))
    expect(rowOf(rows, 'D')).toBe(rowOf(rows, 'B'))
  })

  it('does not center a child that fans out itself', () => {
    const rows = render('graph TD\nX --> A\nY --> A\nA --> B\nA --> C')
    // Over its own children, as a plain fan-out is.
    const kids = (colOf(rows, 'B') + colOf(rows, 'C')) / 2
    expect(Math.abs(colOf(rows, 'A') - kids)).toBeLessThanOrEqual(1.5)
  })
})
