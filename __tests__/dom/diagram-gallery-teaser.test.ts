// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/diagram-gallery-
 * teaser.tsx`'s `DiagramGalleryTeaser`, split out of `index-app.tsx`
 * (zombie-mermaid#932). Tile illustrations are covered on their own in
 * `gallery-tiles.test.ts`; this proves the six cards link to the right
 * `/diagrams/` routes, in the right order.
 */
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DiagramGalleryTeaser } from '../../demo/components/diagram-gallery-teaser.tsx'

describe('DiagramGalleryTeaser', () => {
  it('renders one card per diagram type, linking to its /diagrams/ page', () => {
    render(createElement(DiagramGalleryTeaser))

    const expected: [string, string][] = [
      ['Flowchart', 'diagrams/flowchart.html'],
      ['State', 'diagrams/state.html'],
      ['Sequence', 'diagrams/sequence.html'],
      ['Class', 'diagrams/class.html'],
      ['ER', 'diagrams/er.html'],
      ['XY Chart', 'diagrams/xy-chart.html'],
    ]

    for (const [label, href] of expected) {
      const card = screen.getByText(label).closest('a')
      expect(card).not.toBeNull()
      expect(card).toHaveAttribute('href', href)
    }

    expect(
      screen.getByRole('link', { name: /browse every diagram type/i }),
    ).toHaveAttribute('href', 'diagrams/')
  })
})
