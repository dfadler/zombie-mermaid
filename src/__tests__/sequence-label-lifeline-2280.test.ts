import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'
import { samples } from '../../samples/samples-data.ts'

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

  it('centres the else label on the block, clear of lifeline A', () => {
    // The label used to start at the block's left edge and ran across A's
    // lifeline, which had to be cut. Centred, it sits mid-frame instead.
    const block =
      /<g class="block"[^>]*>\s*<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/.exec(
        svg,
      )!
    const center = Number(block[1]) + Number(block[2]) / 2
    expect(num(label, 'x')).toBeCloseTo(center, 1)
    const lineA = /<line class="lifeline" data-actor="A"[^>]*>/.exec(svg)![0]
    expect(Math.abs(num(lineA, 'x1') - center)).toBeGreaterThan(60)
  })
})
