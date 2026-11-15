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
// Trimmed from mermaid 12.3.0's render of `block-beta\n  a space b\n  a -- "t" --> b`.
const LINKED = `<svg viewBox="-5 -25 150 50"><g class="block"><path d="M41.438,0L46.224,0C51.01,0,60.583,0,69.49,0L94.875,0" id="k-1-a-b" class="edge-thickness-normal flowchart-link LS-a1" style="" data-edge="true" marker-end="url(#k_block-pointEnd)"></path><g class="edgeLabel" transform="translate(70.15625, 0)"><g class="label"></g></g></g></svg>`

describe('parseBlockSvg', () => {
  it('reads rectangles relative to the viewBox, radii and the size', () => {
    expect(parseBlockSvg(OFFICIAL)).toEqual({
      blocks: [
        {
          kind: 'rect',
          x: 5,
          y: 5,
          width: 46,
          height: 40,
          cx: 28,
          cy: 25,
          geom: [],
          radius: 5,
          style: '',
        },
      ],
      edges: [],
      size: { width: 56, height: 50 },
    })
  })

  it('reads a link path and its label from Mermaid and from our markup', () => {
    const official = parseBlockSvg(LINKED).edges
    expect(official).toHaveLength(1)
    expect(official[0]!.path.slice(0, 4)).toEqual([46.438, 25, 51.224, 25])
    expect(official[0]!.label).toEqual({ x: 75.15625, y: 25 })
    const ours = parseBlockSvg(
      renderMermaidSVG('block-beta\n  a space b\n  a -- "t" --> b'),
    ).edges
    expect(ours).toHaveLength(1)
    expect(ours[0]!.label).not.toBeNull()
  })

  it('reads inline styles and the label colour from Mermaid and from our markup', () => {
    const official = `<svg viewBox="0 0 10 10"><g class="node blue" transform="translate(5, 5)"><rect class="basic label-container" style="fill:#66f !important;stroke:#33a !important" x="0" y="0" width="1" height="1"></rect><g class="label" style="color:#fff !important"></g></g></svg>`
    expect(parseBlockSvg(official).blocks[0]!.style).toBe(
      'color:#fff;fill:#66f;stroke:#33a',
    )
    const ours = parseBlockSvg(
      renderMermaidSVG(
        'block-beta\n  a\n  classDef blue fill:#66f,stroke:#33a,color:#fff\n  class a blue',
      ),
    )
    expect(ours.blocks[0]!.style).toBe('color:#fff;fill:#66f;stroke:#33a')
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
      blocks: [
        {
          kind: 'rect',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          cx: 0,
          cy: 0,
          geom: [],
          radius: 0,
          style: '',
        },
      ],
      edges: [],
      size: { width: 0, height: 0 },
    })
  })
})

// Trimmed from mermaid 12.3.0's render of `block-beta\n  a(("x"))`, `a{"x"}` and `a[("x")]`.
const CIRCLE = `<svg viewBox="-5 -29 58 58"><g class="block"><g class="node default" transform="translate(24, 0)"><circle r="24" cx="0" cy="0" class="basic label-container"></circle></g></g></svg>`
const DIAMOND = `<svg viewBox="-4.5 -29 58 58"><g class="block"><g class="node default" transform="translate(24.5, 0)"><polygon points="24,0 48,-24 24,-48 0,-24" transform="translate(-23.5,24)" class="label-container"></polygon></g></g></svg>`
const CYLINDER = `<svg viewBox="-5 -31 57 62"><g class="block"><g class="node default" transform="translate(23, 0)"><path d="M0,6.8 a23,6.8 0,0,0 46,0 a23,6.8 0,0,0 -46,0 l0,40 a23,6.8 0,0,0 46,0 l0,-40" class="basic label-container outer-path" transform="translate(-23, -26)"></path></g></g></svg>`
const DOUBLE = `<svg viewBox="-18 -40 80 80"><g class="block"><g class="node default" transform="translate(23, 0)"><g class="basic label-container"><circle class="outer-circle" r="40" cx="0" cy="0"></circle><circle class="inner-circle" r="35" cx="0" cy="0"></circle></g></g></g></svg>`
const ROUGH = `<svg viewBox="-5 -21 68 42"><g class="block"><g class="node default" transform="translate(29, 0)"><g class="basic label-container outer-path" transform="translate(1, 0)"><path d="M-10 -16 C0 -16 10 -16 20 -16" fill="#ececff"></path><path d="M-30 16 L30 16" fill="none"></path></g></g></g></svg>`

describe('parseBlockSvg shapes', () => {
  it('reads a circle as its radius and box, and a double circle as both radii', () => {
    expect(parseBlockSvg(CIRCLE).blocks[0]).toMatchObject({
      kind: 'circle',
      geom: [24],
      x: 5,
      width: 48,
      cx: 29,
    })
    expect(parseBlockSvg(DOUBLE).blocks[0]).toMatchObject({
      kind: 'circle',
      geom: [40, 35],
      width: 80,
    })
  })

  it('reads a polygon as its corners moved by its own transform', () => {
    const [b] = parseBlockSvg(DIAMOND).blocks
    expect(b).toMatchObject({ kind: 'polygon', width: 48, height: 48, cx: 29 })
    expect(b!.geom.slice(0, 2)).toEqual([29.5, 53])
  })

  it('reads a cylinder path and a rough path as boxes', () => {
    expect(parseBlockSvg(CYLINDER).blocks[0]).toMatchObject({
      kind: 'cylinder',
      width: 46,
    })
    expect(parseBlockSvg(ROUGH).blocks[0]).toMatchObject({
      kind: 'rough',
      geom: [],
      width: 60,
      height: 32,
    })
  })

  it('reads our markup for each shape to the same kind as Mermaid', () => {
    const kinds = (src: string) =>
      parseBlockSvg(renderMermaidSVG(src)).blocks.map((b) => b.kind)
    expect(kinds('block-beta\n  a(("x"))')).toEqual(['circle'])
    expect(kinds('block-beta\n  a((("x")))')).toEqual(['circle'])
    expect(kinds('block-beta\n  a{"x"}')).toEqual(['polygon'])
    expect(kinds('block-beta\n  a[("x")]')).toEqual(['cylinder'])
    expect(kinds('block-beta\n  a(["x"])')).toEqual(['rough'])
    expect(kinds('block-beta\n  a>"x"]')).toEqual(['rough'])
  })

  it('notices a shape of another size or another kind', () => {
    const wider = parseBlockSvg(CIRCLE.replace('r="24"', 'r="26"'))
    expect(blockAgreement(parseBlockSvg(CIRCLE), wider).blocks).toBe(0)
    expect(
      blockAgreement(parseBlockSvg(CIRCLE), parseBlockSvg(DIAMOND)).blocks,
    ).toBe(0)
  })
})

describe('blockAgreement', () => {
  const base = () => parseBlockSvg(OFFICIAL)

  it('is 1 for identical layouts and null with nothing to compare', () => {
    expect(blockAgreement(base(), base())).toEqual({
      blocks: 1,
      radii: 1,
      styles: 1,
      edges: null,
      frame: 1,
    })
    const empty = { blocks: [], edges: [], size: base().size }
    expect(blockAgreement(empty, empty)).toMatchObject({
      blocks: null,
      radii: null,
      styles: null,
      edges: null,
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
      styles: 1,
      edges: null,
      frame: 0,
    })
  })

  it('notices a moved path, a moved label and a lost label', () => {
    const same = () => parseBlockSvg(LINKED)
    expect(blockAgreement(same(), same()).edges).toBe(1)
    const moved = same()
    moved.edges[0]!.path[2]! += 2
    expect(blockAgreement(same(), moved).edges).toBe(0)
    const label = same()
    label.edges[0]!.label!.y += 2
    expect(blockAgreement(same(), label).edges).toBe(0)
    const none = same()
    none.edges[0]!.label = null
    expect(blockAgreement(same(), none).edges).toBe(0)
    expect(blockAgreement(none, same()).edges).toBe(0)
    expect(
      blockAgreement(none, parseBlockSvg(LINKED.replace('edgeLabel', 'x')))
        .edges,
    ).toBe(1)
  })

  it('counts a missing block against the share', () => {
    const ours = base()
    ours.blocks = []
    expect(blockAgreement(base(), ours).blocks).toBe(0)
  })
})

describe('blockBreaches', () => {
  it('lists samples under 100% and the errored ones', () => {
    const ok = { blocks: 1, radii: null, styles: null, edges: null, frame: 1 }
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
