/**
 * #2907: the `architecture` config block (init directive and front matter share
 * the path). Measured against mermaid 12.3.0 with each key swept: `padding`
 * (default 40) pads the page and every group, `iconSize` (80) is the tile edge,
 * `fontSize` (16) sets the room under a label, `idealEdgeLengthMultiplier`
 * (1.5) sets the cell pitch to `iconSize * (1 + multiplier)`. `nodeSeparation`,
 * `seed`, `randomize`, `edgeElasticity`, `numIter` and `useMaxWidth` do not
 * move mermaid's geometry (the first three) or are solver noise (the others).
 */
import { describe, it, expect } from 'vitest'
import { extractInitConfig } from '@zombie-mermaid/core'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const group = `architecture-beta
  group api(cloud)[API]
  service db(database)[Database] in api
  service server(server)[Server] in api
  db:L -- R:server`
const chain = `architecture-beta
  service a(server)[A]
  service b(server)[B]
  service c(server)[C]
  a:R -- L:b
  b:B -- T:c`
const wrap = (cfg: object, body: string) =>
  `%%{init: {"architecture": ${JSON.stringify(cfg)}}}%%\n${body}`
const size = (svg: string) =>
  /viewBox="0 0 (\S+) (\S+)"/.exec(svg)!.slice(1).map(Number) as [
    number,
    number,
  ]

describe('architecture init keys (#2907)', () => {
  it('parses valid keys and drops bad ones', () => {
    const c = extractInitConfig([
      '%%{init: {"architecture": {"padding": 20, "iconSize": 40, "fontSize": 12, "idealEdgeLengthMultiplier": 2, "seed": 3}}}%%',
    ])
    expect(c.architectureLayout).toEqual({
      padding: 20,
      iconSize: 40,
      fontSize: 12,
      idealEdgeLengthMultiplier: 2,
    })
    const bad = extractInitConfig([
      '%%{init: {"architecture": {"padding": -1, "iconSize": 0, "fontSize": "a", "idealEdgeLengthMultiplier": 1000}}}%%',
    ])
    expect(bad.architectureLayout).toEqual({})
    expect(
      extractInitConfig(['%%{init: {"architecture": 5}}%%']).architectureLayout,
    ).toBeUndefined()
  })

  it('merges later directives over earlier ones', () => {
    const c = extractInitConfig([
      '%%{init: {"architecture": {"padding": 20, "iconSize": 40}}}%%',
      '%%{init: {"architecture": {"iconSize": 60}}}%%',
    ])
    expect(c.architectureLayout).toEqual({ padding: 20, iconSize: 60 })
  })

  it('the defaults change nothing', () => {
    const base = renderMermaidSVG(group)
    expect(
      renderMermaidSVG(
        wrap(
          {
            padding: 40,
            iconSize: 80,
            fontSize: 16,
            idealEdgeLengthMultiplier: 1.5,
          },
          group,
        ),
      ),
    ).toBe(base)
  })

  // Mermaid 12.3.0, db:L -- R:server in a group: 445.7 x 262 by default.
  it.each([
    [{ padding: 0 }, 285.7, 106.7],
    [{ padding: 20 }, 365.7, 182],
    [{ padding: 80 }, 605.7, 422],
    [{ iconSize: 120 }, 585.3, 302],
    [{ fontSize: 8 }, 445.7, 254],
    [{ fontSize: 24 }, 458.2, 270],
  ])('%j sizes the canvas as mermaid does', (cfg, w, h) => {
    const [ow, oh] = size(renderMermaidSVG(wrap(cfg, group)))
    expect(Math.abs(ow - w)).toBeLessThan(7)
    expect(Math.abs(oh - h)).toBeLessThan(1)
  })

  // Mermaid 12.3.0, a:R -- L:b, b:B -- T:c: pitch is iconSize * (1 + multiplier).
  it.each([
    [{ idealEdgeLengthMultiplier: 2 }, 400.5, 424.7],
    [{ idealEdgeLengthMultiplier: 3 }, 480.2, 504.4],
    [{ idealEdgeLengthMultiplier: 5, iconSize: 40 }, 360.3, 384.5],
  ])('%j spaces the cells as mermaid does', (cfg, w, h) => {
    const [ow, oh] = size(renderMermaidSVG(wrap(cfg, chain)))
    expect(Math.abs(ow - w)).toBeLessThan(2)
    expect(Math.abs(oh - h)).toBeLessThan(2)
  })

  it('iconSize scales the tile and its glyph', () => {
    const svg = renderMermaidSVG(wrap({ iconSize: 40 }, group))
    expect(svg).toContain('scale(0.5)')
    expect(renderMermaidSVG(group)).not.toContain('scale(0.5)')
    expect(
      renderMermaidSVG(
        wrap({ iconSize: 40 }, 'architecture-beta\n  service a[A]'),
      ),
    ).toContain('scale(0.5)')
  })

  it('a group beside a group costs the gap between their boxes', () => {
    const two = `architecture-beta
  group g1(cloud)[One]
  group g2(cloud)[Two]
  service a(server)[A] in g1
  service b(server)[B] in g2
  a:R -- L:b`
    // Mermaid 12.3.0 viewBox widths: 488.2 default, 365.4 at padding 20, 727.6 at 80.
    for (const [cfg, w] of [
      [{}, 488.2],
      [{ padding: 20 }, 365.4],
      [{ padding: 80 }, 727.6],
      [{ iconSize: 120 }, 589.4],
    ] as const)
      expect(
        Math.abs(size(renderMermaidSVG(wrap(cfg, two)))[0] - w),
      ).toBeLessThan(2)
  })

  it('more than two borders and nested groups follow the padding', () => {
    const three = `architecture-beta
  group g1(cloud)[One]
  group g2(cloud)[Two] in g1
  group g3(cloud)[Three]
  service a(server)[A] in g2
  service b(server)[B] in g3
  a:R -- L:b`
    const base = size(renderMermaidSVG(three))[0]
    expect(
      size(renderMermaidSVG(wrap({ padding: 80 }, three)))[0],
    ).toBeGreaterThan(base + 200)
  })

  it('the caller padding option wins over architecture.padding', () => {
    const page = size(
      renderMermaidSVG(wrap({ padding: 0 }, chain), { padding: 40 }),
    )
    const own = size(renderMermaidSVG(wrap({ padding: 0 }, chain)))
    expect(page[0]).toBeGreaterThan(own[0])
  })

  it('front matter reads the same keys as the init directive', () => {
    const fm = `---\nconfig:\n  architecture:\n    padding: 20\n    iconSize: 40\n---\n${group}`
    expect(renderMermaidSVG(fm)).toBe(
      renderMermaidSVG(wrap({ padding: 20, iconSize: 40 }, group)),
    )
  })

  it('keys that do not move mermaid output are not read', () => {
    const base = renderMermaidSVG(group)
    for (const cfg of [
      { nodeSeparation: 150 },
      { seed: 7 },
      { randomize: true },
      { useMaxWidth: false },
    ])
      expect(renderMermaidSVG(wrap(cfg, group))).toBe(base)
  })

  describe('snapshots (SVG and ASCII)', () => {
    it.each([
      ['padding 20', { padding: 20 }],
      ['iconSize 40', { iconSize: 40 }],
      ['fontSize 24', { fontSize: 24 }],
      ['idealEdgeLengthMultiplier 3', { idealEdgeLengthMultiplier: 3 }],
    ])('SVG: %s', (_name, cfg) => {
      expect(renderMermaidSVG(wrap(cfg, group))).toMatchSnapshot()
    })

    // ASCII has no pixel units and mermaid has no ASCII output: every key leaves it as is.
    it('ASCII: none of the keys change the text', () => {
      const base = renderMermaidASCII(group)
      expect(base).toMatchSnapshot()
      for (const cfg of [
        { padding: 20 },
        { iconSize: 40 },
        { fontSize: 24 },
        { idealEdgeLengthMultiplier: 3 },
      ])
        expect(renderMermaidASCII(wrap(cfg, group))).toBe(base)
    })
  })
})
