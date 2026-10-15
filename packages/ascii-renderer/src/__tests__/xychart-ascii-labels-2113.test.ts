/**
 * #2113: x-category and value-axis tick labels ran together or were
 * overwritten by their neighbour. Rule (xychart.ts thinLabels /
 * ellipsizeTouching): never two labels touching, nothing cut without an
 * ellipsis, every n-th numeric label shown when they do not fit.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

function render(text: string, useAscii = false): string {
  return renderMermaidASCII(text, { colorMode: 'none', useAscii })
}

/** Text of the row under the x-axis line (first row after the `┬`/`+` ticks). */
function labelRow(out: string): string {
  const lines = out.split('\n')
  const axis = lines.findIndex((l) => /[┬+].*[┬+]/.test(l) && /[─-]{3}/.test(l))
  return lines[axis + 1]!
}

const EIGHT = `xychart-beta
    x-axis [Eng, Sales, Marketing, Support, HR, Finance, Legal, Ops]
    bar [45, 32, 18, 25, 8, 12, 6, 15]`

describe('xychart ASCII – label collisions (#2113)', () => {
  it('shortens colliding words with an ellipsis instead of running them together', () => {
    const row = labelRow(render(EIGHT))
    expect(row).not.toContain('SalesMarketin')
    expect(row.trim().split(/\s+/)).toEqual([
      'Eng',
      'Sales',
      'Marke…',
      'Suppo…',
      'HR',
      'Finance',
      'Legal',
      'Ops',
    ])
  })

  it('uses a three-dot ellipsis in the ASCII charset', () => {
    const row = labelRow(render(EIGHT, true))
    expect(row).toContain('Mar...')
    expect(row).not.toContain('…')
  })

  it('leaves labels alone when they fit, even next to one long label', () => {
    const row = labelRow(
      render(`xychart-beta
      x-axis [A, B, "A Rather Long Category", D]
      bar [1, 2, 3, 4]`),
    )
    expect(row).toContain('A Rather Long Category')
    expect(row).not.toContain('…')
  })

  it('thins numeric value-axis ticks of a horizontal chart, never cutting a number', () => {
    const out = render(`xychart-beta horizontal
      x-axis [A, B]
      bar [40000, 220000]`)
    const row = labelRow(out)
    const nums = row.trim().split(/\s+/)
    expect(nums.length).toBeGreaterThan(1)
    for (const n of nums) expect(n).toMatch(/^\d+$/)
    expect(row).not.toMatch(/\d{7}/)
    expect(row).not.toContain('80000100000')
  })

  it('thins numbers and dates instead of ellipsizing them', () => {
    const row = labelRow(
      render(`xychart-beta
      x-axis [2024-01-01, 2024-01-02, 2024-01-03, 2024-01-04, 2024-01-05, 2024-01-06, 2024-01-07, 2024-01-08]
      line [1, 2, 3, 4, 5, 6, 7, 8]`),
    )
    expect(row).not.toContain('…')
    const dates = row.trim().split(/\s+/)
    expect(dates.length).toBeLessThan(8)
    for (const d of dates) expect(d).toMatch(/^2024-01-0\d$/)
  })
})
