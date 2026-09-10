// @vitest-environment jsdom
/**
 * Dedicated render coverage for `demo/components/gallery-tiles.tsx`'s six
 * tile illustrations, split out of `index-app.tsx` (zombie-mermaid#932).
 * Each is a prop-less decorative SVG, so this just proves every one renders
 * without throwing and that `GALLERY_TILES` lines up with the six named
 * exports in the documented order.
 */
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ClassTile,
  ERTile,
  FlowchartTile,
  GALLERY_TILES,
  SequenceTile,
  StateTile,
  XYChartTile,
} from '../../demo/components/gallery-tiles.tsx'

describe('gallery tiles', () => {
  it('GALLERY_TILES lists all six tiles in flowchart/state/sequence/class/er/xy-chart order', () => {
    expect(GALLERY_TILES).toEqual([
      FlowchartTile,
      StateTile,
      SequenceTile,
      ClassTile,
      ERTile,
      XYChartTile,
    ])
  })

  it.each([
    ['FlowchartTile', FlowchartTile],
    ['StateTile', StateTile],
    ['SequenceTile', SequenceTile],
    ['ClassTile', ClassTile],
    ['ERTile', ERTile],
    ['XYChartTile', XYChartTile],
  ] as const)('%s renders a single 100x70-viewBox svg', (_name, Tile) => {
    const { container } = render(createElement(Tile))
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('viewBox', '0 0 100 70')
  })
})
