/**
 * #2786: `class` / `er` / `state` config blocks (init directive and front
 * matter share the path). Measured against mermaid 12.3.0:
 * class.padding moves box width 2 and height 6 per unit, hideEmptyMembersBox
 * drops the two empty compartments of a member-less class, er.diagramPadding /
 * entityPadding / minEntityWidth resize entities, and no `state` key moves
 * the layout.
 */
import { describe, it, expect } from 'vitest'
import { extractInitConfig, describeIgnored } from '@zombie-mermaid/core'
import { renderMermaidSVG } from '../../../../src/index.ts'

const cls = `classDiagram
  class A {
    +int x
    +foo()
  }
  class B
  A <|-- B`
const er = `erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER { string name PK }
  EMPTY`
const wrap = (key: string, cfg: string, body: string) =>
  `%%{init: {"${key}": ${cfg}}}%%\n${body}`
const vb = (svg: string) =>
  /viewBox="0 0 (\S+) (\S+)"/.exec(svg)!.slice(1).map(Number) as [
    number,
    number,
  ]

describe('class / er / state init keys (#2786)', () => {
  it('parses valid keys and drops bad ones', () => {
    const c = extractInitConfig([
      '%%{init: {"class": {"padding": 20, "hideEmptyMembersBox": true, "x": 1}, "er": {"diagramPadding": "a", "entityPadding": -1, "minEntityWidth": 90}}}%%',
    ])
    expect(c.classLayout).toEqual({ padding: 20, hideEmptyMembersBox: true })
    expect(c.erLayout).toEqual({ minEntityWidth: 90 })
    const bad = extractInitConfig([
      '%%{init: {"class": {"padding": "no", "hideEmptyMembersBox": 1}}}%%',
    ])
    expect(bad.classLayout).toEqual({})
  })

  it('merges later directives over earlier ones', () => {
    const c = extractInitConfig([
      '%%{init: {"class": {"padding": 20}, "er": {"minEntityWidth": 90}}}%%',
      '%%{init: {"class": {"hideEmptyMembersBox": true}, "er": {"entityPadding": 20}}}%%',
    ])
    expect(c.classLayout).toEqual({ padding: 20, hideEmptyMembersBox: true })
    expect(c.erLayout).toEqual({ minEntityWidth: 90, entityPadding: 20 })
  })

  it('class.padding resizes boxes; default 12 changes nothing', () => {
    const base = renderMermaidSVG(cls)
    expect(renderMermaidSVG(wrap('class', '{"padding":12}', cls))).toBe(
      renderMermaidSVG(wrap('class', '{}', cls)),
    )
    const big = vb(renderMermaidSVG(wrap('class', '{"padding":30}', cls)))
    expect(big[0]).toBeGreaterThan(vb(base)[0])
    expect(big[1]).toBeGreaterThan(vb(base)[1])
    const small = vb(renderMermaidSVG(wrap('class', '{"padding":0}', cls)))
    expect(small[0]).toBeLessThan(vb(base)[0])
  })

  it('class.hideEmptyMembersBox shrinks only a member-less class', () => {
    const base = renderMermaidSVG(cls)
    const hidden = renderMermaidSVG(
      wrap('class', '{"hideEmptyMembersBox":true}', cls),
    )
    expect(vb(hidden)[1]).toBeLessThan(vb(base)[1])
    const full = `classDiagram\n  class A {\n    +int x\n    +foo()\n  }`
    expect(
      renderMermaidSVG(wrap('class', '{"hideEmptyMembersBox":true}', full)),
    ).toBe(renderMermaidSVG(full))
  })

  it('er.* keys resize entities; front matter takes the same path', () => {
    const base = vb(renderMermaidSVG(er))
    expect(
      vb(renderMermaidSVG(wrap('er', '{"diagramPadding":40}', er)))[0],
    ).toBeGreaterThan(base[0])
    expect(
      vb(renderMermaidSVG(wrap('er', '{"entityPadding":30}', er)))[1],
    ).toBeGreaterThan(base[1])
    expect(
      vb(renderMermaidSVG(wrap('er', '{"minEntityWidth":400}', er)))[0],
    ).toBeGreaterThan(base[0])
    expect(
      vb(renderMermaidSVG(wrap('er', '{"entityPadding":0}', er)))[1],
    ).toBeLessThan(base[1])
    const fm = `---\nconfig:\n  er:\n    entityPadding: 30\n---\n${er}`
    expect(renderMermaidSVG(fm)).toBe(
      renderMermaidSVG(wrap('er', '{"entityPadding":30}', er)),
    )
  })

  it('state config is reported as ignored, output unchanged', () => {
    const c = extractInitConfig(['%%{init: {"state": {"padding": 30}}}%%'])
    expect(describeIgnored(c).join()).toMatch(/^state: no `state` key/)
    const s = `stateDiagram-v2\n  [*] --> A\n  A --> B`
    expect(renderMermaidSVG(wrap('state', '{"padding":30}', s))).toBe(
      renderMermaidSVG(s),
    )
  })
})
