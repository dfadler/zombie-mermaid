/**
 * #1408: a lone labelled vertical edge puts its label on the gap midpoint
 * (as Mermaid does), and when that row is where another edge's stroke turns
 * (a bypass corner or `├` junction) the label moves up a row so it does not
 * read as part of that line.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string, useAscii = false) =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii }).split('\n')

describe('lone vertical edge label (#1408)', () => {
  it('sits on the middle row of the gap', () => {
    const rows = render('graph TD\n  A -->|push = build| B')
    const label = rows.findIndex((r) => r.includes('push = build'))
    const arrow = rows.findIndex((r) => r.includes('▼'))
    const boxBottom = rows.findIndex((r) => r.includes('└'))
    expect(label - boxBottom).toBe(Math.ceil((arrow - boxBottom) / 2))
  })

  it.each([
    ['unicode', false, '├'],
    ['ascii', true, '+'],
  ])(
    'does not share a row with a bypass corner (%s)',
    (_name, useAscii, junction) => {
      const src = 'graph TD\n  A --> B\n  B -->|"E-mail System"| C\n  A --> C'
      const rows = render(src, useAscii)
      expect(rows.join('\n')).toContain('E-mail System')
      const label = rows.find((r) => r.includes('E-mail System'))!
      // Nothing but the label (and the edge's own stroke) on its row: no
      // corner of the bypass edge.
      expect(label).not.toMatch(/[┘┐┌└├┤+]/)
      // The bypass edge still rejoins C's column with a junction below it.
      expect(rows.join('\n')).toContain(junction)
    },
  )
})
