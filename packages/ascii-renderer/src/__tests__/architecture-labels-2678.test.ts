/**
 * #2678: mermaid 12.3.0 draws a `?` for an icon it has no art for, and every
 * group title. ASCII shows the `?` as the first label line and keeps a group
 * the ports would have folded into its neighbour (general-94, general-96).
 * The SVG renderer already draws both (`architecture-icon-tiles-2518`).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import type { MermaidSubgraph } from '@zombie-mermaid/core'
import { separateGroups } from '../architecture.ts'
import type { AsciiNodeHint } from '../layout-hints.ts'

const lines = (src: string): string[] =>
  renderMermaidASCII(src, { colorMode: 'none' }).split('\n')

describe('architecture ASCII labels (#2678)', () => {
  it('puts ? above the label of an unknown icon only', () => {
    const out = lines(`architecture-beta
  service a(server)[Known]
  service b(not-a-real-icon)[Unknown Icon]
  service c[No Icon]
  a:R -- L:b
  b:R -- L:c`)
    const row = out.findIndex((l) => l.includes('Unknown Icon'))
    expect(out[row - 1]).toMatch(/[│├┤]\s+\?\s+[│├┤]/)
    expect(out.join('\n').match(/\?/g)).toHaveLength(1)
  })

  it('keeps a group whose box the ports would fold into another group', () => {
    const out = lines(`architecture-beta
  group front(cloud)[Frontend]
  group back(server)[Backend]
  group store(database)[Storage]
  service ui(internet)[UI] in front
  service api(server)[API] in back
  service jobs(server)[Jobs] in back
  service db(database)[Postgres] in store
  ui{group}:R --> L:api{group}
  api:B -- T:db{group}
  jobs:R --> L:db`)
    const text = out.join('\n')
    for (const label of ['Frontend', 'Backend', 'Storage', 'Postgres'])
      expect(text).toContain(label)
    // Backend does not enclose Postgres: Storage sits to its right
    const at = (s: string) => out.find((l) => l.includes(s))!.indexOf(s)
    expect(at('Storage')).toBeGreaterThan(at('Backend'))
    expect(at('Backend')).toBeGreaterThan(at('Frontend'))
  })
})

describe('separateGroups settles (#2678)', () => {
  const node = (layer: number, order: number): AsciiNodeHint => ({
    layer,
    order,
    cross: order * 140,
    size: 100,
  })
  const group = (id: string, nodeIds: string[]): MermaidSubgraph => ({
    id,
    label: id,
    nodeIds,
    children: [],
  })

  it('rechecks an earlier group after a later one moves a service into it', () => {
    const nodes = new Map([
      ['a1', node(0, 0)],
      ['a2', node(2, 2)],
      ['b1', node(0, 1)],
      ['b2', node(2, 3)],
    ])
    separateGroups([group('A', ['a1', 'a2']), group('B', ['b1', 'b2'])], nodes)
    const span = (ids: string[]) => {
      const hs = ids.map((id) => nodes.get(id)!)
      return (h: AsciiNodeHint) =>
        h.layer >= Math.min(...hs.map((m) => m.layer)) &&
        h.layer <= Math.max(...hs.map((m) => m.layer)) &&
        h.order >= Math.min(...hs.map((m) => m.order)) &&
        h.order <= Math.max(...hs.map((m) => m.order))
    }
    for (const [own, other] of [
      [
        ['a1', 'a2'],
        ['b1', 'b2'],
      ],
      [
        ['b1', 'b2'],
        ['a1', 'a2'],
      ],
    ] as const)
      for (const id of other) expect(span([...own])(nodes.get(id)!)).toBe(false)
  })
})
