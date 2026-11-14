import { describe, expect, it, vi } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import { scoreBlock } from '../scripts/lib/block-measure.ts'
import type { RealMermaidSession } from '../scripts/lib/real-mermaid.ts'
import {
  blockAgreement,
  blockBreaches,
  parseBlockSvg,
} from '../scripts/lib/block-agreement.ts'

// Trimmed from mermaid 12.3.0's render of `block-beta\n  a("x")`.
const OFFICIAL = `<svg viewBox="-5 -25 56 50"><g class="block"><g class="node default flowchart-label" id="k-a" data-look="classic" transform="translate(23, 0)"><rect class="basic label-container" style="" rx="5" ry="5" x="-23" y="-20" width="46" height="40"></rect></g></g></svg>`
const SOURCE = 'block-beta\n  a("x")'

describe('parseBlockSvg', () => {
  it('reads rectangles relative to the viewBox, radii and the size', () => {
    expect(parseBlockSvg(OFFICIAL)).toEqual({
      blocks: [{ x: 5, y: 5, width: 46, height: 40, radius: 5 }],
      size: { width: 56, height: 50 },
    })
  })

  it('reads our own markup to the same shape', () => {
    const ours = parseBlockSvg(renderMermaidSVG(SOURCE))
    expect(ours.blocks).toHaveLength(1)
    expect(ours.blocks[0]).toMatchObject({ x: 5, y: 5, height: 40, radius: 5 })
  })

  it('treats a missing viewBox, transform and attributes as zero', () => {
    const svg =
      '<svg><g class="node"><rect class="label-container"></rect></g><g class="node"><circle></circle></g></svg>'
    expect(parseBlockSvg(svg)).toEqual({
      blocks: [{ x: 0, y: 0, width: 0, height: 0, radius: 0 }],
      size: { width: 0, height: 0 },
    })
  })
})

describe('blockAgreement', () => {
  const base = () => parseBlockSvg(OFFICIAL)

  it('is 1 for identical layouts and null with nothing to compare', () => {
    expect(blockAgreement(base(), base())).toEqual({
      blocks: 1,
      radii: 1,
      frame: 1,
    })
    const empty = { blocks: [], size: base().size }
    expect(blockAgreement(empty, empty)).toMatchObject({
      blocks: null,
      radii: null,
    })
  })

  it('notices a wider block, another radius and a different size', () => {
    const ours = base()
    ours.blocks[0]!.width += 5
    ours.blocks[0]!.radius = 0
    ours.size.width += 5
    expect(blockAgreement(base(), ours)).toEqual({
      blocks: 0,
      radii: 0,
      frame: 0,
    })
  })

  it('counts a missing block against the share', () => {
    const ours = base()
    ours.blocks = []
    expect(blockAgreement(base(), ours).blocks).toBe(0)
  })
})

describe('blockBreaches', () => {
  it('lists samples under 100% and the errored ones', () => {
    const ok = { blocks: 1, radii: null, frame: 1 }
    expect(blockBreaches({ a: ok, b: { ...ok, blocks: 0.5 } }, ['c'])).toEqual([
      'b',
      'c',
    ])
  })
})

describe('scoreBlock', () => {
  // A stand-in session whose "official" render is our own, so every sample agrees.
  const session = {
    page: {
      evaluate: async (_fn: unknown, [, src]: [string, string]) =>
        renderMermaidSVG(src),
    },
  } as unknown as RealMermaidSession

  it('scores each block sample and filters by title', async () => {
    const all = await scoreBlock(session)
    const titles = Object.keys(all.results)
    expect(titles.length).toBeGreaterThan(0)
    expect(all.breaches).toEqual([])
    const one = await scoreBlock(session, titles[0]!.toUpperCase())
    expect(Object.keys(one.results)).toContain(titles[0])
  })

  it('reports a sample that fails to render as errored', async () => {
    const bad = {
      page: {
        evaluate: async () => {
          throw new Error('boom\nstack')
        },
      },
    } as unknown as RealMermaidSession
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await scoreBlock(bad)
    spy.mockRestore()
    expect(r.errored.length).toBeGreaterThan(0)
    expect(r.breaches).toEqual(r.errored)
  })
})
