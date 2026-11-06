/**
 * #2280: the committed visual baselines for these gallery samples still drew
 * lifelines through message labels, and the suite's 0.2% tolerance kept it
 * green. Pin the cut on the real gallery sources so a regression fails here
 * even while a PNG baseline is stale (exact y-ranges, not a snapshot matcher).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import { samples } from '../samples/samples-data.ts'

function gallerySvg(title: string): string {
  const sample = samples.find((s) => s.title === title)
  if (!sample) throw new Error(`gallery sample not found: ${title}`)
  return renderMermaidSVG(sample.source, sample.options)
}

/** [y1, y2] of every drawn piece of `actor`'s lifeline, top to bottom. */
function segments(svg: string, actor: string): Array<[number, number]> {
  const re =
    /<line class="lifeline" data-actor="([^"]*)" x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/g
  return [...svg.matchAll(re)]
    .filter((m) => m[1] === actor)
    .map((m): [number, number] => [Number(m[2]), Number(m[3])])
}

describe('gallery sequence samples draw whole lifelines through labels (#2706)', () => {
  it('Alt/Else Long Label: every lifeline is one line, like mermaid 12.3.0', () => {
    const svg = gallerySvg(
      'Sequence: Alt/Else Long Label With Uninvolved Participant',
    )
    for (const id of ['A', 'B', 'C']) {
      expect(segments(svg, id)).toHaveLength(1)
    }
  })

  it('Microservice Orchestration: lifelines crossed by labels are not cut', () => {
    const svg = gallerySvg('Sequence: Microservice Orchestration')
    for (const id of ['A', 'U', 'G', 'O', 'N']) {
      expect(segments(svg, id)).toHaveLength(1)
    }
  })
})
