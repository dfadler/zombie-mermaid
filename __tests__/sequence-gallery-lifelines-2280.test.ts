/**
 * #2280: the committed visual baselines for these gallery samples still drew
 * lifelines through message labels, and the suite's 0.2% tolerance kept it
 * green. Pin the cut on the real gallery sources so a regression fails here
 * even while a PNG baseline is stale (exact y-ranges, not a snapshot matcher).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import { samples } from '../packages/site/samples-data.ts'

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

describe('gallery sequence samples cut lifelines around labels (#2280)', () => {
  it('Alt/Else Long Label: lifeline A is cut around "[credentials rejected]" (label y=160)', () => {
    const svg = gallerySvg(
      'Sequence: Alt/Else Long Label With Uninvolved Participant',
    )
    expect(segments(svg, 'A')).toEqual([
      [70, 76],
      [98, 150.85],
      [169.15, 222],
    ])
    // The uninvolved participants stay whole.
    expect(segments(svg, 'B')).toEqual([[70, 222]])
    expect(segments(svg, 'C')).toEqual([[70, 222]])
  })

  it('Microservice Orchestration: Auth and Users lifelines are cut around the labels crossing them', () => {
    const svg = gallerySvg('Sequence: Microservice Orchestration')
    // "Get user" y=188 and "User data" y=228 cross Auth.
    expect(segments(svg, 'A')).toEqual([
      [70, 178.85],
      [197.15, 218.85],
      [237.15, 477],
    ])
    // "Send notification" y=372 crosses Users.
    expect(segments(svg, 'U')).toEqual([
      [70, 362.85],
      [381.15, 402.85],
      [421.15, 477],
    ])
    // Gateway is cut by the par title tab; Orders and Notify are never crossed.
    expect(segments(svg, 'G')).toEqual([
      [70, 156],
      [178, 477],
    ])
    expect(segments(svg, 'O')).toEqual([[70, 477]])
    expect(segments(svg, 'N')).toEqual([[70, 477]])
  })
})
