import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'
import { samples } from '../../packages/site/samples-data.ts'

// #2280: the visual baseline for this sample went stale and still showed the
// else-label touching the message label with lifeline A running through it,
// and the 0.2% screenshot tolerance hid that. Assert the geometry directly.
const sample = samples.find((s) =>
  s.title.startsWith('Sequence: Alt/Else Long Label With Uninvolved'),
)!

function num(tag: string, attr: string): number {
  return Number(tag.split(` ${attr}="`)[1]!.split('"')[0])
}

describe('alt/else label vs lifeline (#2280)', () => {
  const svg = renderMermaidSVG(sample.source, sample.options)
  const label = /<text[^>]*>\[credentials rejected\]<\/text>/.exec(svg)![0]

  it('puts the else label on its own row above the message label', () => {
    const msg = /<text[^>]*>y<\/text>/.exec(svg)![0]
    // Rows are 11px text: anything closer than a line height would touch.
    expect(num(msg, 'y') - num(label, 'y')).toBeGreaterThanOrEqual(11)
  })

  it('cuts the uninvolved lifeline around the else label', () => {
    const y = num(label, 'y')
    const segs = [
      ...svg.matchAll(/<line class="lifeline" data-actor="A"[^>]*>/g),
    ].map((m) => ({ a: num(m[0], 'y1'), b: num(m[0], 'y2') }))
    expect(segs.length).toBeGreaterThan(1)
    expect(segs.some(({ a, b }) => a < y && y < b)).toBe(false)
  })
})
